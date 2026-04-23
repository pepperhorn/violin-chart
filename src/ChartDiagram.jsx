import React, { useLayoutEffect, useRef, useState } from 'react';
import { STRINGS } from './fingering.js';

function formatNote(n) {
  return n.letter + (n.accidental === '#' ? '♯' : n.accidental === 'b' ? '♭' : '');
}

const LABEL_COL_PX = 52; // 3.25rem
const MAX_PAD = 36;      // trapezoidal horizontal pad (px) at the nut
const STRING_COUNT = 4;

export default function ChartDiagram({ placements, activeIndex, hiddenKeys, solvedKeys, activeQuizKey, onCellClick }) {
  const grid = {};
  for (const s of STRINGS) grid[s] = {};
  placements.forEach(({ note, fp }, i) => {
    if (!fp) return;
    const key = `${fp.string}:${fp.row}`;
    grid[fp.string][fp.row] = {
      key,
      display: formatNote(note),
      label: fp.label,
      note,
      fingerLabel: fp.label,
      string: fp.string,
      row: fp.row,
      isActive: i === activeIndex,
    };
  });
  const hidden = hiddenKeys || new Set();
  const solved = solvedKeys || new Set();
  const isHidden = (key) => hidden.has(key) && !solved.has(key);

  // Row 0 handled by G/D/A/E header. Render fingers 1-4 always, plus any
  // 2nd-position rows that contain a note.
  const rowsToRender = [1, 2, 3, 4];
  for (const r of [5, 6, 7, 8]) {
    if (STRINGS.some((s) => grid[s][r])) rowsToRender.push(r);
  }
  const n = rowsToRender.length;

  const rowLabelFor = (r) => (r <= 4 ? String(r) : 'II' + (r - 4));
  const padFor = (idx) =>
    Math.max(0, Math.round(MAX_PAD * (1 - idx / Math.max(1, n - 1))));

  const bodyRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  // Column centers (within the full chart-body width, including label col).
  const contentWidthAt = (pad) => Math.max(0, dims.w - LABEL_COL_PX - 2 * pad);
  const xAt = (i, pad) => LABEL_COL_PX + pad + (contentWidthAt(pad) * (i + 0.5)) / STRING_COUNT;
  const topY = n > 0 ? dims.h / (2 * n) : 0;
  const botY = n > 0 ? dims.h - dims.h / (2 * n) : 0;

  return (
    <div className="chart-diagram w-full max-w-2xl mx-auto">
      <div
        className="chart-header grid grid-cols-[3.25rem_repeat(4,1fr)] items-center mb-1"
        style={{ paddingInline: padFor(0) }}
      >
        <div className="open-label text-right pr-2 text-sm italic leading-none font-display" style={{ color: 'var(--rosin-deep)' }}>Open</div>
        {STRINGS.map((s) => {
          const cell = grid[s][0];
          const openActive = cell?.isActive;
          const hiddenHere = cell && isHidden(cell.key);
          const isQuizActive = cell && activeQuizKey === cell.key;
          const base = 'open-circle w-12 h-12 sm:w-14 sm:h-14 rounded-full text-center text-lg sm:text-xl font-bold leading-[2.75rem] sm:leading-[3.25rem] transition-colors';
          const activeCls = openActive
            ? 'hl-saffron ring-2 ring-[color:var(--rosin)]'
            : hiddenHere
              ? (isQuizActive ? 'bg-[color:var(--saffron-soft)] text-[color:var(--ink)] cursor-pointer ring-2 ring-[color:var(--rosin)]' : 'bg-[color:var(--ivory)] text-[color:var(--ink)] cursor-pointer ring-2 ring-[color:var(--rule)]')
              : 'bg-[color:var(--ink)] text-[color:var(--ivory)]';
          return (
            <div key={s} className="string-label flex justify-center">
              <div
                className={`${base} ${activeCls}`}
                onClick={hiddenHere ? () => onCellClick?.(cell) : undefined}
                role={hiddenHere ? 'button' : undefined}
              >
                {hiddenHere ? '?' : s}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bodyRef} className="chart-body relative">
        {dims.w > 0 && (
          <svg
            className="strings-overlay absolute inset-0 pointer-events-none"
            width={dims.w}
            height={dims.h}
          >
            {Array.from({ length: STRING_COUNT }, (_, i) => (
              <line
                key={i}
                className="string-line"
                x1={xAt(i, padFor(0))}
                y1={topY}
                x2={xAt(i, padFor(n - 1))}
                y2={botY}
                stroke="var(--ink)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ))}
          </svg>
        )}

        {rowsToRender.map((row, idx) => (
          <div
            key={row}
            className="chart-row grid grid-cols-[3.25rem_repeat(4,1fr)] items-center py-3 sm:py-4 relative"
            style={{ paddingInline: padFor(idx) }}
          >
            <div className="row-label text-right pr-2 flex justify-end items-center">
              <span className="finger-label inline-block min-w-7 h-7 px-1.5 rounded-full border-[1.5px] text-center text-sm font-semibold whitespace-nowrap" style={{ lineHeight: '1.375rem', borderColor: 'var(--rule)', background: 'var(--ivory)', color: 'var(--ink)' }}>
                {rowLabelFor(row)}
              </span>
            </div>

            {STRINGS.map((s) => {
              const cell = grid[s][row];
              const showFpLabel = cell?.label && cell.label !== String(rowLabelFor(row));
              const hiddenHere = cell && isHidden(cell.key);
              const isQuizActive = cell && activeQuizKey === cell.key;
              const bg = cell?.isActive
                ? 'hl-saffron'
                : hiddenHere
                  ? (isQuizActive ? 'bg-[color:var(--saffron-soft)] text-[color:var(--ink)] cursor-pointer' : 'bg-[color:var(--ivory)] text-[color:var(--ink)] cursor-pointer')
                  : 'bg-[color:var(--ivory)] text-[color:var(--ink)]';
              return (
                <div key={s} className="cell relative flex items-center justify-center">
                  {showFpLabel && !hiddenHere && (
                    <span
                      className="fp-label hidden sm:inline absolute text-xs font-semibold whitespace-nowrap leading-none right-[calc(50%+1.75rem+10px)]"
                      style={{ color: 'var(--rosin-deep)' }}
                    >
                      {cell.label}
                    </span>
                  )}
                  <div
                    className={`circle relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[1.5px] text-center text-sm font-semibold leading-[2.75rem] sm:leading-[3.25rem] transition-colors ${bg}`}
                    style={{ borderColor: cell?.isActive ? 'var(--rosin)' : 'var(--rule)' }}
                    onClick={hiddenHere ? () => onCellClick?.(cell) : undefined}
                    role={hiddenHere ? 'button' : undefined}
                  >
                    {showFpLabel && !hiddenHere && (
                      <span className="fp-label-inner sm:hidden absolute left-0 right-0 top-1 text-[0.55rem] font-semibold leading-none" style={{ color: 'var(--rosin-deep)' }}>
                        {cell.label}
                      </span>
                    )}
                    {hiddenHere ? '?' : cell ? cell.display : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
