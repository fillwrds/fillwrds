# FillWrds

A browser-based **Fillwords** (word search) puzzle game built with raw HTML, Web Components, and Shadow DOM — no framework, no backend required.

## Features

- **Multiple difficulty levels** — levels scale by word length and complexity (easy: short/common words, hard: long/rare words)
- **Multi-language support** — English, Russian, Belarusian, Ukrainian
- **Live word fetching** — words are sourced from open public APIs per language
- **Word collection cache** — fetched words are stored locally (IndexedDB) for reuse and offline play
- **Duplicate prevention** — tracks the last 20 game iterations to avoid repeating words
- **No backend** — all game logic and storage runs entirely in the browser

## Tech Stack

| Layer | Choice |
|-------|--------|
| UI | Raw HTML5 + CSS |
| Components | Web Components (Custom Elements + Shadow DOM) |
| Storage | IndexedDB (via local wrapper) |
| Word source | Open APIs (language-specific, no auth required) |
| Build | None — plain static files |

## Project Structure (planned)

```
fillwrds/
├── index.html          # Entry point
├── components/         # Web Components
│   ├── game-board/     # Grid rendering
│   ├── word-list/      # Target words display
│   ├── level-select/   # Difficulty picker
│   └── lang-select/    # Language picker
├── core/               # Game logic (pure JS)
│   ├── grid.js         # Grid generation & word placement
│   ├── levels.js       # Level definitions
│   └── validator.js    # Win condition check
├── services/           # External integrations
│   ├── word-api.js     # Fetch words from open APIs
│   └── word-store.js   # IndexedDB cache + dedup logic
├── styles/             # Global styles
└── assets/             # Icons, fonts
```

## Difficulty Levels

| Level | Word length | Pool size |
|-------|-------------|-----------|
| Easy | 3–5 letters | 10 words |
| Medium | 5–8 letters | 15 words |
| Hard | 8+ letters | 20 words |

## Supported Languages & Word APIs

| Language | API |
|----------|-----|
| English | [Random Word API](https://random-word-api.herokuapp.com) / [WordsAPI](https://www.wordsapi.com) |
| Russian | Open Russian corpus / Wiktionary API |
| Belarusian | Wiktionary API |
| Ukrainian | Wiktionary API |

## Word Cache & Deduplication

- All fetched words are persisted in **IndexedDB** keyed by language + level
- Before each game, used-word history (last **20 iterations**) is checked
- Words appearing in recent history are excluded from the current puzzle pool
- Cache is refreshed automatically when the pool runs low

## Getting Started

No build step needed — open `index.html` directly in a modern browser, or serve with any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Browser Support

Requires a browser with Web Components support (all modern browsers: Chrome, Firefox, Safari, Edge).

## License

MIT
