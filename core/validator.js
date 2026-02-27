/**
 * validator.js
 * Selection checking and win-condition detection for FillWrds.
 *
 * Exported API:
 *   checkSelection(grid, cells, targetWords) → SelectionResult
 *   isGameWon(foundWords, targetWords)       → boolean
 *   normalizeSelection(cells)               → cells | null
 *
 * All functions are pure (no DOM, no side effects).
 */

// ── Types (JSDoc) ─────────────────────────────────────────────────────────────
/**
 * @typedef {{ row: number, col: number }} Cell
 *
 * @typedef {{
 *   valid:      boolean,
 *   found:      boolean,
 *   word:       string | null,
 *   direction:  string | null,
 *   startCell:  Cell | null,
 *   cells:      Cell[],
 * }} SelectionResult
 */

// ── Direction helpers ─────────────────────────────────────────────────────────

const DIRECTION_NAMES = {
  '0,1':   'right',
  '0,-1':  'left',
  '1,0':   'down',
  '-1,0':  'up',
  '1,1':   'down-right',
  '1,-1':  'down-left',
  '-1,1':  'up-right',
  '-1,-1': 'up-left',
};

/**
 * Determine whether a list of cells forms a straight line in one of
 * the 8 allowed directions. Returns { dr, dc, dirName } or null.
 */
function getLineDirection(cells) {
  if (cells.length < 2) {
    // A single cell is trivially valid (direction unknown)
    return { dr: 0, dc: 0, dirName: null };
  }

  const dr = cells[1].row - cells[0].row;
  const dc = cells[1].col - cells[0].col;

  // Validate all consecutive pairs share the same delta
  for (let i = 1; i < cells.length; i++) {
    if (
      cells[i].row - cells[i - 1].row !== dr ||
      cells[i].col - cells[i - 1].col !== dc
    ) {
      return null; // not a straight line
    }
  }

  const dirName = DIRECTION_NAMES[`${dr},${dc}`] ?? null;
  if (dirName === null && cells.length > 1) {
    return null; // not one of the 8 standard directions
  }

  return { dr, dc, dirName };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * normalizeSelection(cells)
 *
 * Validates that the selected cells form a straight line.
 * Returns the cells array if valid, null otherwise.
 * Deduplicates adjacent repeated cells (can happen on fast drags).
 *
 * @param {Cell[]} cells
 * @returns {Cell[] | null}
 */
export function normalizeSelection(cells) {
  if (!cells || cells.length === 0) return null;

  // Deduplicate consecutive identical cells
  const deduped = cells.filter(
    (c, i) => i === 0 || c.row !== cells[i - 1].row || c.col !== cells[i - 1].col
  );

  if (deduped.length === 0) return null;
  if (deduped.length === 1) return deduped; // single cell, allow

  return getLineDirection(deduped) !== null ? deduped : null;
}

/**
 * checkSelection(grid, cells, targetWords)
 *
 * Given a player's cell selection, determine:
 *   - whether the cells form a straight line (valid)
 *   - whether the resulting string matches a target word (or its reverse)
 *
 * Words placed in "left" or "up" directions read right-to-left/bottom-to-top,
 * so we check both the forward and reversed string against targetWords.
 *
 * @param {string[][]} grid         — 2D char grid from generateGrid()
 * @param {Cell[]}     cells        — ordered list of selected cells
 * @param {string[]}   targetWords  — words to find (lowercase)
 *
 * @returns {SelectionResult}
 */
export function checkSelection(grid, cells, targetWords) {
  const EMPTY = { valid: false, found: false, word: null, direction: null, startCell: null, cells: [] };

  const normalized = normalizeSelection(cells);
  if (!normalized) return EMPTY;

  // Bounds check every cell
  const size = grid.length;
  for (const { row, col } of normalized) {
    if (row < 0 || row >= size || col < 0 || col >= size) return EMPTY;
  }

  // Build the string from selected cells
  const selected = normalized.map(({ row, col }) => grid[row][col]).join('');
  const reversed = selected.split('').reverse().join('');

  // Build a lowercase Set for O(1) lookup
  const targetSet = new Set(targetWords.map(w => w.toLowerCase()));

  let matchedWord  = null;
  let matchedCells = normalized;

  if (targetSet.has(selected.toLowerCase())) {
    matchedWord = selected.toLowerCase();
  } else if (targetSet.has(reversed.toLowerCase())) {
    // Word was placed in a "backwards" direction — return cells in word order
    matchedWord  = reversed.toLowerCase();
    matchedCells = [...normalized].reverse();
  }

  if (!matchedWord) {
    return { valid: true, found: false, word: null, direction: null, startCell: null, cells: normalized };
  }

  const lineDir = getLineDirection(matchedCells);
  return {
    valid:     true,
    found:     true,
    word:      matchedWord,
    direction: lineDir?.dirName ?? null,
    startCell: matchedCells[0],
    cells:     matchedCells,
  };
}

/**
 * isGameWon(foundWords, targetWords)
 *
 * Returns true when every target word has been found.
 * Comparison is case-insensitive.
 *
 * @param {string[]} foundWords
 * @param {string[]} targetWords
 * @returns {boolean}
 */
export function isGameWon(foundWords, targetWords) {
  if (targetWords.length === 0) return false;
  const found = new Set(foundWords.map(w => w.toLowerCase()));
  return targetWords.every(w => found.has(w.toLowerCase()));
}
