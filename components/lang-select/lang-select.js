/**
 * <lang-select> Web Component
 *
 * Language picker for FillWrds. Renders a row of flag + label buttons.
 *
 * Attributes:
 *   selected-lang  — currently active language code ('en'|'ru'|'be'|'uk')
 *
 * Events dispatched:
 *   lang-changed   — CustomEvent({ detail: { lang: string } })
 *
 * Usage:
 *   <lang-select selected-lang="en"></lang-select>
 */

const LANGUAGES = [
  { code: 'be', label: 'Belarusian', flag: '' },
  { code: 'uk', label: 'Ukrainian',  flag: '' },
  { code: 'en', label: 'English',    flag: '' },
  { code: 'ru', label: 'Russian',    flag: '' },
];

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    align-items: center;
    gap: .35rem;
  }

  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: .35rem;
    padding: .3rem .65rem;
    border: 1.5px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: .82rem;
    font-weight: 500;
    color: inherit;
    transition: background 120ms ease, border-color 120ms ease;
    white-space: nowrap;
    font-family: inherit;
  }

  .lang-btn:hover {
    background: rgba(79, 70, 229, .08);
    border-color: rgba(79, 70, 229, .25);
  }

  .lang-btn[aria-pressed="true"] {
    background: rgba(79, 70, 229, .12);
    border-color: #4f46e5;
    color: #4f46e5;
    font-weight: 700;
  }

  .flag {
    font-size: 1.1rem;
    line-height: 1;
  }

  /* On narrow screens hide the text label, keep flag only */
  @media (max-width: 480px) {
    .lang-label { display: none; }
    .lang-btn   { padding: .3rem .45rem; }
  }
</style>
${LANGUAGES.map(({ code, label, flag }) => `
  <button
    class="lang-btn"
    data-lang="${code}"
    aria-pressed="false"
    aria-label="${label}"
    type="button"
  >
    <span class="flag" aria-hidden="true">${flag}</span>
    <span class="lang-label">${label}</span>
  </button>
`).join('')}
`;

class LangSelect extends HTMLElement {
  static get observedAttributes() {
    return ['selected-lang'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._onButtonClick = this._onButtonClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', this._onButtonClick);
    });
    // Reflect initial attribute
    this._updatePressed(this.getAttribute('selected-lang') ?? 'en');
  }

  disconnectedCallback() {
    this.shadowRoot.querySelectorAll('.lang-btn').forEach(btn => {
      btn.removeEventListener('click', this._onButtonClick);
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'selected-lang' && oldVal !== newVal) {
      this._updatePressed(newVal);
    }
  }

  /** Programmatically select a language. */
  set selectedLang(code) {
    this.setAttribute('selected-lang', code);
  }

  get selectedLang() {
    return this.getAttribute('selected-lang') ?? 'en';
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _onButtonClick(e) {
    const btn  = e.currentTarget;
    const lang = btn.dataset.lang;
    if (lang === this.selectedLang) return; // no-op if already selected

    this.setAttribute('selected-lang', lang);

    this.dispatchEvent(new CustomEvent('lang-changed', {
      bubbles:   true,
      composed:  true,   // cross shadow-root boundary
      detail:    { lang },
    }));
  }

  _updatePressed(activeLang) {
    this.shadowRoot.querySelectorAll('.lang-btn').forEach(btn => {
      const isActive = btn.dataset.lang === activeLang;
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
}

customElements.define('lang-select', LangSelect);
