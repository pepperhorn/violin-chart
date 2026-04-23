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
    <div className="quiz-bar sticky top-0 z-20 bg-yellow-50 border-2 border-black rounded-lg px-3 py-2 mb-3 flex flex-wrap items-center gap-2 shadow">
      <span className="quiz-prompt text-sm font-semibold flex-1 min-w-[12rem]">{prompt}</span>
      <form onSubmit={handleSubmit} className="quiz-form flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={locked}
          placeholder="e.g. F# or Gb"
          className={`quiz-input w-24 border-2 border-black rounded px-2 py-1 text-sm font-semibold uppercase ${feedback === 'wrong' ? 'quiz-input-wrong bg-red-100 animate-pulse' : ''}`}
          maxLength={3}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onPlayNote}
          className="btn-quiz-play px-2 py-1 border-2 border-black rounded text-sm font-semibold hover:bg-black hover:text-white transition"
          aria-label="Play the note"
          title="Play the note"
        >
          ▶
        </button>
        <button
          type="submit"
          disabled={locked}
          className="btn-quiz-submit px-3 py-1 border-2 border-black rounded text-sm font-semibold bg-black text-white hover:bg-white hover:text-black transition disabled:opacity-50"
        >
          Check
        </button>
        <span className="quiz-tries text-xs font-semibold whitespace-nowrap">
          Tries: {triesLeft}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="btn-quiz-cancel px-2 py-1 border-2 border-black rounded text-sm font-semibold hover:bg-black hover:text-white transition"
          aria-label="Close"
        >
          ×
        </button>
      </form>
    </div>
  );
}
