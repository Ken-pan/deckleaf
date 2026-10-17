import type {Slide, SlideElement} from './model';
import type {Operation} from './operations';
import type {DrawingBrush} from './drawing-settings';
import {isDrawingElement} from './drawing-identity';

export type DrawingStyle = {color: string; brush: DrawingBrush; size: number};

function source(element: SlideElement): {svg: string; body: string} | null {
  if (!isDrawingElement(element) || !element.src || element.src.length > 2_700_000) return null;
  try {
    const svg = atob(element.src.slice('data:image/svg+xml;base64,'.length));
    const match = svg.match(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"(?: data-deck-drawing="1")? width="[\d.]+" height="[\d.]+" viewBox="[\d.]+ [\d.]+ [\d.]+ [\d.]+">(<(?:path|circle|rect) [^<>]+\/>)(?:<\/svg>)$/);
    return match ? {svg, body: match[1]} : null;
  } catch {return null;}
}

export function drawingStyle(element: SlideElement): DrawingStyle | null {
  const drawing = source(element);
  if (!drawing) return null;
  const color = drawing.body.match(/(?:stroke|fill)="(#[\da-f]{6})"/i)?.[1];
  if (!color) return null;
  const brush: DrawingBrush = /opacity="0\.35"/.test(drawing.body) ? 'highlighter' : /stroke="/.test(drawing.body) ? 'pen' : element.name.startsWith('Pen ') ? 'pen' : 'brush';
  const width = Number(drawing.body.match(/stroke-width="([\d.]+)"/)?.[1]);
  return {color, brush, size: Number.isFinite(width) && width > 0 ? Math.min(64, width) : brush === 'highlighter' ? 24 : brush === 'pen' ? 4 : 12};
}

/** Recolor only the stroke paint; retain its paths, transforms and intrinsic alpha. */
export function drawingColorPatch(element: SlideElement, color: string): Pick<SlideElement, 'src'> | null {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Use a six-digit hex color.');
  if (element.locked) return null;
  const drawing = source(element);
  if (!drawing) return null;
  const body = drawing.body.replace(/\b(stroke|fill)="#[\da-f]{6}"/gi, (_, paint: string) => `${paint}="${color}"`);
  if (body === drawing.body) return null;
  return {src: `data:image/svg+xml;base64,${btoa(drawing.svg.replace(drawing.body, body))}`};
}

export function drawingSelection(items: readonly SlideElement[]) {
  const styles = items.map(drawingStyle);
  const first = styles.find(style => style !== null);
  return {
    all: items.length > 0 && styles.every(style => style !== null),
    any: styles.some(style => style !== null),
    color: first?.color ?? '#252b29',
    mixedColor: styles.some(style => style?.color.toLowerCase() !== first?.color.toLowerCase()),
    brush: first && styles.every(style => style?.brush === first.brush) ? first.brush : null,
    first,
  };
}

export function drawingColorOperations(slide: Pick<Slide, 'id' | 'elements'>, ids: readonly string[], color: string): Operation[] {
  return slide.elements.filter(item => ids.includes(item.id)).flatMap(item => {
    const patch = drawingColorPatch(item, color);
    return patch ? [{op: 'update_element' as const, slideId: slide.id, elementId: item.id, patch}] : [];
  });
}
