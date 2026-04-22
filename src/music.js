// Music theory: key signatures, scale generation, note/midi conversion.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Key signatures as { letter: '#' | 'b' }
const MAJOR_KEYS = {
  'C':  {},
  'G':  { F: '#' },
  'D':  { F: '#', C: '#' },
  'A':  { F: '#', C: '#', G: '#' },
  'E':  { F: '#', C: '#', G: '#', D: '#' },
  'B':  { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'F#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'F':  { B: 'b' },
  'Bb': { B: 'b', E: 'b' },
  'Eb': { B: 'b', E: 'b', A: 'b' },
  'Ab': { B: 'b', E: 'b', A: 'b', D: 'b' },
  'Db': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b' },
  'Gb': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b' },
};

// Natural minor shares the relative major's key signature.
const MINOR_TO_RELATIVE_MAJOR = {
  'Am': 'C',  'Em': 'G',  'Bm': 'D',  'F#m': 'A',
  'C#m': 'E', 'G#m': 'B', 'D#m': 'F#',
  'Dm': 'F',  'Gm': 'Bb', 'Cm': 'Eb', 'Fm': 'Ab',
  'Bbm': 'Db','Ebm': 'Gb',
};

export const KEYS = [
  ...Object.keys(MAJOR_KEYS).map((k) => ({ value: k, label: `${k} major` })),
  ...Object.keys(MINOR_TO_RELATIVE_MAJOR).map((k) => ({ value: k, label: `${k.replace('m', '')} minor` })),
];

// Parse a key string like "G", "F#", "Am", "Bbm"
function parseKey(key) {
  const isMinor = key.endsWith('m');
  if (isMinor) {
    const relMajor = MINOR_TO_RELATIVE_MAJOR[key];
    const tonic = key.slice(0, -1);
    return { tonic, isMinor: true, sig: MAJOR_KEYS[relMajor] };
  }
  return { tonic: key, isMinor: false, sig: MAJOR_KEYS[key] };
}

// Parse a note name like "F#", "Bb", "A", return {letter, accidental}
function parseNote(s) {
  return { letter: s[0], accidental: s.slice(1) || '' };
}

function accidentalSemitones(acc) {
  if (acc === '#') return 1;
  if (acc === 'b') return -1;
  return 0;
}

// Convert (letter, accidental, octave) to MIDI. Octave: C4 = 60.
export function toMidi(letter, accidental, octave) {
  return 12 * (octave + 1) + LETTER_PC[letter] + accidentalSemitones(accidental);
}

// Parse a note name with octave e.g. "G3", "F#4", "Bb5"
export function parseNoteOctave(s) {
  const m = s.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!m) return null;
  return { letter: m[1], accidental: m[2], octave: parseInt(m[3], 10) };
}

export function noteName({ letter, accidental }) {
  return letter + accidental;
}

export function noteWithOctave({ letter, accidental, octave }) {
  return `${letter}${accidental}${octave}`;
}

// Generate a scale (array of note objects {letter, accidental, octave, midi})
// from startNote to endNote (inclusive). If start > end, descending.
export function generateScale(keyStr, scaleType, startStr, endStr) {
  const { tonic, isMinor, sig } = parseKey(keyStr);
  const tonicNote = parseNote(tonic);
  const start = parseNoteOctave(startStr);
  const end = parseNoteOctave(endStr);
  if (!start || !end) return [];

  // Build ordered list of 7 scale letters starting from the tonic letter.
  const tonicLetterIdx = LETTERS.indexOf(tonicNote.letter);
  const scaleLetters = [];
  for (let i = 0; i < 7; i++) {
    scaleLetters.push(LETTERS[(tonicLetterIdx + i) % 7]);
  }

  // For each scale letter, apply key signature accidental (if any).
  const letterToAccidental = (letter) => sig[letter] || '';

  // Enumerate all notes in the scale across octaves 0..8, then filter.
  const allNotes = [];
  for (let octave = 1; octave <= 7; octave++) {
    for (const letter of scaleLetters) {
      const acc = letterToAccidental(letter);
      // Handle C-flat/B-sharp style octave wrap by using natural-letter octave.
      const midi = toMidi(letter, acc, octave);
      allNotes.push({ letter, accidental: acc, octave, midi });
    }
  }
  // De-duplicate by midi
  const byMidi = new Map();
  for (const n of allNotes) if (!byMidi.has(n.midi)) byMidi.set(n.midi, n);
  const sorted = [...byMidi.values()].sort((a, b) => a.midi - b.midi);

  const startMidi = toMidi(start.letter, start.accidental, start.octave);
  const endMidi = toMidi(end.letter, end.accidental, end.octave);
  const lo = Math.min(startMidi, endMidi);
  const hi = Math.max(startMidi, endMidi);
  let range = sorted.filter((n) => n.midi >= lo && n.midi <= hi);
  if (startMidi > endMidi) range = range.slice().reverse();
  // Unused marker to silence lints about isMinor/scaleType — natural minor uses same key signature.
  void isMinor;
  void scaleType;
  return range;
}
