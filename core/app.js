/**
 * app.js
 * Main application controller for FillWrds.
 *
 * Orchestrates:
 *   - Language and level picker events
 *   - Word fetching (API → cache fallback → dedup)
 *   - Grid generation
 *   - Game-board and word-list updates
 *   - Win detection and iteration recording
 */

import { fetchWords }                    from '../services/word-api.js';
import { getWords, addWords,
         recordIteration }               from '../services/word-store.js';
import { generateGrid }                  from './grid.js';
import { isGameWon }                     from './validator.js';
import { getLevel }                      from './levels.js';

// ── DOM references ─────────────────────────────────────────────────────────────

const langSelect       = document.querySelector('lang-select');
const levelSelect      = document.querySelector('level-select');
const themeSelect      = document.querySelector('theme-select');
const wordList         = document.querySelector('word-list');
const gameBoard        = document.querySelector('game-board');
const winModal         = document.querySelector('win-modal');
const btnStart         = document.getElementById('btn-start');
const customWordsInput = document.getElementById('custom-words');
const btnClearWords    = document.getElementById('btn-clear-words');

// ── App state ──────────────────────────────────────────────────────────────────

const state = {
  lang:        'en',
  level:       'easy',
  gameLang:    'en',   // lang/level actually used for the active game
  gameLevel:   'easy', // (may differ from lang/level if user changed mid-game)
  words:       [],      // words placed in current puzzle
  foundWords:  [],      // words found so far this game
  gameActive:  false,
  startTime:   null,
};

// ── Game flow ──────────────────────────────────────────────────────────────────

/** Parse the custom-words textarea into a clean word array. */
function parseCustomWords(raw) {
  return raw
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2);
}

async function startGame() {
  if (state.gameActive) endGame(false); // silently end previous game

  // Snapshot lang/level now — async awaits below must all use the same values.
  // Without this, a lang-changed event mid-fetch causes addWords/getWords to use
  // a different language than fetchWords, mixing words from different languages.
  const lang  = state.lang;
  const level = state.level;

  const levelCfg  = getLevel(level);
  const { wordCount, gridSize } = levelCfg;

  setLoading(true);

  let words = [];

  // Check for custom words first
  const customWords = parseCustomWords(customWordsInput?.value ?? '');

  if (customWords.length > 0) {
    // Use custom words directly — skip API and cache entirely
    if (customWords.length < 2) {
      setLoading(false);
      showError('Enter at least 2 words separated by commas.');
      return;
    }
    words = customWords;
  } else {
    // 1. Try fetching fresh words from the API
    try {
      const fetched = await fetchWords(lang, level, wordCount * 2);
      // 2. Persist newly fetched words into the cache
      await addWords(lang, level, fetched);
    } catch (err) {
      console.warn('[app] Word API unavailable, using cache only:', err.message);
    }

    // 3. Pull deduplicated words from cache (excludes last 20 iterations)
    words = await getWords(lang, level, wordCount);

    if (words.length < 3) {
      setLoading(false);
      showError('Not enough words available. Check your connection and try again.');
      return;
    }
  }

  // 4. Generate the grid
  const { grid, placements, skipped } = generateGrid(words, gridSize, lang);

  if (skipped.length > 0) {
    console.info('[app] Words skipped during placement:', skipped);
  }

  // Only use words that were actually placed
  const placedWords = placements.map(p => p.word);

  // 5. Update state
  state.gameLang   = lang;
  state.gameLevel  = level;
  state.words      = placedWords;
  state.foundWords = [];
  state.gameActive = true;
  state.startTime  = Date.now();

  // 6. Update components
  wordList.reset(placedWords);
  gameBoard.setGrid(grid, placedWords);

  setLoading(false);
  btnStart.textContent = 'New Game';
}

function endGame(won) {
  state.gameActive = false;

  if (won) {
    const elapsed = Math.round((Date.now() - state.startTime) / 1000);
    recordIteration(state.gameLang, state.gameLevel, state.words).catch(console.warn);
    winModal.show({ words: state.words, elapsed });
  }
}

// ── Event handlers ─────────────────────────────────────────────────────────────

btnStart.addEventListener('click', () => startGame());

document.addEventListener('theme-changed', (e) => {
  applyTheme(e.detail.theme);
  localStorage.setItem('fillwrds-theme', e.detail.theme);
});

document.addEventListener('lang-changed', (e) => {
  state.lang = e.detail.lang;
  localStorage.setItem('fillwrds-lang', state.lang);
});

document.addEventListener('level-changed', (e) => {
  state.level = e.detail.level;
  localStorage.setItem('fillwrds-level', state.level);
});

btnClearWords?.addEventListener('click', () => {
  if (customWordsInput) {
    customWordsInput.value = '';
    customWordsInput.focus();
  }
});

document.addEventListener('word-found', (e) => {
  if (!state.gameActive) return;

  const { word } = e.detail;
  if (state.foundWords.includes(word)) return;

  state.foundWords.push(word);
  wordList.markFound(word);
  showToast(`✓ ${word.toUpperCase()}`, 'found');

  if (isGameWon(state.foundWords, state.words)) {
    endGame(true);
  }
});

document.addEventListener('play-again', () => startGame());

// word-invalid events are handled entirely by <game-board> (flash animation)
// No app-level action needed.

// ── UI helpers ─────────────────────────────────────────────────────────────────

function setLoading(on) {
  const label = btnStart.querySelector('.btn-label');
  btnStart.disabled = on;
  btnStart.classList.toggle('loading', on);
  if (label) label.textContent = on ? 'Loading…' : 'New Game';
  if (on) {
    gameBoard.showLoading();
  } else {
    gameBoard.hideLoading();
  }
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function showError(msg) {
  if (winModal && typeof winModal.showError === 'function') {
    winModal.showError(msg);
  } else {
    alert(msg);
  }
}

const toastContainer = document.getElementById('toast-container');

function showToast(text, type = '') {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast${type ? ' toast-' + type : ''}`;
  el.textContent = text;
  toastContainer.appendChild(el);
  // Remove after animation completes (180ms in + 1400ms hold + 300ms out)
  setTimeout(() => el.remove(), 1900);
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Restore lang/level from localStorage, falling back to HTML attribute defaults
const VALID_LANGS   = ['en', 'ru', 'be', 'uk'];
const VALID_LEVELS  = ['easy', 'medium', 'hard'];
const VALID_THEMES  = ['system', 'light', 'dark'];

const savedLang  = localStorage.getItem('fillwrds-lang');
const savedLevel = localStorage.getItem('fillwrds-level');
const savedTheme = localStorage.getItem('fillwrds-theme');

const initLang  = (savedLang  && VALID_LANGS.includes(savedLang))   ? savedLang  : (langSelect?.getAttribute('selected-lang')   ?? 'en');
const initLevel = (savedLevel && VALID_LEVELS.includes(savedLevel)) ? savedLevel : (levelSelect?.getAttribute('selected-level') ?? 'easy');
const initTheme = (savedTheme && VALID_THEMES.includes(savedTheme)) ? savedTheme : 'system';

state.lang  = initLang;
state.level = initLevel;
langSelect.selectedLang    = initLang;
levelSelect.selectedLevel  = initLevel;
themeSelect.selectedTheme  = initTheme;
applyTheme(initTheme);

console.info('[FillWrds] App ready. Press "New Game" to start.');
