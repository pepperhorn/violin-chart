# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Violin scale-chart generator. A user picks a key, start/end notes, and difficulty level; the app renders (a) the scale on a VexFlow treble-clef stave as eighth notes with finger + string annotations, and (b) a fingerboard diagram showing which finger on which string plays each note. Supports PNG/PDF export and audio playback through a violin soundfont.

## Commands

```
npm install
npm run dev          # Vite dev server on 0.0.0.0:5173 (network-accessible)
npm run build        # Production build to dist/
npm run preview      # Serve the built dist/ locally
```

There is no test suite and no linter configured. Verification is via `npm run build` and manual dogfooding in the browser (especially the PNG/PDF export, which hits html2canvas — see notes below).

Deploy target is Coolify using the included `Dockerfile` (multi-stage node → nginx:alpine, serves `/dist`, exposes port 80). `nginx.conf` configures SPA fallback and asset caching.

## Architecture

The app has a clean data flow across four pure modules and two render components:

```
User input (key, start, end, level)
          │
          ▼
   music.js  ──────────────────►  generateScale(keyStr, scaleType, startStr, endStr)
                                      returns [{letter, accidental, octave, midi}]
          │
          ▼
   fingering.js  ─────────────►  fingeringFor(midi, {level})
                                      returns {string, row, label}
          │
          ├────────────────► VexScore.jsx       (stave + annotations)
          ├────────────────► ChartDiagram.jsx   (fingerboard diagram)
          └────────────────► smplr Soundfont   (audio playback)
```

- **`src/music.js`** — music theory. Owns the 14 major + 10 natural-minor key signatures. `generateScale` iterates through the 7 scale letters, applies the key's accidentals, enumerates pitches across octaves, then slices to the user's `[start, end]` range. **If start > end, the result is reversed (descending)** — this convention is relied on downstream.
- **`src/fingering.js`** — violin fingering. `RANGE_LO`/`RANGE_HI` define the student range (G3–D6). `fingeringFor(midi, {level})` picks the highest string where `midi >= open`, computes `semi = midi - open`, then maps semitones to `{row, label}`. Rows: `0` = open (handled by the header, not a drawn row), `1-4` = 1st-position fingers, `5-8` = 2nd position. `level: 'intermediate' | 'pro'` swaps open-string notes (D4/A4/E5) for 4th finger on the lower string.
- **`src/ChartDiagram.jsx`** — the fingerboard chart. Trapezoidal perspective: `padFor(idx)` gives each row progressively less inline padding, so the 4 columns widen from the nut (top, narrow) toward the bridge (bottom, wide). The 4 "strings" are a single `<svg>` overlay with 4 `<line>` elements whose top/bottom x-coordinates come from the same math — circles (white-filled) sit on top, hiding the lines behind them. A `ResizeObserver` keeps the SVG coords in sync with container width. Only rows 5–8 that actually receive a note are rendered.
- **`src/VexScore.jsx`** — the notation view. Builds `StaveNote`s at duration `"8"` and uses `Beam.generateBeams` so beaming follows VexFlow's defaults. Each note gets two `Annotation` modifiers: finger label above (TOP), string letter below (BOTTOM), but **the string letter is only added on the first note of a new string** (tracked via `prevString`). Key signature is drawn on the stave, so in-key accidentals are not re-printed on note heads.
- **`src/App.jsx`** — orchestrator. Holds UI state (`keyStr`, `level`, `startStr`, `endStr`), memoises `scaleNotes` and `placements`, and wires the three outputs (VexScore, ChartDiagram, playback). Audio playback lazy-loads `smplr`'s violin Soundfont on first Play click, then schedules notes at `60/100/2 = 0.3 s` per eighth note (quarter = 100 BPM).

### The row/label system

The worksheet has two kinds of labels, don't confuse them:
- **Row label** (left of each diagram row): the finger number as a small circle — `"1"..."4"` for 1st position, `"II1"..."II4"` for 2nd position.
- **`fp-label`** (left of a specific circle): the *full* fingering identifier from `fingering.js` (e.g. `L2`, `H3`, `IIH4`). It's only drawn when it differs from the row label — i.e. only on finger-low / finger-high / 2nd-position variants, never on plain naturals.

## Contextual class names

Every element carries a semantic class name alongside its Tailwind utilities. Semantic class first, utilities after.

- `block-name` for component roots (`app`, `printable`, `chart-diagram`, `vex-score`).
- `block-name-section` for substructures, flat (no deep chains): `app-header`, `chart-header`, `chart-body`, `chart-row`, `download-buttons`.
- Role-oriented leaves: `circle`, `finger-label`, `fp-label`, `string-line`, `open-label`, `string-label`, `row-label`, `cell`.
- Controls named after the bound value: `select-key`, `select-start`, `select-end`, `select-level`.
- Buttons: `btn-play`, `btn-png`, `btn-pdf`.
- Modifier variants use a suffix: `chart-row-open`, `chart-row-fingered`.

Prefer names that describe *role in the domain* (finger, string, circle) over visual traits. Don't invent a class for a pure layout div that has no identity of its own.

## html2canvas quirks (export pipeline)

html2canvas re-renders the DOM to a canvas; its text layout is close to but not identical to the browser's. Known divergences we've hit, and how the code accommodates them:

1. **Flex-centered text drifts downward** by 5–10 px. That's why `.circle` and `.finger-label` center text with `line-height` + `text-center` instead of `flex items-center justify-center`.
2. **Residual baseline drift.** Even with line-height centering, the capture sits a few pixels low. `adjustForCapture(doc)` in `src/App.jsx` runs inside html2canvas's `onclone` hook — it reduces `line-height` and adds `padding-bottom` on `.circle` and `.finger-label` **only in the cloned document**, so the live DOM stays correct.
3. **SVG renders cleanly.** The fingerboard "string" lines are an inline `<svg>` overlay precisely because rotated/CSS-drawn lines misrender in html2canvas.
4. **Transforms are unreliable** inside captured content — prefer `top`/`left`/`padding`. Stick to system fonts (Tailwind's default stack) to avoid font-metric mismatches.

If an export-only visual bug appears, the fix almost always belongs in `onclone`, not in the live stylesheet.

## Global conventions (from ~/.claude/CLAUDE.md)

- Dev servers always bind to `0.0.0.0` (already in the `dev` script).
- Every element should have a contextual class name alongside Tailwind utilities.
