// Violin fingering: map MIDI pitches onto 4 strings × 8 chart rows.
// Row mapping: 0 = open string, 1-4 = 1st position fingers, 5-8 = 2nd position.

export const STRINGS = ['G', 'D', 'A', 'E'];
export const OPEN_MIDI = { G: 55, D: 62, A: 69, E: 76 };

// Violin student range: G3 (55) up to D6 (86). D6 = 2nd position F4 high on E.
export const RANGE_LO = 55;
export const RANGE_HI = 86;

// Pick the highest string s such that midi >= open[s]. This naturally routes
// open notes to the correct string and fills each string semi 1-7 before
// crossing to the next.
function pickString(midi) {
  let chosen = null;
  for (const s of STRINGS) if (midi >= OPEN_MIDI[s]) chosen = s;
  return chosen;
}

// Return { string, row, label } for a given midi, or null if out of range.
// row: 0..8  (0=open, 1-4 first pos, 5-8 second pos)
// label: text printed left of the circle (e.g., '0', 'L1', '1', 'L2', '2',
//        '3', 'H3', '4', 'IIH3', 'II4', 'IIH4')
export function fingeringFor(midi, opts = {}) {
  const { level = 'beginner' } = opts;
  const preferFourthFinger = level !== 'beginner';
  if (midi < RANGE_LO || midi > RANGE_HI) return null;

  // Intermediate/Pro: for a note that would be an open string (D4/A4/E5),
  // play it as 4th finger on the string below instead.
  if (preferFourthFinger) {
    for (const s of STRINGS) {
      if (midi - OPEN_MIDI[s] === 7) {
        return { string: s, row: 4, label: '4' };
      }
    }
  }

  const string = pickString(midi);
  if (!string) return null;
  const semi = midi - OPEN_MIDI[string];

  if (semi === 0) return { string, row: 0, label: '0' };
  // 1st position (semi 1-7)
  const firstPos = {
    1: { row: 1, label: 'L1' },
    2: { row: 1, label: '1' },
    3: { row: 2, label: 'L2' },
    4: { row: 2, label: '2' },
    5: { row: 3, label: '3' },
    6: { row: 3, label: 'H3' },
    7: { row: 4, label: '4' },
  };
  if (firstPos[semi]) return { string, ...firstPos[semi] };

  // 2nd position (semi 8-10) — used when the note is above 1st pos reach on
  // the highest string (E). F1=3,F2=5/6,F3=7/8,F4=9/10.
  const secondPos = {
    8:  { row: 7, label: 'IIH3' },
    9:  { row: 8, label: 'II4' },
    10: { row: 8, label: 'IIH4' },
  };
  if (secondPos[semi]) return { string, ...secondPos[semi] };
  return null;
}

// Short finger label for VexFlow annotation below the stave.
export function stringFingerAnnotation(fp) {
  if (!fp) return '';
  return fp.label; // same label as on chart
}
