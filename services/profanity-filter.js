/**
 * profanity-filter.js
 * Root-based expletive blocklist for all supported languages.
 * Cyrillic entries use prefix matching to catch inflected forms.
 */

// Roots: if a word starts with any of these it is rejected.
const ROOTS = {
  en: [
    'fuck', 'shit', 'cunt', 'cock', 'dick', 'pussy', 'bitch', 'ass',
    'bastard', 'whore', 'slut', 'fag', 'nigger', 'nigga', 'retard',
    'twat', 'wank', 'piss', 'tit', 'cum', 'jizz', 'spunk',
  ],
  // Russian mat roots
  ru: [
    'хуй', 'хую', 'хуя', 'хуе', 'хуё', 'хуи', 'хуйн',
    'пизд', 'пёзд',
    'ёб',  'еб',  'ёба', 'еба', 'ёбл', 'ебл', 'ёбн', 'ебн',
    'бляд', 'блядь', 'блять',
    'залуп', 'мудак', 'мудил', 'муд',
    'пидор', 'пидар', 'педик', 'пенис',
    'сука', 'суки', 'суке', 'суку',
    'ёбан', 'ебан',
    'блядск', 'блятск',
    'влагалищ', 'мошонк',
    'манда',
  ],
  // Belarusian mat roots (overlap with ru + specific BE forms)
  be: [
    'хуй', 'хую', 'хуя', 'хуе', 'хуі',
    'піzд', 'піздз', 'пізд',
    'ёб',  'еб',  'яб',
    'бляд', 'блядзь', 'блядска',
    'залуп', 'мудак', 'мудзіл',
    'підар', 'підор', 'педык', 'пеніс',
    'сука', 'сукі', 'суку',
    'манда',
  ],
  // Ukrainian mat roots
  uk: [
    'хуй', 'хую', 'хуя', 'хуї',
    'пізд', 'піздун',
    'їб',  'йоб',  'єб',
    'бляд', 'блядь', 'блядська',
    'залуп', 'мудак', 'мудило',
    'підар', 'підор', 'педик', 'пеніс',
    'сука', 'суки', 'суку',
    'манда',
  ],
};

/**
 * Returns true if the word should be blocked.
 * @param {string} word  — lowercase word to check
 * @param {string} lang  — language code
 */
export function isExpletive(word, lang) {
  const roots = ROOTS[lang];
  if (!roots) return false;
  const w = word.toLowerCase();
  return roots.some(root => w.startsWith(root));
}

/**
 * Filters an array of words, removing expletives.
 * @param {string[]} words
 * @param {string}   lang
 * @returns {string[]}
 */
export function filterExpletives(words, lang) {
  return words.filter(w => !isExpletive(w, lang));
}
