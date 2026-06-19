/**
 * DOS2 Build Tracker — script.js
 * Renderiza a UI dinamicamente a partir do builds.json
 * Persiste progresso no localStorage
 * Suporta filtros, collapse de fases, e highlight do próximo nível
 */

// ─── Estado global ───────────────────────────────────────────
const State = {
  characters: [],       // dados do JSON
  activeChar: null,     // id do personagem ativo
  completedLevels: {},  // { charId: Set<number> }
  activeFilters: new Set(['all']),
  searchQuery: '',
  openPhases: {},       // { charId+phaseIdx: bool }
  theme: document.documentElement.getAttribute('data-theme') || 'dark'
}

// Tooltips de skills (descrições curtas para hover)
const SKILL_TOOLTIPS = {
  'Ricochet':           'Flecha que ricocheteia em inimigos próximos. Escala com Huntsman.',
  'Tactical Retreat':   'Teleporte para terreno elevado + Haste temporário.',
  'First Aid':          'Remove debuffs negativos e cura aliado.',
  'Summon Wolf':        'Convoca o lobo de Ifan para tanquear e atacar.',
  'Ballistic Shot':     'Dano massivo baseado na distância entre você e o alvo.',
  'Haste':              '+1 AP e +1 AP de movimento por turno ao aliado.',
  'Peace of Mind':      '+2 Wits, +2 Strength e remove medo/confusão.',
  'Pin Down':           'Imobiliza inimigo e causa dano físico.',
  'Sky Shot':           'Ataque poderoso de terreno alto com cooldown baixo.',
  'Adrenaline':         '+2 AP neste turno, -2 AP no próximo.',
  'Take Aim':           'Aumenta crítico e precisão por 2 turnos.',
  'Phoenix Dive':       'Voa para localização e cria poça de chamas ao aterrissar.',
  'Infiltrating Arrow': 'Flecha que ignora armadura física.',
  'Battle Stomp':       'Knockdown em cone frontal. Quebra armadura física.',
  'Bouncing Shield':    'Arremessa escudo que ricocheteia em até 3 inimigos.',
  'Bull Rush':          'Investida que empurra inimigos e cria caminho de dano.',
  'Chicken Claw':       'Transforma inimigo em galinha por 2 turnos. Remove do combate.',
  'Whirlwind':          'Dano físico em todos inimigos adjacentes. Sem cooldown alto.',
  'Tentacle Lash':      'Ataque único forte com tentáculo + chance de desarmar.',
  'Fortify':            'Remove debuffs de movimento e aumenta armadura física.',
  'Challenge':          'Provoca inimigo a atacar você; se matar, cura HP.',
  'Earthquake':         'AoE de terra que causa knockdown em área ampla.',
  'Skin Graft':         'Reseta todos os cooldowns de skills instantaneamente.',
  'Blitz Attack':       'Ataque rápido em dois alvos diferentes no mesmo turno.',
  'Taunt':              'Força todos inimigos próximos a atacar você.',
  'Backlash':           'Teleporte instantâneo atrás do alvo + ataque de backstab.',
  'Rupture Tendons':    'Causa dano quando alvo se move. Muito forte contra ranged.',
  'Chameleon Cloak':    'Fica invisível por 1 turno. Repositionamento seguro.',
  'Cloak and Dagger':   'Teleporte para localização distante + invisibilidade.',
  'Venom Coating':      'Cobre armas em veneno por vários turnos.',
  'Fan of Knives':      'Lança facas em todos inimigos próximos.',
  'Shadow Step':        'Teleporte para atrás do alvo com backstab garantido.',
  'Terrifying Cry':     'Grito que aplica Terrified (reduz armadura) em área.',
  'Corrosive Touch':    'Remove armadura física do alvo com toque.',
  'Restoration':        'Cura aliado e remove efeitos de superfície.',
  'Rain':               'Cria chuva que molha toda a área — prepara Chain Lightning.',
  'Armour of Frost':    'Restaura armadura mágica de aliado instantaneamente.',
  'Electric Discharge': 'Dano elétrico + stun em alvo com status Wet.',
  'Healing Ritual':     'Cura em cadeia que salta entre aliados próximos.',
  'Chain Lightning':    'Raio que ricocheteia em 4-5 alvos. Stun em alvos Wet.',
  'Hail Strike':        'Chuva de gelo em área que causa dano + Chilled.',
  'Bless':              'Remove maldições e converte superfícies negativas em Divinas.',
  'Mass Cleanse Wounds':'Cura e remove veneno/sangramento em área.',
  'Steam Lance':        'Jato de vapor em linha — cura aliados, dano em inimigos.',
  'Winter Blast':       'Cone de gelo que causa dano e pode congelar alvos.',
  'Global Teleportation':'Teleporta qualquer unidade para outro local no mapa.',
  'Healing Aura':       'Cura passiva todos os aliados próximos a cada turno.',
  'Throw Explosive Trap':'Armadilha explosiva colocada no chão.',
  'Spread Your Wings':  'Cresce asas e ganha capacidade de voar por 2 turnos.',
  'Infiltrating Arrow': 'Flecha que perfura armadura física.'
}

// Mapa de ícones para atributos
const ATTR_ICONS = {
  'Finesse':      '🎯',
  'Strength':     '💪',
  'Inteligência': '🔮',
  'Wits':         '👁️',
  'Constituição': '🛡️',
  'Memória':      '📖'
}

// ─── Persistência com localStorage ───────────────────────────
const Storage = {
  KEYS: {
    completed: 'dos2_completed',
    activeChar: 'dos2_activeChar',
    openPhases: 'dos2_openPhases',
    theme: 'dos2_theme'
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEYS.completed)
      if (raw) {
        const parsed = JSON.parse(raw)
        // converte arrays de volta para Sets
        Object.keys(parsed).forEach(id => {
          State.completedLevels[id] = new Set(parsed[id])
        })
      }
      const ac = localStorage.getItem(this.KEYS.activeChar)
      if (ac) State.activeChar = ac

      const op = localStorage.getItem(this.KEYS.openPhases)
      if (op) State.openPhases = JSON.parse(op)
    } catch(e) {
      console.warn('localStorage indisponível, usando estado em memória.')
    }
  },

  save() {
    try {
      // converte Sets para arrays para JSON
      const serializable = {}
      Object.keys(State.completedLevels).forEach(id => {
        serializable[id] = [...State.completedLevels[id]]
      })
      localStorage.setItem(this.KEYS.completed, JSON.stringify(serializable))
      localStorage.setItem(this.KEYS.activeChar, State.activeChar || '')
      localStorage.setItem(this.KEYS.openPhases, JSON.stringify(State.openPhases))
    } catch(e) {
      console.warn('Não foi possível salvar no localStorage.')
    }
  }
}

// ─── Inicialização ────────────────────────────────────────────
async function init() {
  Storage.load()

  try {
    const res = await fetch('./builds.json')
    const data = await res.json()
    State.characters = data.characters

    // Garante que cada personagem tem um Set de níveis completados
    State.characters.forEach(c => {
      if (!State.completedLevels[c.id]) {
        State.completedLevels[c.id] = new Set()
      }
    })

    // Se não tem personagem ativo salvo, usa o primeiro
    if (!State.activeChar || !State.characters.find(c => c.id === State.activeChar)) {
      State.activeChar = State.characters[0].id
    }

    // Fases abertas por padrão: primeira fase aberta
    State.characters.forEach(c => {
      if (State.openPhases[c.id + '_0'] === undefined) {
        State.openPhases[c.id + '_0'] = true
      }
    })

    buildUI()
    renderActiveChar()
  } catch(err) {
    console.error('Erro ao carregar builds.json:', err)
    document.getElementById('app-root').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar builds</div>
        <div class="empty-sub">Verifique que o arquivo builds.json está na mesma pasta.</div>
      </div>`
  }
}

// ─── Constrói a estrutura base da UI ─────────────────────────
function buildUI() {
  const root = document.getElementById('app-root')
  root.innerHTML = `
    <div class="app-layout">
      <header class="site-header" role="banner">
        <div class="header-inner">
          <div class="site-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Logo DOS2 Build Tracker">
              <polygon points="16,2 28,10 28,22 16,30 4,22 4,10" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <polygon points="16,6 24,11 24,21 16,26 8,21 8,11" stroke="currentColor" stroke-width="0.75" fill="none" opacity="0.4"/>
              <circle cx="16" cy="16" r="3.5" fill="currentColor"/>
              <line x1="16" y1="2"  x2="16" y2="6"  stroke="currentColor" stroke-width="1.5"/>
              <line x1="28" y1="10" x2="24" y2="11" stroke="currentColor" stroke-width="1.5"/>
              <line x1="28" y1="22" x2="24" y2="21" stroke="currentColor" stroke-width="1.5"/>
              <line x1="16" y1="30" x2="16" y2="26" stroke="currentColor" stroke-width="1.5"/>
              <line x1="4"  y1="22" x2="8"  y2="21" stroke="currentColor" stroke-width="1.5"/>
              <line x1="4"  y1="10" x2="8"  y2="11" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <div>
              <div class="logo-text">Build Tracker</div>
              <div class="logo-sub">Divinity Original Sin 2</div>
            </div>
          </div>

          <nav class="char-tabs-wrap" role="tablist" aria-label="Personagens" id="char-tabs"></nav>

          <div class="header-actions">
            <button class="btn-icon" id="btn-toggle-all" title="Expandir/recolher todas as fases" aria-label="Expandir ou recolher todas as fases">
              ⇕
            </button>
            <button class="btn-icon" id="btn-theme" title="Alternar tema claro/escuro" aria-label="Alternar tema claro ou escuro">
              ${State.theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button class="btn-icon" id="btn-reset" title="Resetar progresso deste personagem" aria-label="Resetar progresso">
              ↺
            </button>
          </div>
        </div>
      </header>

      <div class="filters-bar" role="toolbar" aria-label="Filtros">
        <div class="filters-inner">
          <span class="filter-label">Mostrar:</span>
          <div class="filter-chips" id="filter-chips"></div>
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              type="search"
              class="search-input"
              id="search-input"
              placeholder="Buscar skill ou talent…  ( / )"
              aria-label="Buscar skill ou talent"
            />
          </div>
        </div>
      </div>

      <main class="main-content" role="main" id="char-view-container">
        <div class="empty-state">
          <div class="empty-icon">⚔️</div>
          <div class="empty-title">Carregando builds…</div>
        </div>
      </main>
    </div>

    <div class="tooltip-popup" id="tooltip" role="tooltip" aria-hidden="true"></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `

  // Constrói as abas de personagens
  buildCharTabs()

  // Constrói os chips de filtro
  buildFilterChips()

  // Event: troca de personagem
  document.getElementById('char-tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-char-id]')
    if (tab) switchChar(tab.dataset.charId)
  })

  // Event: filtros
  document.getElementById('filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]')
    if (!chip) return
    const f = chip.dataset.filter
    if (f === 'all') {
      State.activeFilters.clear()
      State.activeFilters.add('all')
    } else {
      State.activeFilters.delete('all')
      if (State.activeFilters.has(f)) {
        State.activeFilters.delete(f)
        if (State.activeFilters.size === 0) State.activeFilters.add('all')
      } else {
        State.activeFilters.add(f)
      }
    }
    updateFilterChips()
    applyFilters()
  })

  // Event: busca
  document.getElementById('search-input').addEventListener('input', e => {
    State.searchQuery = e.target.value.toLowerCase().trim()
    applyFilters()
  })

  // Event: reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm(`Resetar todo o progresso de ${getActiveChar().name}?`)) {
      State.completedLevels[State.activeChar] = new Set()
      Storage.save()
      renderActiveChar()
      showToast('Progresso resetado!')
    }
  })

  // Event: alternar tema claro/escuro
  document.getElementById('btn-theme').addEventListener('click', toggleTheme)

  // Event: expandir/recolher todas as fases
  document.getElementById('btn-toggle-all').addEventListener('click', toggleAllPhases)

  // Tooltip global
  setupTooltips()
}

// ─── Abas de personagens ──────────────────────────────────────
function buildCharTabs() {
  const container = document.getElementById('char-tabs')
  container.innerHTML = State.characters.map(c => {
    const total = getTotalLevels(c)
    const done  = State.completedLevels[c.id]?.size || 0
    return `
      <button
        class="char-tab${c.id === State.activeChar ? ' active' : ''}"
        data-char-id="${c.id}"
        style="--char-tab-color: ${c.color}"
        role="tab"
        aria-selected="${c.id === State.activeChar}"
        aria-label="${c.name} — ${c.class}"
      >
        <span class="char-tab-icon" aria-hidden="true">${c.icon}</span>
        <span>${c.name.split(' ')[0]}</span>
        <span class="char-tab-progress">${done}/${total}</span>
      </button>`
  }).join('')
}

// ─── Chips de filtro ──────────────────────────────────────────
function buildFilterChips() {
  const filters = [
    { id: 'all',       label: 'Tudo'        },
    { id: 'attribute', label: '💪 Atributos' },
    { id: 'ability',   label: '📚 Abilities' },
    { id: 'talent',    label: '⭐ Talents'   },
    { id: 'skills',    label: '⚡ Skills'    },
    { id: 'incomplete',label: '⬜ Pendentes' },
    { id: 'complete',  label: '✅ Completos' }
  ]
  document.getElementById('filter-chips').innerHTML = filters.map(f =>
    `<button class="chip${State.activeFilters.has(f.id) ? ' active' : ''}" data-filter="${f.id}">${f.label}</button>`
  ).join('')
}

function updateFilterChips() {
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    chip.classList.toggle('active', State.activeFilters.has(chip.dataset.filter))
  })
}

// ─── Troca de personagem ──────────────────────────────────────
function switchChar(id) {
  State.activeChar = id
  Storage.save()
  buildCharTabs()
  renderActiveChar()
}

// ─── Tema claro/escuro ────────────────────────────────────────
function toggleTheme() {
  State.theme = State.theme === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', State.theme)

  // Atualiza o ícone do botão e a cor da barra do navegador
  const btn = document.getElementById('btn-theme')
  if (btn) btn.textContent = State.theme === 'light' ? '🌙' : '☀️'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', State.theme === 'light' ? '#f3ecdb' : '#0f0e0c')

  try { localStorage.setItem(Storage.KEYS.theme, State.theme) } catch (e) { /* ignore */ }
  showToast(State.theme === 'light' ? '☀️ Tema claro ativado' : '🌙 Tema escuro ativado')
}

// ─── Expandir/recolher todas as fases ─────────────────────────
function toggleAllPhases() {
  const sections = document.querySelectorAll('.phase-section')
  if (!sections.length) return

  // Se houver qualquer fase fechada, abre todas; caso contrário, fecha todas
  const anyClosed = [...sections].some(s => !s.classList.contains('open'))

  sections.forEach(section => {
    const header = section.querySelector('.phase-header')
    const key = header?.dataset.phaseKey
    section.classList.toggle('open', anyClosed)
    if (header) header.setAttribute('aria-expanded', anyClosed)
    if (key) State.openPhases[key] = anyClosed
  })
  Storage.save()
  showToast(anyClosed ? 'Todas as fases expandidas' : 'Todas as fases recolhidas')
}

// ─── Getters ──────────────────────────────────────────────────
function getActiveChar() {
  return State.characters.find(c => c.id === State.activeChar)
}

function getTotalLevels(char) {
  return char.phases.reduce((acc, p) => acc + p.levels.length, 0)
}

function getCompletedCount(charId) {
  return State.completedLevels[charId]?.size || 0
}

function getNextLevel(char) {
  for (const phase of char.phases) {
    for (const lv of phase.levels) {
      if (!State.completedLevels[char.id]?.has(lv.level)) {
        return lv.level
      }
    }
  }
  return null
}

// ─── Renderização do personagem ativo ────────────────────────
function renderActiveChar() {
  const char = getActiveChar()
  if (!char) return

  const container = document.getElementById('char-view-container')
  const total     = getTotalLevels(char)
  const done      = getCompletedCount(char.id)
  const pct       = Math.round((done / total) * 100)
  const nextLv    = getNextLevel(char)

  // Aplica CSS var do personagem na raiz
  document.documentElement.style.setProperty('--char-color', char.color)

  container.innerHTML = `
    <div class="char-view" id="char-view">
      <!-- Header do personagem -->
      <div class="char-header" data-icon="${char.icon}">
        <div>
          <div class="char-name">${char.name}</div>
          <div class="char-class">${char.class} · ${char.role}</div>
          <div class="char-meta">
            <div class="char-meta-item">
              <span class="char-meta-label">Dano</span>
              <span class="char-meta-value">${char.damage_type}</span>
            </div>
            <div class="char-meta-item">
              <span class="char-meta-label">Atributo Principal</span>
              <span class="char-meta-value">${ATTR_ICONS[char.primary_attribute] || ''} ${char.primary_attribute}</span>
            </div>
            <div class="char-meta-item">
              <span class="char-meta-label">Progresso</span>
              <span class="char-meta-value">${done} / ${total} níveis</span>
            </div>
          </div>
          <p class="char-description">${char.description}</p>
        </div>

        <div class="char-progress-panel">
          <div class="progress-ring-wrap">
            <div class="progress-ring">
              <svg viewBox="0 0 90 90">
                <circle class="track" cx="45" cy="45" r="40" />
                <circle class="fill" cx="45" cy="45" r="40"
                  style="stroke-dashoffset: ${251.2 - (251.2 * pct / 100)}"
                />
              </svg>
              <div class="progress-ring-label">
                <span class="progress-pct">${pct}%</span>
                <span class="progress-sub">build</span>
              </div>
            </div>
            <span class="progress-ring-title">Completo</span>
          </div>
          ${nextLv ? `
          <button class="btn-next-level" id="btn-next-focus" data-level="${nextLv}">
            ▶ Nível ${nextLv}
          </button>` : `<div style="font-size:var(--text-xs);color:var(--color-success);text-align:center;font-weight:600">✅ Build Completa!</div>`}
        </div>
      </div>

      <!-- Prioridades da build -->
      <div class="priorities-row">
        <div class="priority-card">
          <div class="priority-title">Prioridade de Atributos</div>
          <div class="priority-tags">
            ${char.priorities.attributes.map((a,i) => `<span class="priority-tag${i===0?' first':''}">${ATTR_ICONS[a]||''} ${a}</span>`).join('')}
          </div>
        </div>
        <div class="priority-card">
          <div class="priority-title">Combat Abilities</div>
          <div class="priority-tags">
            ${char.priorities.abilities.map((a,i) => `<span class="priority-tag${i===0?' first':''}">${a}</span>`).join('')}
          </div>
        </div>
        <div class="priority-card">
          <div class="priority-title">Estratégia de Jogo</div>
          <p class="playstyle-text">"${char.priorities.playstyle}"</p>
        </div>
      </div>

      <!-- Fases / Timeline -->
      <div id="phases-container">
        ${char.phases.map((phase, phaseIdx) => renderPhase(char, phase, phaseIdx)).join('')}
      </div>
    </div>
  `

  // Event: botão "Próximo Nível"
  const btnNext = document.getElementById('btn-next-focus')
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const lv = parseInt(btnNext.dataset.level)
      const card = document.querySelector(`.level-card[data-level="${lv}"]`)
      if (card) {
        // Garante que a fase está aberta
        const phase = card.closest('.phase-section')
        if (phase && !phase.classList.contains('open')) {
          phase.classList.add('open')
        }
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' })
          card.classList.add('next-focus')
        }, 100)
      }
    })
  }

  // Events: collapse/expand de fases
  document.querySelectorAll('.phase-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.phase-section')
      const key = header.dataset.phaseKey
      const isOpen = section.classList.toggle('open')
      State.openPhases[key] = isOpen
      header.setAttribute('aria-expanded', isOpen)
      Storage.save()
    })
  })

  // Events: checkboxes de nível
  document.querySelectorAll('.level-checkbox').forEach(cb => {
    cb.addEventListener('click', e => {
      e.stopPropagation()
      const card  = cb.closest('.level-card')
      const level = parseInt(card.dataset.level)
      toggleLevelCompletion(char.id, level)
    })
  })

  // Highlight next level
  updateNextLevelHighlight(char)

  // Aplica filtros
  applyFilters()
}

// ─── Renderiza uma fase (bloco collapse) ─────────────────────
function renderPhase(char, phase, phaseIdx) {
  const key     = char.id + '_' + phaseIdx
  const isOpen  = State.openPhases[key] !== false  // aberto por padrão
  const total   = phase.levels.length
  const done    = phase.levels.filter(lv => State.completedLevels[char.id]?.has(lv.level)).length
  const pctBar  = Math.round((done / total) * 100)

  return `
    <section class="phase-section${isOpen ? ' open' : ''}" aria-label="${phase.label}">
      <div class="phase-header"
        data-phase-key="${key}"
        role="button"
        tabindex="0"
        aria-expanded="${isOpen}"
        aria-controls="phase-body-${key}"
      >
        <div class="phase-header-left">
          <svg class="phase-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span class="phase-label">${phase.label}</span>
          <span class="phase-tag">${phase.tag}</span>
        </div>
        <div class="phase-meta">
          <div class="phase-progress-bar-wrap" title="${done} de ${total} níveis completos">
            <div class="phase-progress-bar-fill" style="width:${pctBar}%"></div>
          </div>
          <span class="phase-progress-text">${done}/${total}</span>
        </div>
      </div>
      <div class="phase-body" id="phase-body-${key}">
        <div class="phase-body-inner">
          <div class="phase-levels-grid">
            ${phase.levels.map(lv => renderLevelCard(char, lv)).join('')}
          </div>
        </div>
      </div>
    </section>`
}

// ─── Renderiza um card de nível ───────────────────────────────
function renderLevelCard(char, lv) {
  const completed = State.completedLevels[char.id]?.has(lv.level)

  // Filtra o que mostrar no card baseado nas seções
  const showAbilities = lv.abilities && lv.abilities.length > 0
  const showTalent    = lv.talent
  const showSkills    = lv.skills && lv.skills.length > 0

  // Data attributes para filtros
  const filterData = [
    'attribute',
    ...(showAbilities ? ['ability']  : []),
    ...(showTalent    ? ['talent']   : []),
    ...(showSkills    ? ['skills']   : []),
    completed         ? 'complete'   : 'incomplete'
  ].join(' ')

  // Texto pesquisável
  const searchText = [
    lv.attribute,
    ...(lv.abilities || []),
    lv.talent || '',
    ...(lv.skills || []),
    lv.tip || ''
  ].join(' ').toLowerCase()

  return `
    <article
      class="level-card${completed ? ' completed' : ''}"
      data-level="${lv.level}"
      data-char="${char.id}"
      data-filter-types="${filterData}"
      data-search="${searchText}"
      aria-label="Nível ${lv.level}${completed ? ' (completo)' : ''}"
    >
      <div class="level-card-top">
        <div class="level-card-heading">
          <span class="level-badge" aria-hidden="true">${lv.level}</span>
        </div>
        <div class="level-checkbox-wrap">
          <div class="level-checkbox"
            role="checkbox"
            tabindex="0"
            aria-checked="${completed}"
            aria-label="Marcar nível ${lv.level} como completo"
          >
            ${completed ? '✓' : ''}
          </div>
        </div>
      </div>

      <!-- Atributo -->
      <div class="card-row">
        <span class="card-icon" aria-hidden="true">${ATTR_ICONS[lv.attribute] || '📈'}</span>
        <div class="card-content">
          <span class="card-cat">Atributo</span>
          <span class="attr-badge">${lv.attribute} +1</span>
        </div>
      </div>

      ${showAbilities ? `
      <div class="card-row">
        <span class="card-icon" aria-hidden="true">📚</span>
        <div class="card-content">
          <span class="card-cat">Combat Ability</span>
          <div class="ability-tags">
            ${lv.abilities.map(a => `<span class="ability-tag">${a}</span>`).join('')}
          </div>
        </div>
      </div>` : ''}

      ${showTalent ? `
      <div class="card-row">
        <span class="card-icon" aria-hidden="true">⭐</span>
        <div class="card-content">
          <span class="card-cat">Talent</span>
          <span class="talent-badge">✦ ${lv.talent}</span>
        </div>
      </div>` : ''}

      ${showSkills ? `
      <div class="card-row">
        <span class="card-icon" aria-hidden="true">⚡</span>
        <div class="card-content">
          <span class="card-cat">Skills Novas</span>
          <div class="skill-tags">
            ${lv.skills.map(s => `<span class="skill-tag" data-tooltip="${SKILL_TOOLTIPS[s] || 'Skill de ' + char.class}">${s}</span>`).join('')}
          </div>
        </div>
      </div>` : ''}

      ${lv.tip ? `
      <div class="card-divider"></div>
      <div class="card-tip">💡 ${lv.tip}</div>` : ''}
    </article>`
}

// ─── Toggle de nível completo ─────────────────────────────────
function toggleLevelCompletion(charId, level) {
  const set = State.completedLevels[charId]
  if (set.has(level)) {
    set.delete(level)
    showToast(`Nível ${level} desmarcado`)
  } else {
    set.add(level)
    showToast(`✅ Nível ${level} completo!`)
  }
  Storage.save()

  // Atualiza a UI de forma localizada para melhor performance
  updateLevelCard(charId, level)
  updateCharTabProgress(charId)
  updateCharHeader()
}

// Atualiza apenas o card afetado
function updateLevelCard(charId, level) {
  const card = document.querySelector(`.level-card[data-level="${level}"][data-char="${charId}"]`)
  if (!card) return

  const completed = State.completedLevels[charId]?.has(level)
  card.classList.toggle('completed', completed)
  card.setAttribute('aria-label', `Nível ${level}${completed ? ' (completo)' : ''}`)

  const cb = card.querySelector('.level-checkbox')
  if (cb) {
    cb.setAttribute('aria-checked', completed)
    cb.innerHTML = completed ? '✓' : ''
  }

  const badge = card.querySelector('.level-badge')
  if (badge) badge.style.color = completed ? 'var(--color-success)' : 'var(--char-color)'

  // Atualiza barra de progresso da fase
  const phase = card.closest('.phase-section')
  if (phase) {
    const allCards = phase.querySelectorAll('.level-card')
    const doneCards = phase.querySelectorAll('.level-card.completed')
    const total = allCards.length, done = doneCards.length
    const bar = phase.querySelector('.phase-progress-bar-fill')
    const txt = phase.querySelector('.phase-progress-text')
    if (bar) bar.style.width = `${Math.round((done/total)*100)}%`
    if (txt) txt.textContent = `${done}/${total}`
  }

  // Atualiza o highlight do próximo nível
  const char = getActiveChar()
  if (char) updateNextLevelHighlight(char)
}

// Atualiza a aba do personagem
function updateCharTabProgress(charId) {
  const char  = State.characters.find(c => c.id === charId)
  if (!char) return
  const tab   = document.querySelector(`.char-tab[data-char-id="${charId}"] .char-tab-progress`)
  if (tab) {
    const total = getTotalLevels(char)
    const done  = getCompletedCount(charId)
    tab.textContent = `${done}/${total}`
  }
}

// Atualiza o header do personagem (ring + botão)
function updateCharHeader() {
  const char  = getActiveChar()
  if (!char) return
  const total = getTotalLevels(char)
  const done  = getCompletedCount(char.id)
  const pct   = Math.round((done / total) * 100)

  const ring = document.querySelector('.progress-ring .fill')
  if (ring) ring.style.strokeDashoffset = 251.2 - (251.2 * pct / 100)

  const pctEl = document.querySelector('.progress-pct')
  if (pctEl) pctEl.textContent = pct + '%'

  const subEl = document.querySelector('.char-meta-value:last-child')
  // busca o item de progresso
  document.querySelectorAll('.char-meta-item').forEach(item => {
    const label = item.querySelector('.char-meta-label')
    if (label && label.textContent === 'Progresso') {
      item.querySelector('.char-meta-value').textContent = `${done} / ${total} níveis`
    }
  })
}

// ─── Highlight do próximo nível ───────────────────────────────
function updateNextLevelHighlight(char) {
  // Remove highlight anterior
  document.querySelectorAll('.level-card.next-focus').forEach(c => c.classList.remove('next-focus'))
  // Remove pseudo-element de texto
  document.querySelectorAll('.level-card.next-focus').forEach(c => c.classList.remove('next-focus'))

  const nextLv = getNextLevel(char)
  if (nextLv !== null) {
    const card = document.querySelector(`.level-card[data-level="${nextLv}"]`)
    if (card) card.classList.add('next-focus')
  }

  // Atualiza botão
  const btn = document.getElementById('btn-next-focus')
  if (btn) {
    if (nextLv) {
      btn.textContent = `▶ Nível ${nextLv}`
      btn.dataset.level = nextLv
    } else {
      btn.closest('.char-progress-panel').innerHTML += '<div style="font-size:var(--text-xs);color:var(--color-success);font-weight:600;text-align:center">✅ Build Completa!</div>'
      btn.remove()
    }
  }
}

// ─── Filtros e busca ──────────────────────────────────────────
function applyFilters() {
  const cards = document.querySelectorAll('.level-card')
  const filters = State.activeFilters
  const query = State.searchQuery

  cards.forEach(card => {
    const types  = card.dataset.filterTypes || ''
    const search = card.dataset.search || ''
    let show = true

    // Filtro por tipo
    if (!filters.has('all')) {
      const hasMatch = [...filters].some(f => types.includes(f))
      if (!hasMatch) show = false
    }

    // Filtro por busca
    if (show && query) {
      show = search.includes(query)
    }

    card.classList.toggle('hidden-filter', !show)
  })
}

// ─── Tooltips de skills ───────────────────────────────────────
function setupTooltips() {
  const tooltip = document.getElementById('tooltip')
  let hideTimer

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tooltip]')
    if (!el) return
    clearTimeout(hideTimer)

    const text = el.dataset.tooltip
    tooltip.textContent = text
    tooltip.setAttribute('aria-hidden', 'false')

    const rect = el.getBoundingClientRect()
    const ttW  = 200, ttH = 60
    let top  = rect.top  - ttH - 8 + window.scrollY
    let left = rect.left + window.scrollX

    // Evita sair da viewport
    if (left + ttW > window.innerWidth) left = window.innerWidth - ttW - 8
    if (top < window.scrollY + 8) top = rect.bottom + 8 + window.scrollY

    tooltip.style.top  = top  + 'px'
    tooltip.style.left = left + 'px'
    tooltip.classList.add('visible')
  })

  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-tooltip]')
    if (!el) return
    hideTimer = setTimeout(() => {
      tooltip.classList.remove('visible')
      tooltip.setAttribute('aria-hidden', 'true')
    }, 100)
  })

  // Teclado: foco em skill tags
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-tooltip]')
    if (el) el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  })
  document.addEventListener('focusout', e => {
    const el = e.target.closest('[data-tooltip]')
    if (el) tooltip.classList.remove('visible')
  })
}

// ─── Toast notification ───────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2200)
}

// ─── Acessibilidade: teclado nas fases e checkboxes ───────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const header = e.target.closest('.phase-header')
    if (header) { e.preventDefault(); header.click() }

    const cb = e.target.closest('.level-checkbox[role="checkbox"]')
    if (cb) { e.preventDefault(); cb.click() }
  }

  // Navegação por setas entre as abas de personagens (padrão ARIA tablist)
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const tab = e.target.closest('.char-tab[data-char-id]')
    if (tab) {
      e.preventDefault()
      const tabs = [...document.querySelectorAll('.char-tab[data-char-id]')]
      const idx  = tabs.indexOf(tab)
      const next = e.key === 'ArrowRight'
        ? tabs[(idx + 1) % tabs.length]
        : tabs[(idx - 1 + tabs.length) % tabs.length]
      switchChar(next.dataset.charId)
      // Após re-render, devolve o foco à aba correspondente
      const focused = document.querySelector(`.char-tab[data-char-id="${next.dataset.charId}"]`)
      if (focused) focused.focus()
    }
  }
})

// ─── Atalhos globais de teclado ───────────────────────────────
document.addEventListener('keydown', e => {
  const search = document.getElementById('search-input')
  const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'

  // "/" foca a busca (a menos que já esteja digitando)
  if (e.key === '/' && !isTyping) {
    e.preventDefault()
    if (search) search.focus()
  }

  // Esc limpa e desfoca a busca
  if (e.key === 'Escape' && e.target === search) {
    search.value = ''
    State.searchQuery = ''
    applyFilters()
    search.blur()
  }
})

// ─── Start ────────────────────────────────────────────────────
init()
