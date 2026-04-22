import React, { useEffect, useRef } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Annotation,
  Beam,
  Voice,
  Formatter,
} from 'vexflow';

function vfKey(n) {
  const letter = n.letter.toLowerCase();
  const acc = n.accidental || '';
  return `${letter}${acc}/${n.octave}`;
}

export default function VexScore({ scaleNotes, placements, keyStr }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    if (!scaleNotes.length) return;

    const perNote = 38;
    const padding = 120; // clef + key signature
    const staveWidth = Math.max(320, padding + scaleNotes.length * perNote);
    const width = staveWidth + 20;
    const height = 160;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const stave = new Stave(10, 20, staveWidth);
    stave.addClef('treble');
    if (keyStr) stave.addKeySignature(keyStr);
    stave.setContext(ctx).draw();

    let prevString = null;
    const notes = scaleNotes.map((n, i) => {
      const sn = new StaveNote({
        keys: [vfKey(n)],
        duration: '8',
        auto_stem: true,
      });
      const p = placements[i];
      if (p?.fp?.label) {
        const fingerAnno = new Annotation(p.fp.label)
          .setFont('Arial', 10)
          .setVerticalJustification(Annotation.VerticalJustify.TOP);
        sn.addModifier(fingerAnno, 0);
      }
      if (p?.fp?.string && p.fp.string !== prevString) {
        const stringAnno = new Annotation(p.fp.string)
          .setFont('Arial', 11, 'bold')
          .setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        stringAnno.setYShift(10);
        sn.addModifier(stringAnno, 0);
        prevString = p.fp.string;
      }
      return sn;
    });

    const beams = Beam.generateBeams(notes);

    const voice = new Voice({ num_beats: notes.length, beat_value: 8 });
    voice.setStrict(false);
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], staveWidth - padding);
    voice.draw(ctx, stave);
    beams.forEach((b) => b.setContext(ctx).draw());
  }, [scaleNotes, placements, keyStr]);

  return <div ref={containerRef} className="vex-score max-w-full overflow-x-auto mx-auto flex justify-center" />;
}
