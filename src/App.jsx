import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KEYS, generateScale, toMidi, noteWithOctave, parseNoteOctave } from './music.js';
import { fingeringFor, RANGE_LO, RANGE_HI } from './fingering.js';
import ChartDiagram from './ChartDiagram.jsx';
import VexScore from './VexScore.jsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Soundfont } from 'smplr';

// Build the set of every scale note (all octaves) for a key, filtered to
// violin range — used to populate start/end dropdowns.
function scaleNotesInRange(keyStr) {
  // Generate a very wide scale then filter
  const wide = generateScale(keyStr, 'default', 'C1', 'C8');
  return wide.filter((n) => n.midi >= RANGE_LO && n.midi <= RANGE_HI);
}

export default function App() {
  const [keyStr, setKeyStr] = useState('G');
  const [level, setLevel] = useState('beginner');
  const available = useMemo(() => scaleNotesInRange(keyStr), [keyStr]);

  const defaultStart = available[0] ? noteWithOctave(available[0]) : 'G3';
  const defaultEnd = (() => {
    const end = available.find((n) => n.midi >= (available[0]?.midi ?? 0) + 24);
    return end ? noteWithOctave(end) : (available[available.length - 1] ? noteWithOctave(available[available.length - 1]) : 'G5');
  })();

  const [startStr, setStartStr] = useState(defaultStart);
  const [endStr, setEndStr] = useState(defaultEnd);

  // Reset start/end if key changes and current selection isn't valid
  useEffect(() => {
    const names = available.map(noteWithOctave);
    if (!names.includes(startStr)) setStartStr(names[0] || '');
    if (!names.includes(endStr)) {
      const startIdx = Math.max(0, names.indexOf(startStr));
      const target = names[startIdx + 14] || names[names.length - 1] || '';
      setEndStr(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr]);

  const scaleNotes = useMemo(
    () => generateScale(keyStr, 'default', startStr, endStr),
    [keyStr, startStr, endStr],
  );

  const placements = useMemo(
    () => scaleNotes.map((note) => ({ note, fp: fingeringFor(note.midi, { level }) })),
    [scaleNotes, level],
  );

  const printableRef = useRef(null);
  const audioCtxRef = useRef(null);
  const violinRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function toSamplerNote(n) {
    return `${n.letter}${n.accidental}${n.octave}`;
  }

  async function play() {
    if (isPlaying || !scaleNotes.length) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (!violinRef.current) {
        setIsLoading(true);
        violinRef.current = new Soundfont(ctx, { instrument: 'violin' });
        await violinRef.current.load;
        setIsLoading(false);
      }
      setIsPlaying(true);
      const violin = violinRef.current;
      const eighthSec = 60 / 100 / 2; // quarter=100 BPM, 8th notes = 0.3s each
      const startAt = ctx.currentTime + 0.1;
      scaleNotes.forEach((n, i) => {
        violin.start({ note: toSamplerNote(n), time: startAt + i * eighthSec, duration: eighthSec * 0.95 });
      });
      const totalMs = (scaleNotes.length * eighthSec + 0.1) * 1000;
      setTimeout(() => setIsPlaying(false), totalMs);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }

  const sanitize = (s) => s.replace(/[^\w.-]+/g, '_');
  const filename = () => `violin-scale_${sanitize(keyStr)}_${sanitize(startStr)}-${sanitize(endStr)}`;

  // html2canvas renders text ~8px lower than the browser for line-height
  // centered content, so adjust line-heights in the clone only.
  function adjustForCapture(doc) {
    doc.querySelectorAll('.circle').forEach((el) => {
      el.style.lineHeight = '1.75rem';
      el.style.paddingBottom = '8px';
    });
    doc.querySelectorAll('.finger-label').forEach((el) => {
      el.style.lineHeight = '0.85rem';
      el.style.paddingBottom = '6px';
    });
  }

  async function downloadPng() {
    const node = printableRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: 2,
      onclone: (doc) => adjustForCapture(doc),
    });
    const link = document.createElement('a');
    link.download = filename() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function downloadPdf() {
    const node = printableRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: 2,
      onclone: (doc) => adjustForCapture(doc),
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageW - w) / 2, 20, w, h);
    pdf.save(filename() + '.pdf');
  }

  const noteOptions = available.map(noteWithOctave);

  return (
    <div className="app min-h-screen bg-white text-black p-3 sm:p-6">
      <div className="app-header relative mb-3">
        <h1 className="app-title text-lg sm:text-2xl font-bold text-center">Violin Scale Chart</h1>
        <div className="download-buttons absolute top-0 right-0 flex gap-2">
          <button
            onClick={play}
            disabled={isPlaying || isLoading}
            className="btn-play px-3 py-1.5 border-2 border-black rounded text-sm font-semibold hover:bg-black hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading…' : isPlaying ? 'Playing…' : '▶ Play'}
          </button>
          <button onClick={downloadPng} className="btn-png px-3 py-1.5 border-2 border-black rounded text-sm font-semibold hover:bg-black hover:text-white transition">PNG</button>
          <button onClick={downloadPdf} className="btn-pdf px-3 py-1.5 border-2 border-black rounded text-sm font-semibold hover:bg-black hover:text-white transition">PDF</button>
        </div>
      </div>

      <div className="controls grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 max-w-2xl mx-auto">
        <label className="control-key flex flex-col text-xs font-semibold">
          Key
          <select value={keyStr} onChange={(e) => setKeyStr(e.target.value)} className="select-key mt-1 border-2 border-black rounded px-2 py-1.5 text-sm font-normal">
            {KEYS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="control-start flex flex-col text-xs font-semibold">
          Starting from
          <select value={startStr} onChange={(e) => setStartStr(e.target.value)} className="select-start mt-1 border-2 border-black rounded px-2 py-1.5 text-sm font-normal">
            {noteOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="control-end flex flex-col text-xs font-semibold">
          Ending on
          <select value={endStr} onChange={(e) => setEndStr(e.target.value)} className="select-end mt-1 border-2 border-black rounded px-2 py-1.5 text-sm font-normal">
            {noteOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="control-level flex flex-col text-xs font-semibold">
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="select-level mt-1 border-2 border-black rounded px-2 py-1.5 text-sm font-normal">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="pro">Pro</option>
          </select>
        </label>
      </div>

      <div ref={printableRef} className="printable bg-white p-6 sm:p-10 border border-black/10 max-w-3xl mx-auto" style={{ aspectRatio: '210 / 297' }}>
        <h2 className="printable-title text-2xl font-bold text-center mb-3">
          {(KEYS.find((k) => k.value === keyStr) || {}).label} — {startStr} to {endStr}
        </h2>
        <div className="vex-wrap mb-6 flex justify-center">
          <VexScore scaleNotes={scaleNotes} placements={placements} keyStr={keyStr} />
        </div>
        <ChartDiagram scaleNotes={scaleNotes} placements={placements} />
      </div>
    </div>
  );
}
