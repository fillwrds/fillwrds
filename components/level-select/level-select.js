/**
 * <level-select> Web Component
 *
 * Difficulty picker for FillWrds. Renders Easy / Medium / Hard buttons
 * driven by the LEVELS config from core/levels.js.
 *
 * Attributes:
 *   selected-level  — active level id ('easy'|'medium'|'hard')
 *
 * Events dispatched:
 *   level-changed   — CustomEvent({ detail: { level: string } })
 *
 * Usage:
 *   <level-select selected-level="easy"></level-select>
 */

import { LEVELS } from '../../core/levels.js';

// Badge colour per level (matches global CSS vars conceptually,
// but inlined here so the shadow root stays fully self-contained)
const LEVEL_COLORS = {
  easy:   { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  medium: { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  hard:   { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
};

// Build the template once, shared across all instances
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
    color: #6b7280;
    margin-bottom: .6rem;
  }

  .btn-group {
    display: flex;
    flex-direction: column;
    gap: .45rem;
  }

  .level-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: .55rem .8rem;
    border: 1.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: .9rem;
    font-weight: 500;
    color: inherit;
    transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
    text-align: left;
  }

  .level-btn:hover {
    transform: translateX(2px);
  }

  .level-btn[aria-pressed="true"] {
    font-weight: 700;
  }

  /* Per-level colours applied via inline CSS variables set in JS */
  .level-btn {
    --btn-bg:     transparent;
    --btn-border: transparent;
    --btn-text:   inherit;
  }

  .level-btn:hover {
    background: var(--btn-bg);
    border-color: var(--btn-border);
  }

  .level-btn[aria-pressed="true"] {
    background: var(--btn-bg);
    border-color: var(--btn-border);
    color: var(--btn-text);
  }

  .level-info {
    display: flex;
    flex-direction: column;
    gap: .1rem;
  }

  .level-name {
    font-size: .9rem;
  }

  .level-meta {
    font-size: .72rem;
    opacity: .65;
  }

  .level-badge {
    font-size: .7rem;
    font-weight: 700;
    padding: .15rem .45rem;
    border-radius: 999px;
    background: var(--btn-bg);
    color: var(--btn-text);
    border: 1px solid var(--btn-border);
    white-space: nowrap;
  }
</style>

<p class="section-label">Difficulty</p>
<div class="btn-group" role="group" aria-label="Difficulty level">
${LEVELS.map(({ id, label, wordLengthMin, wordLengthMax, wordCount, gridSize }) => {
  const c = LEVEL_COLORS[id] ?? LEVEL_COLORS.easy;
  return `
  <button
    class="level-btn"
    data-level="${id}"
    aria-pressed="false"
    type="button"
    style="--btn-bg:${c.bg};--btn-border:${c.border};--btn-text:${c.text};"
  >
    <span class="level-info">
      <span class="level-name">${label}</span>
      <span class="level-meta">${wordLengthMin}–${wordLengthMax} letters · ${wordCount} words · ${gridSize}×${gridSize}</span>
    </span>
    <span class="level-badge">${label}</span>
  </button>`;
}).join('')}
</div>
`;

class LevelSelect extends HTMLElement {
  static get observedAttributes() {
    return ['selected-level'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._onClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', this._onClick);
    });
    this._updatePressed(this.getAttribute('selected-level') ?? 'easy');
  }

  disconnectedCallback() {
    this.shadowRoot.querySelectorAll('.level-btn').forEach(btn => {
      btn.removeEventListener('click', this._onClick);
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'selected-level' && oldVal !== newVal) {
      this._updatePressed(newVal);
    }
  }

  get selectedLevel() {
    return this.getAttribute('selected-level') ?? 'easy';
  }

  set selectedLevel(id) {
    this.setAttribute('selected-level', id);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _onClick(e) {
    const btn   = e.currentTarget;
    const level = btn.dataset.level;
    if (level === this.selectedLevel) return;

    this.setAttribute('selected-level', level);

    this.dispatchEvent(new CustomEvent('level-changed', {
      bubbles:  true,
      composed: true,
      detail:   { level },
    }));
  }

  _updatePressed(activeLevel) {
    this.shadowRoot.querySelectorAll('.level-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.level === activeLevel));
    });
  }
}

customElements.define('level-select', LevelSelect);
