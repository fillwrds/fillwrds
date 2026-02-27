/**
 * <word-list> Web Component
 *
 * Displays the list of target words for the current puzzle.
 * Found words are highlighted and struck through.
 *
 * Properties:
 *   words  {string[]}  — full list of words to find
 *   found  {string[]}  — words already found (subset of words)
 *
 * Methods:
 *   markFound(word)    — mark a single word as found, re-renders that item
 *   reset(words)       — replace word list and clear found state
 *
 * Usage:
 *   <word-list></word-list>
 *   el.words = ['cat', 'dog', 'bird'];
 *   el.markFound('cat');
 */

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: block;
  }

  .section-label {
    font-size: .72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--color-text-muted);
    margin-bottom: .6rem;
  }

  .progress {
    font-size: .75rem;
    color: var(--color-text-muted);
    margin-bottom: .75rem;
  }

  .progress-bar {
    height: 4px;
    background: var(--color-progress-bg);
    border-radius: 999px;
    overflow: hidden;
    margin-top: .3rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 999px;
    transition: width 300ms ease;
    width: 0%;
  }

  .word-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: .35rem .5rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .word-item {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .88rem;
    padding: .25rem .4rem;
    border-radius: 5px;
    transition: background 200ms ease, color 200ms ease;
    overflow: hidden;
  }

  .word-item .check {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .6rem;
    transition: background 200ms ease, border-color 200ms ease;
  }

  .word-item .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: .04em;
    font-weight: 500;
    transition: color 200ms ease, text-decoration 200ms ease;
  }

  /* Found state */
  .word-item.found {
    background: var(--color-found-bg);
  }

  .word-item.found .text {
    color: var(--color-found-text);
    text-decoration: line-through;
    text-decoration-color: var(--color-found-border);
  }

  .word-item.found .check {
    background: var(--color-found-border);
    border-color: var(--color-found-border);
    color: #fff;
  }

  /* Empty state */
  .empty {
    font-size: .85rem;
    color: var(--color-text-muted);
    font-style: italic;
    padding: .5rem 0;
  }
</style>

<p class="section-label">Words to find</p>
<div class="progress">
  <span class="progress-text">0 / 0 found</span>
  <div class="progress-bar"><div class="progress-fill"></div></div>
</div>
<ul class="word-grid" aria-label="Words to find"></ul>
`;

class WordList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._words = [];
    this._found = new Set();
  }

  // ── Properties ────────────────────────────────────────────────────────────

  get words() { return this._words; }

  set words(list) {
    this._words = Array.isArray(list) ? list.map(w => w.toLowerCase()) : [];
    this._found.clear();
    this._render();
  }

  get found() { return [...this._found]; }

  set found(list) {
    this._found = new Set((list ?? []).map(w => w.toLowerCase()));
    this._render();
  }

  // ── Public Methods ────────────────────────────────────────────────────────

  /**
   * markFound(word)
   * Mark a single word as found and update its item in place.
   * More efficient than a full re-render for large lists.
   */
  markFound(word) {
    const lower = word.toLowerCase();
    if (!this._words.includes(lower) || this._found.has(lower)) return;

    this._found.add(lower);
    this._updateItem(lower);
    this._updateProgress();
  }

  /**
   * reset(words)
   * Replace the word list and clear all found state.
   */
  reset(words) {
    this.words = words; // setter handles normalisation + render
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _render() {
    const list = this.shadowRoot.querySelector('.word-grid');

    if (this._words.length === 0) {
      list.innerHTML = '<li class="empty">No words yet. Start a new game!</li>';
      this._updateProgress();
      return;
    }

    list.innerHTML = this._words.map(word => `
      <li class="word-item${this._found.has(word) ? ' found' : ''}" data-word="${word}">
        <span class="check" aria-hidden="true">${this._found.has(word) ? '✓' : ''}</span>
        <span class="text">${word}</span>
      </li>
    `).join('');

    this._updateProgress();
  }

  _updateItem(word) {
    const item = this.shadowRoot.querySelector(`.word-item[data-word="${word}"]`);
    if (!item) return;
    item.classList.add('found');
    item.querySelector('.check').textContent = '✓';
  }

  _updateProgress() {
    const total  = this._words.length;
    const done   = this._found.size;
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

    this.shadowRoot.querySelector('.progress-text').textContent =
      `${done} / ${total} found`;
    this.shadowRoot.querySelector('.progress-fill').style.width = `${pct}%`;
  }
}

customElements.define('word-list', WordList);
