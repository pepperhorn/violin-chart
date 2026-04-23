// Quiz helpers: note parsing, enharmonic matching, shuffle.

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseNoteInput(s) {
  const m = String(s).trim().match(/^([A-Ga-g])\s*([#b♯♭]?)/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = (m[2] || '').replace('♯', '#').replace('♭', 'b');
  return { letter, acc };
}

export function pitchClassOf(letter, acc) {
  const base = LETTER_PC[letter];
  if (base == null) return null;
  const delta = acc === '#' ? 1 : acc === 'b' ? -1 : 0;
  return ((base + delta) % 12 + 12) % 12;
}

// Check user input against actual note (enharmonic match accepted).
export function isCorrectGuess(input, actual) {
  const parsed = parseNoteInput(input);
  if (!parsed) return false;
  const guessPc = pitchClassOf(parsed.letter, parsed.acc);
  const actualPc = pitchClassOf(actual.letter, actual.accidental || '');
  return guessPc != null && guessPc === actualPc;
}

// Fisher-Yates shuffle (returns a new array).
export function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickHiddenKeys(cells, percent) {
  const count = Math.max(1, Math.round((cells.length * percent) / 100));
  return new Set(shuffled(cells).slice(0, count).map((c) => c.key));
}
