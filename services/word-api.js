/**
 * word-api.js
 * Fetch words from open public APIs per language, filtered by difficulty level.
 *
 * Supported languages:
 *   en — English   → random-word-api.vercel.app (primary) / herokuapp (fallback)
 *   ru — Russian   → en.wiktionary.org categorymembers (Russian_lemmas)
 *   be — Belarusian→ en.wiktionary.org categorymembers (Belarusian_lemmas)
 *   uk — Ukrainian → en.wiktionary.org categorymembers (Ukrainian_lemmas)
 *
 * Level → word-length mapping:
 *   easy:   3–5 characters
 *   medium: 5–8 characters
 *   hard:   8–15 characters
 */

// ── Config ────────────────────────────────────────────────────────────────────

export const LEVEL_CONFIG = {
  easy:   { min: 3, max: 5  },
  medium: { min: 5, max: 8  },
  hard:   { min: 8, max: 15 },
};

const WIKTIONARY_CATEGORIES = {
  ru: 'Russian_lemmas',
  be: 'Belarusian_lemmas',
  uk: 'Ukrainian_lemmas',
};

// Random starting letters per language for Wiktionary pagination variety.
// By picking a random letter prefix we avoid always fetching words starting
// with А/A and missing the rest of the alphabet.
const WIKT_START_LETTERS = {
  ru: 'абвгдеёжзийклмнопрстуфхцчшщэюя'.split(''),
  be: 'абвгдеёжзійклмнопрстуўфхцчшыэюя'.split(''),
  uk: 'абвгґдеєжзиіїйклмнопрстуфхцчшщюя'.split(''),
};

// Cyrillic block — covers ru, be, uk alphabets
const CYRILLIC_RE = /^[\u0400-\u04FF]+$/;
const LATIN_RE    = /^[a-z]+$/;

const MAX_RETRIES     = 3;
const RETRY_BASE_MS   = 500;
const WIKT_BATCH_SIZE = 500;   // max allowed by Wiktionary API
const WIKT_MAX_PAGES  = 4;     // cap API calls per fetch

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Retry an async fn up to `retries` times with exponential back-off. */
async function withRetry(fn, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Validate a candidate word:
 * - length within [min, max]
 * - only letters in the expected script (no spaces, digits, hyphens)
 */
function isValidWord(word, min, max, script = 'latin') {
  if (typeof word !== 'string') return false;
  const w = word.trim().toLowerCase();
  if (w.length < min || w.length > max) return false;
  const re = script === 'cyrillic' ? CYRILLIC_RE : LATIN_RE;
  return re.test(w);
}

// ── English adapter ────────────────────────────────────────────────────────────

/**
 * Fetch from random-word-api.vercel.app.
 * The API supports exact-length filtering, so we spread requests
 * across all lengths in the level range and combine results.
 */
async function fetchFromVercel(length, n) {
  const url = `https://random-word-api.vercel.app/api?words=${n}&length=${length}&type=lowercase`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vercel API HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Fallback: random-word-api.herokuapp.com */
async function fetchFromHeroku(length, n) {
  const url = `https://random-word-api.herokuapp.com/word?number=${n}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Heroku API HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchEnglishWords(level, count) {
  const { min, max } = LEVEL_CONFIG[level];
  const results = new Set();

  // Build a list of lengths to sample, shuffled for variety
  const lengths = [];
  for (let l = min; l <= max; l++) lengths.push(l);
  const sampledLengths = shuffle(lengths);

  // How many words to request per length (overshoot to account for dedup)
  const perLength = Math.ceil((count * 2) / sampledLengths.length) + 5;

  for (const length of sampledLengths) {
    if (results.size >= count * 2) break;

    let words = [];
    try {
      words = await withRetry(() => fetchFromVercel(length, perLength));
    } catch {
      try {
        words = await withRetry(() => fetchFromHeroku(length, perLength));
      } catch {
        // Skip this length if both APIs fail
        continue;
      }
    }

    for (const w of words) {
      if (isValidWord(w, min, max, 'latin')) results.add(w.toLowerCase());
    }
  }

  if (results.size === 0) {
    throw new Error(`[word-api] Could not fetch English words for level "${level}"`);
  }

  return shuffle([...results]).slice(0, count);
}

// ── Wiktionary adapter (ru, be, uk) ────────────────────────────────────────────

/**
 * Fetch a page of category members from en.wiktionary.org.
 * Returns { members: string[], cmcontinue: string|null }
 */
async function fetchWiktionaryPage(category, cmcontinue, startLetter = null) {
  const params = new URLSearchParams({
    action:  'query',
    list:    'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: String(WIKT_BATCH_SIZE),
    cmtype:  'page',
    cmprop:  'title',
    format:  'json',
    origin:  '*',           // required for browser CORS
  });
  // Start from a random letter for variety across fetches
  if (startLetter && !cmcontinue) params.set('cmstartsortkeyprefix', startLetter);
  if (cmcontinue) params.set('cmcontinue', cmcontinue);

  const res = await fetch(`https://en.wiktionary.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`Wiktionary HTTP ${res.status}`);
  const data = await res.json();

  const members = (data?.query?.categorymembers ?? []).map(m => m.title);
  const next    = data?.continue?.cmcontinue ?? null;
  return { members, next };
}

async function fetchWiktionaryWords(lang, level, count) {
  const { min, max } = LEVEL_CONFIG[level];
  const category = WIKTIONARY_CATEGORIES[lang];
  const results  = new Set();
  let cmcontinue = null;

  // Pick a random starting letter to vary which part of the alphabet we fetch.
  // cmstartsortkeyprefix makes Wiktionary begin iteration from that letter.
  const startLetters = WIKT_START_LETTERS[lang] ?? [];
  const startLetter  = startLetters.length > 0
    ? startLetters[Math.floor(Math.random() * startLetters.length)]
    : null;

  for (let page = 0; page < WIKT_MAX_PAGES; page++) {
    const { members, next } = await withRetry(
      () => fetchWiktionaryPage(category, cmcontinue, page === 0 ? startLetter : null)
    );

    for (const title of members) {
      if (isValidWord(title, min, max, 'cyrillic')) {
        results.add(title.toLowerCase());
      }
    }

    cmcontinue = next;
    if (!cmcontinue || results.size >= count * 2) break;
  }

  if (results.size === 0) {
    throw new Error(`[word-api] Could not fetch ${lang} words for level "${level}"`);
  }

  return shuffle([...results]).slice(0, count);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * fetchWords(lang, level, count)
 *
 * Fetches `count` words for the given language and difficulty level.
 * Throws if all API attempts fail (caller should fall back to word-store cache).
 *
 * @param {string} lang   — 'en' | 'ru' | 'be' | 'uk'
 * @param {string} level  — 'easy' | 'medium' | 'hard'
 * @param {number} count  — how many words to return
 * @returns {Promise<string[]>}
 */
export async function fetchWords(lang, level, count) {
  if (!LEVEL_CONFIG[level]) {
    throw new Error(`[word-api] Unknown level: "${level}"`);
  }

  if (lang === 'en') {
    return fetchEnglishWords(level, count);
  }

  if (WIKTIONARY_CATEGORIES[lang]) {
    return fetchWiktionaryWords(lang, level, count);
  }

  throw new Error(`[word-api] Unsupported language: "${lang}"`);
}

/**
 * supportedLanguages()
 * Returns the list of language codes this module supports.
 */
export function supportedLanguages() {
  return ['en', 'ru', 'be', 'uk'];
}
