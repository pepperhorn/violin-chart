import React, { useLayoutEffect, useRef, useState } from 'react';
import { STRINGS } from './fingering.js';

function formatNote(n) {
  return n.letter + (n.accidental === '#' ? '♯' : n.accidental === 'b' ? '♭' : '');
}

const LABEL_COL_PX = 52; // 3.25rem
const MAX_PAD = 36;      // trapezoidal horizontal pad (px) at the nut
const STRING_COUNT = 4;

export default function ChartDiagram({ placements }) {
  const grid = {};
  for (const s of STRINGS) grid[s] = {};
  for (const { note, fp } of placements) {
    if (!fp) continue;
    grid[fp.string][fp.row] = { display: formatNote(note), label: fp.label };
  }

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
        className="chart-header grid grid-cols-[3.25rem_repeat(4,1fr)] items-end mb-1"
        style={{ paddingInline: padFor(0) }}
      >
        <div className="open-label text-right pr-2 text-sm font-semibold italic leading-none">(Open)</div>
        {STRINGS.map((s) => (
          <div key={s} className="string-label text-center text-xl font-bold leading-none">{s}</div>
        ))}
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
                stroke="black"
                strokeWidth="2"
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
              <span className="finger-label inline-block min-w-7 h-7 px-1.5 rounded-full border-2 border-black bg-white text-center text-sm font-semibold whitespace-nowrap" style={{ lineHeight: '1.375rem' }}>
                {rowLabelFor(row)}
              </span>
            </div>

            {STRINGS.map((s) => {
              const cell = grid[s][row];
              const showFpLabel = cell?.label && cell.label !== String(rowLabelFor(row));
              return (
                <div key={s} className="cell relative flex items-center justify-center">
                  {showFpLabel && (
                    <span
                      className="fp-label absolute text-xs font-semibold whitespace-nowrap leading-none"
                      style={{ right: 'calc(50% + 1.6rem + 10px)' }}
                    >
                      {cell.label}
                    </span>
                  )}
                  <div className="circle w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-black bg-white text-center text-sm font-semibold leading-[2.75rem] sm:leading-[3.25rem]">
                    {cell ? cell.display : ''}
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
