/**
 * alphabets.js
 * Per-language character sets used to fill empty grid cells.
 * Only lowercase letters; no rare/ambiguous characters.
 */

export const ALPHABETS = {
  en: 'abcdefghijklmnopqrstuvwxyz',

  // Russian: full 33-letter alphabet (including ё)
  ru: 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя',

  // Belarusian: 32 letters (includes ў, і; excludes ъ, э, щ from Russian)
  be: 'абвгдеёжзійклмнопрстуўфхцчшыьэюя',

  // Ukrainian: 33 letters (includes і, ї, є, ґ)
  uk: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя',
};

/**
 * randomChar(lang)
 * Returns a single random filler character for the given language.
 * Falls back to English if the lang code is unknown.
 */
export function randomChar(lang) {
  const alphabet = ALPHABETS[lang] ?? ALPHABETS.en;
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}
