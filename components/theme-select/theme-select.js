/**
 * <theme-select> Web Component
 *
 * Three-option theme picker: system / light / dark.
 *
 * Attributes:
 *   selected-theme  — 'system' | 'light' | 'dark'
 *
 * Events dispatched:
 *   theme-changed  — CustomEvent({ detail: { theme: string } })
 */

const THEMES = [
  { id: 'system', label: 'Auto',  icon: '🖥' },
  { id: 'light',  label: 'Light', icon: '☀' },
  { id: 'dark',   label: 'Dark',  icon: '🌙' },
];

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    align-items: center;
    background: rgba(0,0,0,.06);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  @media (prefers-color-scheme: dark) {
    :host { background: rgba(255,255,255,.08); }
  }

  :host-context([data-theme="dark"]) { background: rgba(255,255,255,.08); }
  :host-context([data-theme="light"]) { background: rgba(0,0,0,.06); }

  .theme-btn {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    padding: .25rem .55rem;
    border-radius: 5px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: .8rem;
    font-weight: 500;
    color: inherit;
    opacity: .55;
    transition: background 120ms ease, opacity 120ms ease;
    font-family: inherit;
    white-space: nowrap;
  }

  .theme-btn:hover {
    opacity: .85;
    background: rgba(255,255,255,.15);
  }

  .theme-btn[aria-pressed="true"] {
    background: var(--color-surface, #ffffff);
    opacity: 1;
    box-shadow: 0 1px 3px rgba(0,0,0,.15);
  }

  .icon { font-size: .95rem; line-height: 1; }

  @media (max-width: 520px) {
    .theme-label { display: none; }
    .theme-btn   { padding: .25rem .4rem; }
  }
</style>
${THEMES.map(({ id, label, icon }) => `
  <button
    class="theme-btn"
    data-theme="${id}"
    aria-pressed="false"
    aria-label="${label} theme"
    type="button"
  >
    <span class="icon" aria-hidden="true">${icon}</span>
    <span class="theme-label">${label}</span>
  </button>
`).join('')}
`;

class ThemeSelect extends HTMLElement {
  static get observedAttributes() { return ['selected-theme']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._onClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', this._onClick);
    });
    this._updatePressed(this.getAttribute('selected-theme') ?? 'system');
  }

  disconnectedCallback() {
    this.shadowRoot.querySelectorAll('.theme-btn').forEach(btn => {
      btn.removeEventListener('click', this._onClick);
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'selected-theme' && oldVal !== newVal) {
      this._updatePressed(newVal);
    }
  }

  get selectedTheme() { return this.getAttribute('selected-theme') ?? 'system'; }
  set selectedTheme(id) { this.setAttribute('selected-theme', id); }

  _onClick(e) {
    const theme = e.currentTarget.dataset.theme;
    if (theme === this.selectedTheme) return;
    this.setAttribute('selected-theme', theme);
    this.dispatchEvent(new CustomEvent('theme-changed', {
      bubbles: true, composed: true, detail: { theme },
    }));
  }

  _updatePressed(active) {
    this.shadowRoot.querySelectorAll('.theme-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === active));
    });
  }
}

customElements.define('theme-select', ThemeSelect);
