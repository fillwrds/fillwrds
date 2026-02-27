/**
 * <game-board> Web Component
 *
 * Renders the fillwords letter grid and handles player selection via
 * mouse/touch drag and keyboard navigation.
 *
 * Properties:
 *   grid         {string[][]}  — 2D char array from generateGrid()
 *   targetWords  {string[]}    — words to find (used by validator)
 *
 * Methods:
 *   setGrid(grid, targetWords) — load a new puzzle
 *   showLoading()              — overlay spinner while fetching
 *   hideLoading()              — remove spinner
 *   reset()                    — clear board to empty state
 *
 * Events dispatched (bubble + composed):
 *   word-found   — CustomEvent({ detail: { word, cells, direction } })
 *   word-invalid — CustomEvent({ detail: { cells } })
 */

import { checkSelection } from '../../core/validator.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
  }

  .board-wrap {
    width: 100%;
    max-width: min(90vw, 560px);
    aspect-ratio: 1;
    position: relative;
  }

  /* ── Loading overlay ── */
  .loading-overlay {
    display: none;
    position: absolute;
    inset: 0;
    background: var(--color-overlay);
    border-radius: 12px;
    z-index: 10;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: .75rem;
  }

  .loading-overlay.visible {
    display: flex;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-progress-bg);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }

  .loading-label {
    font-size: .85rem;
    color: #6b7280;
    font-weight: 500;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Grid ── */
  .grid {
    display: grid;
    width: 100%;
    height: 100%;
    gap: 2px;
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    background: var(--color-cell-bg);
    border: 1px solid var(--color-border);
    font-size: clamp(.55rem, 2.2vw, 1rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .02em;
    color: var(--color-text);
    cursor: pointer;
    transition:
      background 80ms ease,
      border-color 80ms ease,
      color 80ms ease,
      transform 60ms ease;
    touch-action: none;
    -webkit-touch-callout: none;
    outline: none;
  }

  /* Keyboard focus ring — visible only on keyboard nav */
  .cell:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
    z-index: 2;
  }

  .cell:hover {
    background: var(--color-cell-hover);
    border-color: var(--color-cell-hover-border);
  }

  /* Active drag / keyboard selection */
  .cell.selecting {
    background: var(--color-cell-select);
    border-color: var(--color-cell-select-border);
    color: var(--color-cell-select-text);
    transform: scale(1.08);
    z-index: 1;
  }

  /* Keyboard-selection anchor cell */
  .cell.kbd-anchor {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }

  /* Permanently found — with a brief pop animation */
  .cell.found {
    background: var(--color-found);
    border-color: var(--color-found-border);
    color: var(--color-found-text);
    animation: cell-pop 280ms cubic-bezier(.175,.885,.32,1.275);
  }

  @keyframes cell-pop {
    0%   { transform: scale(1);    }
    50%  { transform: scale(1.18); }
    100% { transform: scale(1);    }
  }

  /* Brief flash on invalid selection */
  .cell.invalid {
    background: var(--color-invalid);
    border-color: var(--color-invalid-border);
    color: var(--color-invalid-text);
  }

  /* Empty / no puzzle loaded */
  .empty-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    max-width: min(90vw, 560px);
    background: var(--color-bg);
    border: 2px dashed var(--color-border);
    border-radius: 16px;
    color: var(--color-text-muted);
    font-size: 1rem;
    text-align: center;
    padding: 2rem;
  }

  /* Row wrapper — invisible to CSS grid but required for ARIA role="row" */
  .row {
    display: contents;
  }
</style>

<div class="empty-msg" role="status">Press <strong>&nbsp;New Game&nbsp;</strong> to start playing!</div>
`;

const INVALID_FLASH_MS = 500;

// Arrow key → [dr, dc]
const ARROW_DIRS = {
  ArrowUp:    [-1,  0],
  ArrowDown:  [ 1,  0],
  ArrowLeft:  [ 0, -1],
  ArrowRight: [ 0,  1],
};

class GameBoard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._grid        = [];
    this._targetWords = [];
    this._selecting   = false;
    this._selCells    = [];
    this._foundCells  = new Set();

    // Keyboard selection state
    this._kbdMode     = false;   // keyboard-selection active?
    this._kbdAnchor   = null;    // { row, col } — first cell of kbd selection
    this._focusedCell = null;    // { row, col } — currently keyboard-focused cell

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp   = this._onPointerUp.bind(this);
    this._onKeyDown     = this._onKeyDown.bind(this);
  }

  connectedCallback() {
    window.addEventListener('pointerup',   this._onPointerUp);
    window.addEventListener('pointermove', this._onPointerMove);
  }

  disconnectedCallback() {
    window.removeEventListener('pointerup',   this._onPointerUp);
    window.removeEventListener('pointermove', this._onPointerMove);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setGrid(grid, targetWords) {
    this._grid        = grid;
    this._targetWords = targetWords;
    this._selCells    = [];
    this._selecting   = false;
    this._foundCells  = new Set();
    this._kbdMode     = false;
    this._kbdAnchor   = null;
    this._focusedCell = null;
    this._render();
  }

  showLoading() {
    const overlay = this.shadowRoot.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.add('visible');
      return;
    }
    // Board not rendered yet — build a minimal loading placeholder
    const styleNode = template.content.cloneNode(true).querySelector('style');
    const wrap = document.createElement('div');
    wrap.className = 'board-wrap';
    wrap.style.cssText = 'position:relative;aspect-ratio:1;border-radius:16px;border:2px dashed #d1d5db;';
    const ov = this._makeOverlay();
    ov.classList.add('visible');
    wrap.appendChild(ov);
    this.shadowRoot.replaceChildren(styleNode, wrap);
  }

  hideLoading() {
    this.shadowRoot.querySelector('.loading-overlay')?.classList.remove('visible');
  }

  reset() {
    this._grid        = [];
    this._targetWords = [];
    this._selCells    = [];
    this._foundCells  = new Set();
    this._kbdMode     = false;
    this._kbdAnchor   = null;
    const clone = template.content.cloneNode(true);
    this.shadowRoot.replaceChildren(...clone.childNodes);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    const size = this._grid.length;

    const wrap = document.createElement('div');
    wrap.className = 'board-wrap';

    // Loading overlay (hidden by default, revealed by showLoading())
    wrap.appendChild(this._makeOverlay());

    const gridEl = document.createElement('div');
    gridEl.className = 'grid';
    gridEl.setAttribute('role', 'grid');
    gridEl.setAttribute('aria-label', 'Word search grid');
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gridEl.style.gridTemplateRows    = `repeat(${size}, 1fr)`;

    for (let r = 0; r < size; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'row';
      rowEl.setAttribute('role', 'row');

      for (let c = 0; c < size; c++) {
        const letter = this._grid[r][c];
        const cell = document.createElement('div');
        cell.className   = 'cell';
        cell.textContent = letter;
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', r === 0 && c === 0 ? '0' : '-1');
        cell.setAttribute('aria-label', `${letter}, row ${r + 1}, column ${c + 1}`);

        cell.addEventListener('pointerdown', this._onPointerDown);
        cell.addEventListener('keydown', this._onKeyDown);
        cell.addEventListener('focus', () => {
          this._focusedCell = { row: r, col: c };
        });

        rowEl.appendChild(cell);
      }
      gridEl.appendChild(rowEl);
    }

    wrap.appendChild(gridEl);

    // Extract just the <style> from the template and pair with the new grid
    const styleNode = template.content.cloneNode(true).querySelector('style');
    this.shadowRoot.replaceChildren(styleNode, wrap);
  }

  _makeOverlay() {
    const ov = document.createElement('div');
    ov.className = 'loading-overlay';
    ov.setAttribute('aria-live', 'polite');
    ov.setAttribute('aria-label', 'Loading puzzle');
    ov.innerHTML = `
      <div class="spinner" aria-hidden="true"></div>
      <span class="loading-label">Fetching words…</span>
    `;
    return ov;
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  _onKeyDown(e) {
    const size = this._grid.length;
    if (!this._focusedCell) return;
    const { row, col } = this._focusedCell;

    // Arrow keys — move focus
    if (ARROW_DIRS[e.key]) {
      e.preventDefault();
      const [dr, dc] = ARROW_DIRS[e.key];
      const nr = Math.max(0, Math.min(size - 1, row + dr));
      const nc = Math.max(0, Math.min(size - 1, col + dc));

      // In kbd-selection mode extend the selection trail
      if (this._kbdMode) {
        const nextCell = { row: nr, col: nc };
        this._extendKbdSelection(nextCell);
      }

      this._focusCell(nr, nc);
      return;
    }

    // Space / Enter — toggle kbd-selection mode or commit
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!this._kbdMode) {
        // Start kbd selection at focused cell
        this._kbdMode   = true;
        this._kbdAnchor = { row, col };
        this._selCells  = [{ row, col }];
        this._getCellEl(row, col)?.classList.add('selecting', 'kbd-anchor');
      } else {
        // Commit selection
        this._kbdMode   = false;
        this._kbdAnchor = null;
        if (this._selCells.length >= 2) {
          this._validateSelection();
        } else {
          this._clearSelectionHighlight();
          this._selCells = [];
        }
      }
      return;
    }

    // Escape — cancel kbd selection
    if (e.key === 'Escape') {
      if (this._kbdMode) {
        this._kbdMode   = false;
        this._kbdAnchor = null;
        this._clearSelectionHighlight();
        this._selCells  = [];
      }
    }
  }

  _extendKbdSelection({ row, col }) {
    // Build straight-line selection from anchor to target
    const anchor = this._kbdAnchor;
    if (!anchor) return;

    // No movement — nothing to extend
    if (row === anchor.row && col === anchor.col) return;

    // Clear existing selection highlight (except anchor)
    this._clearSelectionHighlight();

    const dr = Math.sign(row - anchor.row);
    const dc = Math.sign(col - anchor.col);
    const steps = Math.max(Math.abs(row - anchor.row), Math.abs(col - anchor.col));

    const cells = [];
    for (let i = 0; i <= steps; i++) {
      cells.push({ row: anchor.row + i * dr, col: anchor.col + i * dc });
    }

    this._selCells = cells;
    for (const c of cells) {
      const el = this._getCellEl(c.row, c.col);
      if (el) el.classList.add('selecting');
    }
    // Re-add anchor marker
    this._getCellEl(anchor.row, anchor.col)?.classList.add('kbd-anchor');
  }

  _focusCell(row, col) {
    // Update tabindex: roving tabindex pattern
    const prev = this._focusedCell;
    if (prev) {
      const prevEl = this._getCellEl(prev.row, prev.col);
      if (prevEl) prevEl.tabIndex = -1;
    }
    const el = this._getCellEl(row, col);
    if (el) {
      el.tabIndex = 0;
      el.focus();
    }
  }

  // ── Pointer / Touch event handling ─────────────────────────────────────────

  _onPointerDown(e) {
    e.preventDefault();
    // Cancel any active keyboard selection
    if (this._kbdMode) {
      this._kbdMode = false;
      this._kbdAnchor = null;
      this._clearSelectionHighlight();
      this._selCells = [];
    }

    const el = e.target;
    if (!el || !el.classList.contains('cell')) return;
    const row = parseInt(el.dataset.row, 10);
    const col = parseInt(el.dataset.col, 10);

    this._selecting = true;
    this._selCells  = [{ row, col }];
    this._clearSelectionHighlight();
    el.classList.add('selecting');
  }

  _onPointerMove(e) {
    if (!this._selecting) return;
    e.preventDefault();

    // Use elementFromPoint so both mouse drag and touch slide work correctly
    const el = this.shadowRoot.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.classList.contains('cell')) return;

    const row = parseInt(el.dataset.row, 10);
    const col = parseInt(el.dataset.col, 10);

    const last = this._selCells[this._selCells.length - 1];
    if (last && last.row === row && last.col === col) return;

    // Backtracking
    if (this._selCells.length >= 2) {
      const prev = this._selCells[this._selCells.length - 2];
      if (prev.row === row && prev.col === col) {
        const removed = this._selCells.pop();
        this._getCellEl(removed.row, removed.col)?.classList.remove('selecting');
        return;
      }
    }

    this._selCells.push({ row, col });
    el.classList.add('selecting');
  }

  _onPointerUp(e) {
    if (!this._selecting) return;
    this._selecting = false;

    if (this._selCells.length < 2) {
      this._clearSelectionHighlight();
      this._selCells = [];
      return;
    }

    this._validateSelection();
  }

  // ── Validation & events ────────────────────────────────────────────────────

  _validateSelection() {
    const result = checkSelection(this._grid, this._selCells, this._targetWords);

    if (result.found) {
      for (const { row, col } of result.cells) {
        this._foundCells.add(`${row},${col}`);
        const el = this._getCellEl(row, col);
        if (el) {
          el.classList.remove('selecting', 'kbd-anchor');
          el.classList.add('found');
          el.setAttribute('aria-label',
            `${el.textContent.trim()}, row ${row + 1}, column ${col + 1}, found`);
        }
      }

      this.dispatchEvent(new CustomEvent('word-found', {
        bubbles: true, composed: true,
        detail:  { word: result.word, cells: result.cells, direction: result.direction },
      }));
    } else {
      for (const { row, col } of this._selCells) {
        this._getCellEl(row, col)?.classList.add('invalid');
      }
      const toFlash = [...this._selCells];
      setTimeout(() => {
        for (const { row, col } of toFlash) {
          const el = this._getCellEl(row, col);
          if (el) {
            el.classList.remove('invalid', 'selecting', 'kbd-anchor');
            if (this._foundCells.has(`${row},${col}`)) el.classList.add('found');
          }
        }
      }, INVALID_FLASH_MS);

      this.dispatchEvent(new CustomEvent('word-invalid', {
        bubbles: true, composed: true,
        detail:  { cells: this._selCells },
      }));
    }

    this._selCells = [];
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _clearSelectionHighlight() {
    for (const { row, col } of this._selCells) {
      const el = this._getCellEl(row, col);
      if (el) {
        el.classList.remove('selecting', 'kbd-anchor');
        if (this._foundCells.has(`${row},${col}`)) el.classList.add('found');
      }
    }
  }

  _getCellEl(row, col) {
    return this.shadowRoot.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }
}

customElements.define('game-board', GameBoard);
