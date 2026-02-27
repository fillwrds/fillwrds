/**
 * word-store.js
 * IndexedDB-backed word cache with per-language/level deduplication.
 *
 * DB: fillwrds-db  (version 1)
 * Object stores:
 *   words   — { id: "<lang>|<level>|<word>", lang, level, word }
 *   history — { id: "<lang>|<level>|<timestamp>", lang, level, timestamp, words[] }
 *             index: "by-lang-level" on [lang, level]
 */

const DB_NAME    = 'fillwrds-db';
const DB_VERSION = 1;
const MAX_HISTORY = 20;

// ── DB open ──────────────────────────────────────────────────────────────────

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // words store
      if (!db.objectStoreNames.contains('words')) {
        db.createObjectStore('words', { keyPath: 'id' });
      }

      // history store with compound index for fast per-lang/level queries
      if (!db.objectStoreNames.contains('history')) {
        const histStore = db.createObjectStore('history', { keyPath: 'id' });
        histStore.createIndex('by-lang-level', ['lang', 'level'], { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordId(lang, level, word) {
  return `${lang}|${level}|${word}`;
}

function historyId(lang, level, timestamp) {
  return `${lang}|${level}|${timestamp}`;
}

/** Fisher-Yates shuffle (in-place, returns same array). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get all history entries for a lang+level, sorted oldest→newest. */
async function getHistory(db, lang, level) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('history', 'readonly');
    const index = tx.objectStore('history').index('by-lang-level');
    const req   = index.getAll([lang, level]);
    req.onsuccess = () => {
      const entries = (req.result || []).sort((a, b) => a.timestamp - b.timestamp);
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Collect all words used in the last MAX_HISTORY iterations for lang+level. */
async function getRecentlyUsedWords(db, lang, level) {
  const history = await getHistory(db, lang, level);
  const recent  = history.slice(-MAX_HISTORY);
  const used    = new Set();
  for (const entry of recent) {
    for (const w of entry.words) used.add(w.toLowerCase());
  }
  return used;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getWords(lang, level, count)
 * Returns up to `count` cached words for the given lang+level,
 * excluding any word that appeared in the last 20 iterations.
 */
export async function getWords(lang, level, count) {
  const db      = await openDB();
  const used    = await getRecentlyUsedWords(db, lang, level);

  // Collect up to count*5 candidates then shuffle + slice for variety.
  // Without this, IndexedDB's alphabetical key order means the same words
  // are always returned first on every game start.
  const COLLECT_LIMIT = count * 5;

  return new Promise((resolve, reject) => {
    const tx      = db.transaction('words', 'readonly');
    const store   = tx.objectStore('words');
    const results = [];

    const range = IDBKeyRange.bound(
      `${lang}|${level}|`,
      `${lang}|${level}|\uffff`
    );
    const cursor = store.openCursor(range);

    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c || results.length >= COLLECT_LIMIT) {
        resolve(shuffle(results).slice(0, count));
        return;
      }
      const word = c.value.word;
      if (!used.has(word.toLowerCase())) {
        results.push(word);
      }
      c.continue();
    };

    cursor.onerror = () => reject(cursor.error);
  });
}

/**
 * addWords(lang, level, words[])
 * Persists new words into the cache. Silently skips duplicates.
 */
export async function addWords(lang, level, words) {
  if (!words || words.length === 0) return;
  const db = await openDB();
  const tx = db.transaction('words', 'readwrite');
  const store = tx.objectStore('words');

  for (const word of words) {
    const id = wordId(lang, level, word.toLowerCase());
    // putOnly if not already present to avoid overwriting metadata in future
    store.put({ id, lang, level, word: word.toLowerCase() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * recordIteration(lang, level, usedWords[])
 * Saves the list of words used in the current game, then prunes history
 * so only the last MAX_HISTORY entries remain for this lang+level.
 */
export async function recordIteration(lang, level, usedWords) {
  const db        = await openDB();
  const timestamp = Date.now();
  const id        = historyId(lang, level, timestamp);

  // Write new entry
  const writeTx = db.transaction('history', 'readwrite');
  writeTx.objectStore('history').put({
    id,
    lang,
    level,
    timestamp,
    words: usedWords.map(w => w.toLowerCase()),
  });
  await new Promise((res, rej) => {
    writeTx.oncomplete = res;
    writeTx.onerror    = () => rej(writeTx.error);
  });

  // Prune: keep only last MAX_HISTORY entries
  const history = await getHistory(db, lang, level);
  if (history.length <= MAX_HISTORY) return;

  const toDelete = history.slice(0, history.length - MAX_HISTORY);
  const pruneTx  = db.transaction('history', 'readwrite');
  const store    = pruneTx.objectStore('history');
  for (const entry of toDelete) {
    store.delete(entry.id);
  }
  return new Promise((res, rej) => {
    pruneTx.oncomplete = res;
    pruneTx.onerror    = () => rej(pruneTx.error);
  });
}

/**
 * clearCache(lang?, level?)
 * Dev/reset utility.
 * - clearCache()            — wipes all words and history
 * - clearCache('en')        — wipes all English words and history
 * - clearCache('en','easy') — wipes English easy words and history
 */
export async function clearCache(lang, level) {
  const db = await openDB();

  const clearStore = (storeName) => new Promise((resolve, reject) => {
    if (!lang) {
      // Clear entire store
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = resolve;
      req.onerror   = () => reject(req.error);
      return;
    }

    // Targeted delete by key range
    const prefix = level ? `${lang}|${level}|` : `${lang}|`;
    const upper  = level ? `${lang}|${level}|\uffff` : `${lang}|\uffff`;
    const range  = IDBKeyRange.bound(prefix, upper);
    const tx     = db.transaction(storeName, 'readwrite');
    const req    = tx.objectStore(storeName).delete(range);
    req.onsuccess = resolve;
    req.onerror   = () => reject(req.error);
  });

  await clearStore('words');
  await clearStore('history');
}

/**
 * getStats(lang, level)
 * Returns { cachedWords, historyEntries } — useful for debugging.
 */
export async function getStats(lang, level) {
  const db      = await openDB();
  const history = await getHistory(db, lang, level);

  const wordCount = await new Promise((resolve, reject) => {
    const range = IDBKeyRange.bound(
      `${lang}|${level}|`,
      `${lang}|${level}|\uffff`
    );
    const tx  = db.transaction('words', 'readonly');
    const req = tx.objectStore('words').count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

  return {
    cachedWords:    wordCount,
    historyEntries: history.length,
    recentlyUsed:   [...(await getRecentlyUsedWords(db, lang, level))],
  };
}
