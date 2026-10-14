import type { Deck, SlideElement } from './model';

export type LayoutObjectRole = 'content' | 'frame' | 'auxiliary' | 'empty' | 'source';

/** Read authored rich text rather than assuming the plain-text fallback is populated. */
export function layoutText(e: SlideElement) {
  return e.paragraphs?.length ? e.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('\n')
    : e.runs?.length ? e.runs.map(r => r.text).join('') : e.text;
}

/** Size/family changes may not silently rewrite inline meaning, color or bullets. */
export function layoutContentSignature(e: SlideElement) {
  const runs = (values: NonNullable<SlideElement['runs']>) => values.map(({fontSize, fontFamily, letterSpacing, ...content}) => content);
  return JSON.stringify({text: e.text, runs: e.runs && runs(e.runs), paragraphs: e.paragraphs?.map(({spaceBefore, spaceAfter, indent, firstLineIndent, lineSpacing, runs: values, ...content}) => ({...content, runs: runs(values)}))});
}

/** A supporting mark or unresolved object is not evidence for a media-led composition. */
export function layoutObjectRole(e: SlideElement, deck: Pick<Deck, 'width' | 'height'>): LayoutObjectRole {
  const scale = Math.min(deck.width / 1440, deck.height / 810), area = deck.width * deck.height;
  if (e.hidden || e.opacity === 0) return 'empty';
  if (e.sourceRegion) return 'source';
  if (e.pageElement) return 'auxiliary';
  if (e.type === 'text') {
    if (!layoutText(e).trim() || (e.fill === 'transparent' && ![...(e.runs ?? []), ...(e.paragraphs?.flatMap(p => p.runs) ?? [])].some(r => r.color && r.color !== 'transparent'))) return 'empty';
    return 'content';
  }
  if (e.type === 'image') {
    if (!e.src) return 'empty';
    const namedMark = /^(?:logo(?:[ _-].*)?|wordmark|watermark|brand[ _-]?mark|徽标|标志|水印)$/i.test(e.name.trim());
    if (namedMark || (['icon', 'illustration'].includes(e.resource?.kind ?? '') && e.w * e.h <= area * .025)) return 'auxiliary';
    return 'content';
  }
  if (e.type === 'table') return e.cells?.some(row => row.some(cell => cell.trim())) ? 'content' : 'empty';
  if (e.type === 'chart') return e.chart?.labels.length || e.values?.length ? 'content' : 'empty';
  if (e.type === 'prototype') return e.prototype ? 'content' : 'empty';
  if (e.type === 'line') return 'auxiliary';
  if (e.fill === 'transparent' && (e.stroke === 'transparent' || !e.strokeWidth)) return 'empty';
  if (Math.min(e.w, e.h) <= 8 * scale || Math.max(e.w / e.h, e.h / e.w) >= 20) return 'auxiliary';
  return 'frame';
}

export function isLayoutHeading(e: SlideElement, scale: number) {
  if (e.type !== 'text' || e.fontSize < 30 * scale) return false;
  if (/^(?:title|headline|heading|标题|主标题|核心论点)$/i.test(e.name.trim())) return true;
  const text = layoutText(e).trim();
  return text.length <= 160 && text.split('\n').length <= 3 && !e.paragraphs?.some(p => p.bullet);
}
