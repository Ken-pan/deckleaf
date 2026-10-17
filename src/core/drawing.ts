import {element, type SlideElement} from './model';

import {DRAWING_BRUSHES, type DrawingSettings, type DrawingPoint} from './drawing-settings';
export * from './drawing-settings';

const n = (value: number) => Number(value.toFixed(2));
const xy = (point: Pick<DrawingPoint, 'x' | 'y'>) => `${n(point.x)} ${n(point.y)}`;
function settings(value: DrawingSettings): DrawingSettings {
  if (!DRAWING_BRUSHES.some(brush => brush.id === value.brush) || !/^#[\da-f]{6}$/i.test(value.color) || !Number.isFinite(value.size)) throw new Error('Choose a brush, color and size.');
  return {...value, size: Math.max(1, Math.min(64, value.size))};
}
function validPoints(points: readonly DrawingPoint[]) {
  return points.length > 0 && points.length <= 12000 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.pressure));
}
function smoothPath(points: readonly Pick<DrawingPoint, 'x' | 'y'>[]) {
  let path = `M ${xy(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) path += ` Q ${xy(points[i])} ${xy({x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2})}`;
  return path + (points.length > 1 ? ` L ${xy(points.at(-1)!)}` : '');
}

/** Pure SVG geometry is shared by the live preview and the saved object. */
export function drawingMarkup(points: readonly DrawingPoint[], value: DrawingSettings): string {
  if (!validPoints(points)) return '';
  const {brush, color, size} = settings(value), first = points[0];
  if (points.length === 1) return brush === 'highlighter'
    ? `<rect x="${n(first.x - size / 2)}" y="${n(first.y - size / 2)}" width="${size}" height="${size}" fill="${color}" opacity="0.35"/>`
    : `<circle cx="${n(first.x)}" cy="${n(first.y)}" r="${size / 2}" fill="${color}"/>`;
  if (brush !== 'brush') return `<path d="${smoothPath(points)}" fill="none" stroke="${color}" stroke-width="${size}" stroke-linecap="${brush === 'highlighter' ? 'square' : 'round'}" stroke-linejoin="round"${brush === 'highlighter' ? ' opacity="0.35"' : ''}/>`;
  const left: {x: number; y: number}[] = [], right: {x: number; y: number}[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    const taper = Math.min(1, .45 + i / 4, .45 + (points.length - 1 - i) / 4);
    const radius = size / 2 * (.25 + .75 * Math.max(0, Math.min(1, point.pressure))) * taper;
    left.push({x: point.x - dy / length * radius, y: point.y + dx / length * radius});
    right.push({x: point.x + dy / length * radius, y: point.y - dx / length * radius});
  }
  return `<path d="${smoothPath(left)} L ${xy(right.at(-1)!)} ${smoothPath(right.reverse()).replace(/^M [\d.\-]+ [\d.\-]+/, '')} Z" fill="${color}"/>`;
}

/** One completed stroke is one ordinary, portable image object and history entry. */
export function drawingElement(points: readonly DrawingPoint[], value: DrawingSettings, page: {width: number; height: number}): SlideElement {
  if (!validPoints(points)) throw new Error('This stroke could not be saved. Draw it again.');
  const config = settings(value), pad = config.size;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);}
  const x = Math.max(0, Math.min(page.width - 1, minX - pad)), y = Math.max(0, Math.min(page.height - 1, minY - pad));
  const w = Math.max(1, Math.min(page.width, maxX + pad) - x), h = Math.max(1, Math.min(page.height, maxY + pad) - y);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-deck-drawing="1" width="${n(w)}" height="${n(h)}" viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}">${drawingMarkup(points, config)}</svg>`;
  return element('image', {name: `${DRAWING_BRUSHES.find(brush => brush.id === config.brush)!.label} drawing`, x, y, w, h, src: `data:image/svg+xml;base64,${btoa(svg)}`, fit: 'fill', aspectRatioLocked: true});
}
