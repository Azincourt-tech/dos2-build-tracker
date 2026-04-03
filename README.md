# DOS2 Build Tracker

Guia visual interativo de progressão de builds para **Divinity: Original Sin 2**.

## Como usar

1. Abra o `index.html` diretamente no navegador (ou suba para GitHub Pages)
2. Selecione um personagem no menu superior
3. Marque os checkboxes dos níveis conforme você progride no jogo
4. Use os filtros para ver apenas Atributos, Talents, Skills ou níveis pendentes
5. Clique em **"▶ Nível X"** para ir direto ao próximo nível recomendado

## Personagens incluídos

| Personagem | Classe | Foco |
|---|---|---|
| 🏹 Ifan ben-Mezd | Ranger | DPS Ranged |
| ⚔️ Red Prince | Juggernaut | Tank / DPS Melee |
| 🗡️ Sebille | Duelista Rogue | Assassina |
| ✨ Lohse | Elusive Enchanter | Suporte / Controle |

## Estrutura de arquivos

```
dos2-builds/
├── index.html      — Ponto de entrada
├── style.css       — Estilos (dark theme DOS2)
├── script.js       — Lógica dinâmica (sem frameworks)
└── builds.json     — Dados das builds em JSON
```

## Para adicionar um personagem

Edite o arquivo `builds.json` e adicione um novo objeto no array `characters` seguindo a estrutura existente.

## Deploy no GitHub Pages

1. Crie um repositório no GitHub
2. Faça upload dos 4 arquivos
3. Vá em Settings → Pages → Source: main branch / root
4. Pronto! O tracker estará disponível em `https://seuusuario.github.io/nome-do-repo`

## Progresso salvo

O tracker salva automaticamente o progresso no `localStorage` do navegador.
