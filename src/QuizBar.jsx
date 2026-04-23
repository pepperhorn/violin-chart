import React, { useEffect, useRef, useState } from 'react';

export default function QuizBar({ cell, onSubmit, onCancel, onPlayNote, feedback, triesLeft }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue('');
    if (inputRef.current) inputRef.current.focus();
  }, [cell]);

  if (!cell) return null;

  const locked = feedback === 'correct' || feedback === 'revealed';
  const prompt = cell.row === 0
    ? `Open ${cell.string} string — what note?`
    : `${cell.string} string, ${cell.fingerLabel} — what note?`;

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || locked) return;
    onSubmit(value);
  }

  return (
    <div className="quiz-bar sticky top-0 z-20 rounded-md px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
      <span className="quiz-prompt font-display italic text-sm sm:text-base flex-1 min-w-[12rem]" style={{ color: 'var(--ink)' }}>{prompt}</span>
      <form onSubmit={handleSubmit} className="quiz-form flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={locked}
          placeholder="F# or Gb"
          className={`quiz-input w-24 rounded px-2 py-1 text-sm font-semibold uppercase border ${feedback === 'wrong' ? 'animate-pulse' : ''}`}
          style={{
            borderColor: feedback === 'wrong' ? 'var(--rust)' : 'var(--rule)',
            background: feedback === 'wrong' ? '#F9D9C9' : 'transparent',
            color: 'var(--ink)',
          }}
          maxLength={3}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onPlayNote}
          className="btn-quiz-play btn-pill-accent px-2 py-1 text-sm font-semibold"
          aria-label="Play the note"
          title="Play the note"
        >
          ▶
        </button>
        <button
          type="submit"
          disabled={locked}
          className="btn-quiz-submit px-3 py-1 rounded-full text-sm font-semibold transition disabled:opacity-50"
          style={{ background: 'var(--ink)', color: 'var(--ivory)', border: '1px solid var(--ink)' }}
        >
          Check
        </button>
        <span className="quiz-tries label-caps whitespace-nowrap">
          Tries · {triesLeft}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="btn-quiz-cancel btn-pill px-2 py-1 text-sm font-semibold"
          aria-label="Close"
        >
          ×
        </button>
      </form>
    </div>
  );
}
