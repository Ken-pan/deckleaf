import type {SlideElement} from './model';
import type {DrawingPoint} from './drawing-settings';

type Point = Pick<DrawingPoint, 'x' | 'y'>;
export type DrawingStroke = {id: string; points: Point[]; closed: boolean; radius: number};

/** Read only our portable stroke SVGs, including strokes saved before the marker. */
export function prepareDrawingStroke(element: SlideElement): DrawingStroke | null {
  if (element.type !== 'image' || element.locked || element.hidden || element.opacity === 0 || element.sourceId || element.sourceRegion || element.resource || element.crop || element.fit !== 'fill' || !element.src?.startsWith('data:image/svg+xml;base64,')) return null;
  try {
    const svg = atob(element.src.slice('data:image/svg+xml;base64,'.length));
    if (svg.length > 2_000_000 || !svg.includes('data-deck-drawing="1"') && !/^(Pen|Brush|Highlighter) drawing$/.test(element.name)) return null;
    const match = svg.match(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"(?: data-deck-drawing="1")? width="[\d.]+" height="[\d.]+" viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)">(<(?:path|circle|rect) [^<>]+\/>)(?:<\/svg>)$/);
    if (!match) return null;
    const [, vx, vy, vw, vh, body] = match, x = +vx, y = +vy, w = +vw, h = +vh;
    if (!(w > 0 && h > 0)) return null;
    const attr = (name: string) => body.match(new RegExp(`(?:^| )${name}="([^"]+)"`))?.[1];
    const num = (name: string) => Number(attr(name));
    let points: Point[] = [], closed = false, radius = 0;
    if (body.startsWith('<circle ')) {points = [{x: num('cx'), y: num('cy')}]; radius = num('r');}
    else if (body.startsWith('<rect ')) {
      const rx = num('x'), ry = num('y'), rw = num('width'), rh = num('height');
      points = [{x: rx, y: ry}, {x: rx + rw, y: ry}, {x: rx + rw, y: ry + rh}, {x: rx, y: ry + rh}]; closed = true;
    } else {
      const d = attr('d') ?? '';
      if (!/^[MLQZ\d.\s-]+$/.test(d)) return null;
      const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g) ?? [];
      let i = 0;
      const point = () => ({x: Number(tokens[i++]), y: Number(tokens[i++])});
      while (i < tokens.length) {
        const command = tokens[i++];
        if (command === 'M' || command === 'L') points.push(point());
        else if (command === 'Q' && points.length) {
          const from = points.at(-1)!, control = point(), to = point();
          // Match the saved quadratic curve rather than its rectangular image frame.
          for (let step = 1; step <= 12; step++) {
            const t = step / 12, u = 1 - t;
            points.push({x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y});
          }
        } else if (command === 'Z') closed = true;
        else return null;
      }
      radius = attr('stroke') ? num('stroke-width') / 2 : 0;
    }
    if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || !Number.isFinite(radius)) return null;
    const angle = element.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    points = points.map(p => {
      const dx = ((p.x - x) / w - .5) * element.w * (element.flipX ? -1 : 1);
      const dy = ((p.y - y) / h - .5) * element.h * (element.flipY ? -1 : 1);
      return {x: element.x + element.w / 2 + c * dx - s * dy, y: element.y + element.h / 2 + s * dx + c * dy};
    });
    return {id: element.id, points, closed, radius: radius * Math.max(element.w / w, element.h / h)};
  } catch {return null;}
}

function distance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
}
const cross = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
    && Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y)
    && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
}
function contains(points: Point[], point: Point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Sweep the whole pointer segment so a fast drag cannot skip a thin stroke. */
export function drawingStrokeHit(stroke: DrawingStroke, from: Point, to: Point, radius: number): boolean {
  const points = stroke.points, reach = radius + stroke.radius;
  if (stroke.closed && (contains(points, from) || contains(points, to))) return true;
  if (points.length === 1) return distance(points[0], from, to) <= reach;
  for (let i = 0; i < points.length - (stroke.closed ? 0 : 1); i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (intersects(from, to, a, b) || Math.min(distance(from, a, b), distance(to, a, b), distance(a, from, to), distance(b, from, to)) <= reach) return true;
  }
  return false;
}
