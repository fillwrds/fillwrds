/**
 * <win-modal> Web Component
 *
 * Shown when the player finds all words. Also handles error messages.
 *
 * Methods:
 *   show({ words, elapsed })  — display win screen
 *   showError(message)        — display error message
 *   hide()                    — close modal
 *
 * Events dispatched:
 *   play-again  — CustomEvent (bubbles + composed) when player wants a new game
 */

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: none; /* hidden by default */
    position: fixed;
    inset: 0;
    z-index: 100;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, .45);
    backdrop-filter: blur(3px);
    padding: 1rem;
  }

  :host(.open) {
    display: flex;
  }

  .modal {
    background: var(--color-surface);
    border-radius: 20px;
    padding: 2rem 2.5rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
    animation: pop-in 220ms cubic-bezier(.175,.885,.32,1.275) both;
  }

  @keyframes pop-in {
    from { transform: scale(.8); opacity: 0; }
    to   { transform: scale(1);  opacity: 1; }
  }

  .icon {
    font-size: 3rem;
    line-height: 1;
    margin-bottom: .75rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text);
    margin-bottom: .4rem;
  }

  .subtitle {
    font-size: .95rem;
    color: var(--color-text-muted);
    margin-bottom: 1.25rem;
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .15rem;
  }

  .stat-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-primary);
  }

  .stat-label {
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--color-text-muted);
  }

  .btn-play-again {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .5rem;
    background: var(--color-primary);
    color: var(--color-primary-text);
    padding: .75rem 2rem;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: background 120ms ease, transform 80ms ease;
  }

  .btn-play-again:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }

  .btn-play-again:active {
    transform: translateY(0);
  }

  /* Error variant */
  .modal.error h2  { color: #991b1b; }
  .modal.error .icon { font-size: 2.5rem; }

  .error-msg {
    font-size: .92rem;
    color: var(--color-text-muted);
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .btn-dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-btn-dismiss-bg);
    color: var(--color-btn-dismiss-text);
    padding: .65rem 2rem;
    border-radius: 10px;
    font-size: .95rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: background 120ms ease;
  }

  .btn-dismiss:hover { background: var(--color-btn-dismiss-hover); }
</style>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="icon" id="modal-icon">🎉</div>
  <h2 id="modal-title">You found them all!</h2>
  <p class="subtitle" id="modal-subtitle">Great job! Here's how you did:</p>

  <div class="stats" id="modal-stats">
    <div class="stat">
      <span class="stat-value" id="stat-words">0</span>
      <span class="stat-label">Words</span>
    </div>
    <div class="stat">
      <span class="stat-value" id="stat-time">0s</span>
      <span class="stat-label">Time</span>
    </div>
  </div>

  <button class="btn-play-again" id="btn-play-again" type="button">
    Play Again
  </button>
</div>
`;

class WinModal extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return; // already set up

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById('btn-play-again')
      .addEventListener('click', () => {
        this.hide();
        this.dispatchEvent(new CustomEvent('play-again', {
          bubbles: true, composed: true,
        }));
      });

    // Close on backdrop click
    this.addEventListener('click', (e) => {
      if (e.target === this) this.hide();
    });
  }

  // ── Public methods ──────────────────────────────────────────────────────────

  show({ words = [], elapsed = 0 } = {}) {
    this._ensureSetup();
    const modal = this.shadowRoot.querySelector('.modal');
    modal.classList.remove('error');

    this.shadowRoot.getElementById('modal-icon').textContent    = '🎉';
    this.shadowRoot.getElementById('modal-title').textContent   = 'You found them all!';
    this.shadowRoot.getElementById('modal-subtitle').textContent = 'Great job! Here\'s how you did:';
    this.shadowRoot.getElementById('stat-words').textContent    = words.length;
    this.shadowRoot.getElementById('stat-time').textContent     = formatTime(elapsed);
    this.shadowRoot.getElementById('modal-stats').hidden        = false;
    this.shadowRoot.getElementById('btn-play-again').hidden     = false;

    // Replace dismiss button if present from a previous error
    const dismiss = this.shadowRoot.getElementById('btn-dismiss');
    if (dismiss) dismiss.remove();

    this.classList.add('open');
    this.shadowRoot.getElementById('btn-play-again').focus();
  }

  showError(message) {
    this._ensureSetup();
    const modal = this.shadowRoot.querySelector('.modal');
    modal.classList.add('error');

    this.shadowRoot.getElementById('modal-icon').textContent     = '⚠️';
    this.shadowRoot.getElementById('modal-title').textContent    = 'Something went wrong';
    this.shadowRoot.getElementById('modal-subtitle').textContent = message;
    this.shadowRoot.getElementById('modal-stats').hidden         = true;
    this.shadowRoot.getElementById('btn-play-again').hidden      = true;

    // Add a dismiss button if not already there
    if (!this.shadowRoot.getElementById('btn-dismiss')) {
      const btn = document.createElement('button');
      btn.id        = 'btn-dismiss';
      btn.className = 'btn-dismiss';
      btn.type      = 'button';
      btn.textContent = 'Dismiss';
      btn.addEventListener('click', () => this.hide());
      modal.appendChild(btn);
    }

    this.classList.add('open');
  }

  hide() {
    this.classList.remove('open');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _ensureSetup() {
    if (!this.shadowRoot) this.connectedCallback();
  }
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

customElements.define('win-modal', WinModal);
