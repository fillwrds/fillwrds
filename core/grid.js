/**
 * grid.js
 * Core grid generation engine for FillWrds.
 *
 * Exported API:
 *   generateGrid(words, gridSize, lang) → { grid, placements }
 *   DIRECTIONS                          → all 8 direction vectors
 *
 * All functions are pure (no DOM, no side effects).
 */

import { randomChar } from './alphabets.js';

// ── Direction vectors ─────────────────────────────────────────────────────────

/** All 8 directions as [rowDelta, colDelta]. */
export const DIRECTIONS = [
  [ 0,  1],  // right
  [ 0, -1],  // left
  [ 1,  0],  // down
  [-1,  0],  // up
  [ 1,  1],  // down-right
  [ 1, -1],  // down-left
  [-1,  1],  // up-right
  [-1, -1],  // up-left
];

const DIRECTION_NAMES = [
  'right', 'left', 'down', 'up',
  'down-right', 'down-left', 'up-right', 'up-left',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create an empty size×size grid filled with null. */
function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

/** Deep-copy a 2D grid. */
function copyGrid(grid) {
  return grid.map(row => [...row]);
}

/** Fisher-Yates shuffle (returns new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Check whether `word` fits in the grid starting at (row, col)
 * going in direction [dr, dc], without conflicting with existing letters.
 *
 * A cell is allowed if it is:
 *   - empty (null), or
 *   - already occupied by the same letter (natural crossing)
 */
function canPlace(grid, word, row, col, dr, dc) {
  const size = grid.length;
  for (let i = 0; i < word.length; i++) {
    const r = row + i * dr;
    const c = col + i * dc;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    if (grid[r][c] !== null && grid[r][c] !== word[i]) return false;
  }
  return true;
}

/**
 * Write `word` into the grid at (row, col) in direction [dr, dc].
 * Mutates the grid in place.
 */
function placeWord(grid, word, row, col, dr, dc) {
  for (let i = 0; i < word.length; i++) {
    grid[row + i * dr][col + i * dc] = word[i];
  }
}

/**
 * Try to place a single word into the grid.
 * Randomly tries positions and directions until one works or MAX_ATTEMPTS reached.
 *
 * Returns a placement descriptor or null on failure.
 */
function tryPlaceWord(grid, word, maxAttempts = 200) {
  const size = grid.length;
  const dirs = shuffle(DIRECTIONS.map((d, i) => ({ d, name: DIRECTION_NAMES[i] })));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = Math.floor(Math.random() * size);
    const col = Math.floor(Math.random() * size);
    const { d: [dr, dc], name } = dirs[attempt % dirs.length];

    if (canPlace(grid, word, row, col, dr, dc)) {
      placeWord(grid, word, row, col, dr, dc);
      return {
        word,
        row,
        col,
        direction: name,
        dr,
        dc,
        cells: Array.from({ length: word.length }, (_, i) => ({
          row: row + i * dr,
          col: col + i * dc,
        })),
      };
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * generateGrid(words, gridSize, lang)
 *
 * Places `words` into a gridSize×gridSize letter grid.
 * Fills remaining cells with random filler characters for the given language.
 *
 * Words that cannot be placed after MAX_ATTEMPTS are dropped gracefully
 * (the caller receives the subset that was actually placed).
 *
 * @param {string[]} words      — list of words to hide in the grid
 * @param {number}   gridSize   — grid dimension (e.g. 10 for 10×10)
 * @param {string}   lang       — language code ('en'|'ru'|'be'|'uk')
 *
 * @returns {{
 *   grid:       string[][],   — 2D array of single characters
 *   placements: Placement[],  — metadata for each placed word
 *   skipped:    string[],     — words that could not be placed
 * }}
 */
export function generateGrid(words, gridSize, lang = 'en') {
  const grid = createEmptyGrid(gridSize);
  const placements = [];
  const skipped    = [];

  // Sort longest words first — harder to place, so give them priority
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    const lower = word.toLowerCase();

    // Sanity: skip words longer than the grid diagonal
    const maxLength = Math.floor(Math.sqrt(2) * gridSize);
    if (lower.length > maxLength) {
      skipped.push(word);
      continue;
    }

    const placement = tryPlaceWord(grid, lower);
    if (placement) {
      placements.push(placement);
    } else {
      skipped.push(word);
    }
  }

  // Fill empty cells with random filler characters
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = randomChar(lang);
      }
    }
  }

  return { grid, placements, skipped };
}

/**
 * cellsForWord(placement)
 * Convenience: returns just the cell coordinates for a placement.
 * (placements already contain `.cells`, this is just a named alias)
 *
 * @param {Placement} placement
 * @returns {{ row: number, col: number }[]}
 */
export function cellsForWord(placement) {
  return placement.cells;
}

/**
 * buildCellIndex(placements)
 * Returns a Map keyed by "row,col" → word, for fast lookup during validation.
 *
 * @param {Placement[]} placements
 * @returns {Map<string, string>}
 */
export function buildCellIndex(placements) {
  const index = new Map();
  for (const p of placements) {
    for (const { row, col } of p.cells) {
      index.set(`${row},${col}`, p.word);
    }
  }
  return index;
}
