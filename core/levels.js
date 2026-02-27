/**
 * levels.js
 * Difficulty level definitions for FillWrds.
 *
 * Fields:
 *   id             — internal key used across the app
 *   label          — display name
 *   wordLengthMin  — minimum word length (inclusive)
 *   wordLengthMax  — maximum word length (inclusive)
 *   wordCount      — number of words placed in the puzzle
 *   gridSize       — grid is gridSize × gridSize cells
 */

export const LEVELS = [
  {
    id:           'easy',
    label:        'Easy',
    wordLengthMin: 3,
    wordLengthMax: 5,
    wordCount:    10,
    gridSize:     10,
  },
  {
    id:           'medium',
    label:        'Medium',
    wordLengthMin: 5,
    wordLengthMax: 8,
    wordCount:    15,
    gridSize:     14,
  },
  {
    id:           'hard',
    label:        'Hard',
    wordLengthMin: 8,
    wordLengthMax: 15,
    wordCount:    20,
    gridSize:     18,
  },
];

/** Convenience map: id → level config */
export const LEVELS_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]));

/** Returns the level config for a given id, defaulting to 'easy'. */
export function getLevel(id) {
  return LEVELS_BY_ID[id] ?? LEVELS_BY_ID.easy;
}
