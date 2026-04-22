# CLAUDE.md

## Project

Violin scale-chart generator. React + Vite + Tailwind. Renders a scale on a VexFlow stave with finger + string annotations, and a fingerboard diagram with circles on 4 strings. PNG / PDF export via html2canvas + jsPDF. Playback via `smplr` (violin soundfont).

## Contextual class names

Every element carries a semantic class name alongside its Tailwind utilities. This makes the DOM legible in DevTools, gives tests and future style overrides a stable hook, and keeps the markup self-documenting.

Conventions used in this project:

- `block-name` — the component root (`app`, `printable`, `chart-diagram`, `vex-score`).
- `block-name__or-section` — substructures of a block, flat (no deep chains): `app-header`, `chart-header`, `chart-body`, `chart-row`, `download-buttons`.
- Role-oriented leaf names — describe *what the element is*, not how it looks: `circle`, `finger-label`, `fp-label`, `string-line`, `open-label`, `string-label`, `row-label`.
- Controls are named after the value they bind: `select-key`, `select-start`, `select-end`, `select-level`.
- Buttons use `btn-<action>`: `btn-play`, `btn-png`, `btn-pdf`.
- Modifier-ish variants use a suffix when needed: `chart-row-open` vs `chart-row-fingered`.

Rules of thumb:
- Prefer names that describe *role in the domain* (finger, string, circle) over visual traits (round, small, grey).
- One semantic class per meaningful element. Tailwind utilities come *after* the semantic class.
- Don't invent a class for a purely layout div if it has no identity of its own — but do when it represents a region (`vex-wrap`, `cell`, `controls`).

## html2canvas notes

html2canvas re-renders the DOM to a canvas; its text-layout engine is close to but not identical to the browser's. Known divergences we've hit:

1. **Flex-centered text drifts downward.** A `flex items-center justify-center` container rendered by html2canvas often places single-line text 5–10 px below where the browser places it. Fix: center text via `line-height` + `text-align: center` on a block, not flex. This is why `.circle` and `.finger-label` use `leading-[...]` + `text-center` instead of flex.

2. **Line-height still isn't identical.** Even with line-height centering, html2canvas places text a few pixels lower than Chrome/Safari. The export functions use html2canvas `onclone` to mutate the cloned document only — reducing `line-height` and adding `padding-bottom` on `.circle` and `.finger-label` at capture time. Live DOM stays centered; capture DOM compensates for the baseline drift. See `adjustForCapture` in `src/App.jsx`.

3. **Webfonts and system fonts.** html2canvas can't always access the same font metrics the browser used. Stick to common system stacks (we use the default Tailwind `ui-sans-serif, system-ui, …`) to minimise surprises.

4. **SVG rendering is honoured.** Our fingerboard "string" lines are an inline `<svg>` overlay — these render cleanly in html2canvas, unlike CSS-rotated line divs which often snap to integer pixels or drop.

5. **Transforms.** `transform: translate(...)` inside captured content is unreliable. Prefer `top` / `left` / `padding` adjustments.

If a future issue appears only in the downloaded PNG/PDF, the fix almost always lives in `onclone` rather than in the live stylesheet.

## Dev

```
npm install
npm run dev   # Vite on 0.0.0.0:5173
npm run build
```

Deploy: Coolify → Dockerfile build pack (multi-stage node → nginx:alpine, serves `/dist`, exposes 80).
