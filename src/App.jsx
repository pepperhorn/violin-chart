import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KEYS, generateScale, toMidi, noteWithOctave, parseNoteOctave } from './music.js';
import { fingeringFor, RANGE_LO, RANGE_HI } from './fingering.js';
import ChartDiagram from './ChartDiagram.jsx';
import VexScore from './VexScore.jsx';
import QuizBar from './QuizBar.jsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Soundfont } from 'smplr';
import confetti from 'canvas-confetti';
import { isCorrectGuess, pickHiddenKeys } from './quiz.js';

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

  // Unique (string:row) quiz cells derived from placements.
  const quizCells = useMemo(() => {
    const seen = new Map();
    placements.forEach((p) => {
      if (!p.fp) return;
      const key = `${p.fp.string}:${p.fp.row}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          string: p.fp.string,
          row: p.fp.row,
          fingerLabel: p.fp.label,
          note: p.note,
        });
      }
    });
    return [...seen.values()];
  }, [placements]);

  const [bpm, setBpm] = useState(100);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [quizMode, setQuizMode] = useState('off'); // 'off' | 'full' | 'partial'
  const [quizPercent, setQuizPercent] = useState(50);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [solvedKeys, setSolvedKeys] = useState(new Set());
  const [quizResults, setQuizResults] = useState({}); // key -> { triesUsed, correct }
  const [activeQuiz, setActiveQuiz] = useState(null); // quiz cell
  const [triesLeft, setTriesLeft] = useState(3);
  const [feedback, setFeedback] = useState(null);

  const levelMult = level === 'pro' ? 2 : level === 'intermediate' ? 1.5 : 1;
  const pointsForTries = (t) => (t === 1 ? 3 : t === 2 ? 2 : t === 3 ? 1 : 0);

  const hiddenKeys = useMemo(() => {
    if (quizMode === 'off') return new Set();
    if (quizMode === 'full') return new Set(quizCells.map((c) => c.key));
    return pickHiddenKeys(quizCells, quizPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizMode, quizPercent, quizCells, shuffleSeed]);

  const quizScore = useMemo(() => {
    const total = hiddenKeys.size;
    let earned = 0;
    for (const key of hiddenKeys) {
      const r = quizResults[key];
      if (r?.correct) earned += pointsForTries(r.triesUsed);
    }
    const max = total * 3 * levelMult;
    return { earned: Math.round(earned * levelMult * 10) / 10, max: Math.round(max * 10) / 10, total };
  }, [hiddenKeys, quizResults, levelMult]);

  // Reset quiz progress when inputs change.
  useEffect(() => {
    setSolvedKeys(new Set());
    setQuizResults({});
    setActiveQuiz(null);
    setFeedback(null);
  }, [quizMode, shuffleSeed, scaleNotes, level]);

  const printableRef = useRef(null);
  const audioCtxRef = useRef(null);
  const violinRef = useRef(null);
  const playTimersRef = useRef([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    setActiveIndex(null);
    playTimersRef.current.forEach(clearTimeout);
    playTimersRef.current = [];
  }, [scaleNotes]);

  function toSamplerNote(n) {
    return `${n.letter}${n.accidental}${n.octave}`;
  }

  async function ensureViolin() {
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
    return { ctx, violin: violinRef.current };
  }

  async function playOneNote(n) {
    try {
      const { ctx, violin } = await ensureViolin();
      violin.start({ note: toSamplerNote(n), time: ctx.currentTime + 0.02, duration: 1.0 });
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  }

  function onQuizCellClick(cell) {
    setActiveQuiz(cell);
    setTriesLeft(3);
    setFeedback(null);
  }

  function celebrate() {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.25 },
      zIndex: 50,
    });
  }

  function onQuizSubmit(value) {
    if (!activeQuiz) return;
    const ok = isCorrectGuess(value, activeQuiz.note);
    if (ok) {
      setFeedback('correct');
      const triesUsed = 4 - triesLeft;
      setQuizResults((prev) => ({ ...prev, [activeQuiz.key]: { triesUsed, correct: true } }));
      setSolvedKeys((prev) => {
        const next = new Set(prev);
        next.add(activeQuiz.key);
        return next;
      });
      celebrate();
      setTimeout(() => {
        setActiveQuiz(null);
        setFeedback(null);
      }, 900);
    } else {
      const remaining = triesLeft - 1;
      setTriesLeft(remaining);
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 400);
      if (remaining <= 0) {
        setFeedback('revealed');
        setQuizResults((prev) => ({ ...prev, [activeQuiz.key]: { triesUsed: 3, correct: false } }));
        setSolvedKeys((prev) => {
          const next = new Set(prev);
          next.add(activeQuiz.key);
          return next;
        });
        setTimeout(() => {
          setActiveQuiz(null);
          setFeedback(null);
        }, 1500);
      }
    }
  }

  function onQuizCancel() {
    setActiveQuiz(null);
    setFeedback(null);
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
      const violin = violinRef.current;
      setIsPlaying(true);
      const eighthSec = 60 / bpm / 2; // 8th note duration at current BPM
      const leadSec = 0.1;
      const startAt = ctx.currentTime + leadSec;
      scaleNotes.forEach((n, i) => {
        violin.start({ note: toSamplerNote(n), time: startAt + i * eighthSec, duration: eighthSec * 0.95 });
      });
      const leadMs = leadSec * 1000;
      const eighthMs = eighthSec * 1000;
      playTimersRef.current.forEach(clearTimeout);
      playTimersRef.current = [];
      scaleNotes.forEach((_, i) => {
        playTimersRef.current.push(setTimeout(() => setActiveIndex(i), leadMs + i * eighthMs));
      });
      playTimersRef.current.push(
        setTimeout(() => {
          setActiveIndex(null);
          setIsPlaying(false);
        }, leadMs + scaleNotes.length * eighthMs)
      );
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
    // Print output: force the printable sheet to white so it prints clean.
    doc.querySelectorAll('.printable').forEach((el) => {
      el.style.background = '#ffffff';
      el.style.boxShadow = 'none';
      el.style.border = '1px solid #cfc7b4';
    });
    // Fingered circles: default centering via reduced line-height + bottom
    // padding (compensates for html2canvas baseline drift). Circles that
    // carry an L/H tag shift the note letter down to leave room at the top.
    doc.querySelectorAll('.circle').forEach((el) => {
      const hasLabel = !!el.querySelector('.fp-label-inner');
      el.style.background = '#ffffff';
      if (hasLabel) {
        el.style.lineHeight = '1.75rem';
        el.style.paddingTop = '14px';
        el.style.paddingBottom = '0';
      } else {
        el.style.lineHeight = '1.75rem';
        el.style.paddingTop = '0';
        el.style.paddingBottom = '8px';
      }
    });
    // Open-string circles: larger letter, line-height tuned to keep the
    // glyph vertically centred (html2canvas pulls flex-centred text low).
    doc.querySelectorAll('.open-circle').forEach((el) => {
      el.style.lineHeight = '1.9rem';
      el.style.paddingBottom = '10px';
    });
    doc.querySelectorAll('.finger-label').forEach((el) => {
      el.style.lineHeight = '0.85rem';
      el.style.paddingBottom = '6px';
    });
    // Keep the L/H tag INSIDE the circle at the top (same side of the note
    // as on mobile). Hide the desktop external label and show the inner
    // pinned to the top with small rosin text.
    doc.querySelectorAll('.fp-label').forEach((el) => {
      el.style.display = 'none';
    });
    doc.querySelectorAll('.fp-label-inner').forEach((el) => {
      el.style.display = 'block';
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.right = '0';
      el.style.top = '4px';
      el.style.textAlign = 'center';
      el.style.fontSize = '0.55rem';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1';
      el.style.color = '#7A2F0B';
    });
  }

  // A4 is 8.27" wide. Target DPI / 72 gives scale vs. pt; but html2canvas
  // scale is relative to CSS pixels. We scale so the captured pixel width
  // corresponds to targetDpi across the A4 width when laid into the PDF.
  function captureScaleForDpi(node, targetDpi) {
    const a4WidthInches = 8.27;
    const targetPx = a4WidthInches * targetDpi;
    return Math.max(2, targetPx / node.clientWidth);
  }

  async function downloadPng() {
    const node = printableRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: captureScaleForDpi(node, 300),
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
      scale: captureScaleForDpi(node, 300),
      onclone: (doc) => adjustForCapture(doc),
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageW - w) / 2, 20, w, h, undefined, 'FAST');
    pdf.save(filename() + '.pdf');
  }

  const noteOptions = available.map(noteWithOctave);

  return (
    <div className="app min-h-screen p-3 sm:p-8">
      <div className="app-header relative mb-1">
        <div className="app-title-wrap flex items-baseline gap-2 sm:justify-center">
          <span className="app-title-mark hidden sm:inline text-[color:var(--rosin)] font-display italic text-2xl" aria-hidden>♪</span>
          <h1 className="app-title text-base sm:text-3xl text-left sm:text-center pr-24 sm:pr-0">No Fretts</h1>
        </div>
        <div className="download-buttons absolute top-0 right-0 flex items-center gap-1 sm:gap-2">
          <button
            onClick={play}
            disabled={isPlaying || isLoading}
            className="btn-play btn-pill px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold"
            title="Play"
          >
            {isLoading ? '…' : isPlaying ? '♪' : '▶'}
          </button>
          {quizMode === 'partial' && (
            <button
              onClick={() => setShuffleSeed((k) => k + 1)}
              className="btn-shuffle btn-pill-accent px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold"
              title="Shuffle hidden notes"
            >
              ⤭
            </button>
          )}
          <button
            onClick={() => {/* TODO: open share modal */}}
            className="btn-share px-1 transition"
            style={{ color: 'var(--rosin-deep)' }}
            title="Share"
            aria-label="Share"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button onClick={downloadPng} className="btn-png btn-pill px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold">PNG</button>
          <button onClick={downloadPdf} className="btn-pdf btn-pill px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold">PDF</button>
        </div>
      </div>
      <div className="title-rule max-w-2xl mx-auto mb-5" />


      <div className="controls grid grid-cols-3 gap-2 sm:gap-4 mb-3 max-w-2xl mx-auto">
        <label className="control-key flex flex-col">
          <span className="label-caps mb-1">Key</span>
          <select value={keyStr} onChange={(e) => setKeyStr(e.target.value)} className="select-key field-select px-2 py-1.5 text-sm">
            {KEYS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="control-start flex flex-col">
          <span className="label-caps mb-1">Starting from</span>
          <select value={startStr} onChange={(e) => setStartStr(e.target.value)} className="select-start field-select px-2 py-1.5 text-sm">
            {noteOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="control-end flex flex-col">
          <span className="label-caps mb-1">Ending on</span>
          <select value={endStr} onChange={(e) => setEndStr(e.target.value)} className="select-end field-select px-2 py-1.5 text-sm">
            {noteOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="controls-secondary grid grid-cols-3 gap-2 sm:gap-4 mb-5 max-w-2xl mx-auto">
        <label className="control-level flex flex-col">
          <span className="label-caps mb-1">Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="select-level field-select px-2 py-1.5 text-sm">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label className="control-quiz flex flex-col">
          <span className="label-caps mb-1">Quiz</span>
          <select
            value={quizMode}
            onChange={(e) => setQuizMode(e.target.value)}
            className="select-quiz field-select px-2 py-1.5 text-sm"
          >
            <option value="off">Off</option>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
          </select>
        </label>
        <div className="control-tempo flex flex-col">
          <span className="label-caps mb-1">Tempo</span>
          <button
            type="button"
            onClick={() => setTempoOpen((v) => !v)}
            className="btn-tempo-toggle field-select px-2 py-1.5 text-sm text-left flex items-center justify-between"
            aria-expanded={tempoOpen}
          >
            <span>{bpm} <span className="text-[color:var(--ink-soft)]">BPM</span></span>
            <span className="text-[0.6rem] text-[color:var(--rosin)]">{tempoOpen ? '▲' : '▼'}</span>
          </button>
        </div>
        {tempoOpen && (
          <label className="control-bpm col-span-3 flex flex-col">
            <span className="label-caps mb-1">Tempo · {bpm} BPM</span>
            <input
              type="range"
              min={60}
              max={240}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="slider-bpm slider-accent mt-1"
            />
          </label>
        )}
        {quizMode !== 'off' && quizScore.total > 0 && (() => {
          const pct = quizScore.max > 0 ? Math.round((quizScore.earned / quizScore.max) * 100) : 0;
          const answered = Object.keys(quizResults).filter((k) => hiddenKeys.has(k)).length;
          const isComplete = answered >= quizScore.total;
          return (
            <div className="quiz-score col-span-3 flex flex-col gap-1.5">
              <div className="quiz-score-row flex items-baseline justify-between">
                <span className={`text-sm ${isComplete ? 'font-display italic text-[color:var(--rosin-deep)] text-base' : 'font-semibold text-[color:var(--ink)]'}`}>
                  {isComplete ? `Final Score — ${pct}%` : `Score: ${pct}%`}
                </span>
                <span className="quiz-score-meta label-caps">{quizScore.total} {quizScore.total === 1 ? 'note' : 'notes'} · {level} ×{levelMult}</span>
              </div>
              <div className="quiz-score-bar score-bar-track w-full h-2 rounded-full overflow-hidden">
                <div
                  className="quiz-score-bar-fill score-bar-fill h-full transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isComplete && (
                <div className="quiz-score-actions flex gap-2 justify-center mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setQuizResults({}); setSolvedKeys(new Set()); setActiveQuiz(null); setFeedback(null); }}
                    className="btn-try-again btn-pill-accent px-3 py-1 text-xs font-semibold"
                  >
                    Try again
                  </button>
                  {quizMode === 'partial' && (
                    <button
                      type="button"
                      onClick={() => setShuffleSeed((k) => k + 1)}
                      className="btn-score-shuffle btn-pill-accent px-3 py-1 text-xs font-semibold"
                    >
                      ⤭ Shuffle
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        {quizMode === 'partial' && (
          <label className="control-quiz-percent col-span-3 flex flex-col">
            <span className="label-caps mb-1">Hide · {quizPercent}%</span>
            <input
              type="range"
              min={20}
              max={80}
              step={5}
              value={quizPercent}
              onChange={(e) => setQuizPercent(Number(e.target.value))}
              className="slider-quiz slider-accent mt-1"
            />
          </label>
        )}
      </div>

      <div ref={printableRef} className="printable p-3 sm:p-12 max-w-3xl mx-auto relative" style={{ aspectRatio: '210 / 297' }}>
        <QuizBar
          cell={activeQuiz}
          triesLeft={triesLeft}
          feedback={feedback}
          onSubmit={onQuizSubmit}
          onCancel={onQuizCancel}
          onPlayNote={() => activeQuiz && playOneNote(activeQuiz.note)}
        />
        <div className="printable-heading text-center mb-4">
          <div className="printable-eyebrow label-caps" style={{ color: 'var(--rosin)' }}>for Violin</div>
          <h2 className="printable-title text-3xl sm:text-4xl mt-1 mb-2">
            {(KEYS.find((k) => k.value === keyStr) || {}).label}
          </h2>
          <div className="printable-range font-display italic text-sm sm:text-base" style={{ color: 'var(--ink-soft)' }}>
            {startStr}&nbsp;—&nbsp;{endStr}
          </div>
          <svg
            className="printable-ornament mx-auto mt-3 block"
            viewBox="0 0 240 20"
            width="240"
            height="16"
            aria-hidden
          >
            <line x1="4" y1="10" x2="100" y2="10" stroke="var(--rosin)" strokeOpacity="0.55" strokeWidth="1" />
            <text
              x="120" y="15"
              textAnchor="middle"
              fontFamily="Fraunces, ui-serif, Georgia, serif"
              fontStyle="italic"
              fontSize="18"
              fill="var(--rosin)"
            >§</text>
            <line x1="140" y1="10" x2="236" y2="10" stroke="var(--rosin)" strokeOpacity="0.55" strokeWidth="1" />
          </svg>
        </div>
        <div className="vex-wrap mb-6 flex justify-center">
          <VexScore scaleNotes={scaleNotes} placements={placements} keyStr={keyStr} activeIndex={activeIndex} />
        </div>
        <ChartDiagram
          scaleNotes={scaleNotes}
          placements={placements}
          activeIndex={activeIndex}
          hiddenKeys={hiddenKeys}
          solvedKeys={solvedKeys}
          activeQuizKey={activeQuiz?.key}
          onCellClick={onQuizCellClick}
        />
      </div>
    </div>
  );
}
