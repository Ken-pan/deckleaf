import type { SlideElement, TextRun } from './model';

/** Scale the full imported text hierarchy without rewriting its content or styles. */
export function scaledTextStyle(e: SlideElement, fontSize: number): Partial<SlideElement> {
  const ratio = fontSize / e.fontSize;
  const bounded = (n: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, Math.round(n * ratio * 100) / 100));
  const run = (r: TextRun): TextRun => ({...r,
    ...(r.fontSize !== undefined ? {fontSize: bounded(r.fontSize, 1, 1000)} : {}),
    ...(r.letterSpacing !== undefined ? {letterSpacing: bounded(r.letterSpacing, -50, 100)} : {}),
  });
  return {fontSize, letterSpacing: bounded(e.letterSpacing, -30, 50),
    ...(e.runs ? {runs: e.runs.map(run)} : {}),
    ...(e.paragraphs ? {paragraphs: e.paragraphs.map(p => ({...p, runs: p.runs.map(run), ...(p.endStyle ? {endStyle:run(p.endStyle)} : {}),
      spaceBefore: bounded(p.spaceBefore, 0, 2000), spaceAfter: bounded(p.spaceAfter, 0, 2000),
      indent: bounded(p.indent, -2000, 2000), firstLineIndent: bounded(p.firstLineIndent, -2000, 2000),
      ...(p.lineSpacing !== undefined ? {lineSpacing: bounded(p.lineSpacing, 1, 2000)} : {}),
    }))} : {}),
    ...(e.padding ? {padding: {left: bounded(e.padding.left, 0, 2000), right: bounded(e.padding.right, 0, 2000), top: bounded(e.padding.top, 0, 2000), bottom: bounded(e.padding.bottom, 0, 2000)}} : {}),
  };
}
