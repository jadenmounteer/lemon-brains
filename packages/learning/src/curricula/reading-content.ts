export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export interface LetterPicture {
  letter: string;
  word: string;
  emoji: string;
}

/** Beginning-sound picture cues for letter recognition (one clear emoji per letter). */
export const LETTER_PICTURES: LetterPicture[] = [
  { letter: 'A', word: 'apple', emoji: '🍎' },
  { letter: 'B', word: 'ball', emoji: '⚽' },
  { letter: 'C', word: 'cat', emoji: '🐱' },
  { letter: 'D', word: 'dog', emoji: '🐶' },
  { letter: 'E', word: 'egg', emoji: '🥚' },
  { letter: 'F', word: 'fish', emoji: '🐠' },
  { letter: 'G', word: 'goat', emoji: '🐐' },
  { letter: 'H', word: 'hat', emoji: '🎩' },
  { letter: 'I', word: 'igloo', emoji: '🧊' },
  { letter: 'J', word: 'jam', emoji: '🍓' },
  { letter: 'K', word: 'kite', emoji: '🪁' },
  { letter: 'L', word: 'leaf', emoji: '🍃' },
  { letter: 'M', word: 'moon', emoji: '🌙' },
  { letter: 'N', word: 'nest', emoji: '🪺' },
  { letter: 'O', word: 'octopus', emoji: '🐙' },
  { letter: 'P', word: 'pig', emoji: '🐷' },
  { letter: 'Q', word: 'queen', emoji: '👸' },
  { letter: 'R', word: 'rainbow', emoji: '🌈' },
  { letter: 'S', word: 'sun', emoji: '☀️' },
  { letter: 'T', word: 'tree', emoji: '🌳' },
  { letter: 'U', word: 'umbrella', emoji: '☂️' },
  { letter: 'V', word: 'van', emoji: '🚐' },
  { letter: 'W', word: 'whale', emoji: '🐋' },
  { letter: 'X', word: 'x-ray', emoji: '🦴' },
  { letter: 'Y', word: 'yo-yo', emoji: '🪀' },
  { letter: 'Z', word: 'zebra', emoji: '🦓' },
];

export interface CvcWord {
  word: string;
  emoji: string;
}

export const CVC_WORDS: CvcWord[] = [
  { word: 'cat', emoji: '🐱' },
  { word: 'dog', emoji: '🐶' },
  { word: 'sun', emoji: '☀️' },
  { word: 'hat', emoji: '🎩' },
  { word: 'bat', emoji: '🦇' },
  { word: 'cup', emoji: '🥤' },
  { word: 'bug', emoji: '🐛' },
  { word: 'pig', emoji: '🐷' },
  { word: 'fox', emoji: '🦊' },
  { word: 'box', emoji: '📦' },
  { word: 'bed', emoji: '🛏️' },
  { word: 'red', emoji: '🔴' },
  { word: 'pen', emoji: '🖊️' },
  { word: 'hen', emoji: '🐔' },
  { word: 'map', emoji: '🗺️' },
  { word: 'cap', emoji: '🧢' },
  { word: 'jam', emoji: '🍓' },
  { word: 'pan', emoji: '🍳' },
  { word: 'log', emoji: '🪵' },
  { word: 'mop', emoji: '🧹' },
  { word: 'net', emoji: '🥅' },
  { word: 'wet', emoji: '💧' },
  { word: 'fin', emoji: '🐠' },
  { word: 'pin', emoji: '📌' },
  { word: 'bus', emoji: '🚌' },
  { word: 'mug', emoji: '☕' },
  { word: 'rug', emoji: '🧶' },
  { word: 'run', emoji: '🏃' },
  { word: 'top', emoji: '🔝' },
  { word: 'hop', emoji: '🐇' },
];

export const SIGHT_WORDS = [
  'the',
  'a',
  'I',
  'to',
  'and',
  'you',
  'is',
  'it',
  'in',
  'said',
  'for',
  'up',
  'look',
  'we',
  'go',
  'me',
  'my',
  'on',
  'see',
  'like',
];

/** Lookalike distractors keyed by sight word (lowercase). */
export const SIGHT_WORD_DISTRACTORS: Record<string, string[]> = {
  the: ['then', 'they', 'there'],
  a: ['an', 'as', 'at'],
  i: ['in', 'is', 'it'],
  to: ['too', 'two', 'do'],
  and: ['end', 'an', 'any'],
  you: ['your', 'yes', 'our'],
  is: ['it', 'in', 'if'],
  it: ['is', 'in', 'if'],
  in: ['on', 'an', 'is'],
  said: ['sad', 'say', 'and'],
  for: ['fro', 'far', 'of'],
  up: ['us', 'on', 'cup'],
  look: ['book', 'lock', 'like'],
  we: ['me', 'be', 'he'],
  go: ['to', 'no', 'got'],
  me: ['my', 'we', 'be'],
  my: ['me', 'by', 'may'],
  on: ['in', 'no', 'an'],
  see: ['sea', 'she', 'set'],
  like: ['lake', 'look', 'bike'],
};
