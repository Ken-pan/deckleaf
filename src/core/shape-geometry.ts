import type {ElementShadow} from './shape-schema';
import {shapePreset,type ShapeInsertTool} from './shapes';

/** Self-contained so portable HTML can use the same paths without application imports. */
export function createShapeGeometry() {
  type Shape = {type: string; shape?: string; w: number; h: number; radius?: number; shadow?: ElementShadow};
  type Point = {x: number; y: number};
  const number = (n: number) => Math.round(n * 1000) / 1000;
  const point = (p: Point) => `${number(p.x)} ${number(p.y)}`;
  function regular(count: number, star = false): Point[] {
    const points = Array.from({length: star ? count * 2 : count}, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / (star ? count * 2 : count), radius = star && i % 2 ? .42 : 1;
      return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius};
    });
    const xs = points.map(p => p.x), ys = points.map(p => p.y), l = Math.min(...xs), t = Math.min(...ys), w = Math.max(...xs) - l, h = Math.max(...ys) - t;
    return points.map(p => ({x: (p.x - l) / w, y: (p.y - t) / h}));
  }
  function shapePath(e: Shape): string {
    const kind = e.type === 'diamond' ? 'diamond' : e.shape;
    let vertices: Point[];
    switch (kind) {
      case 'triangle': vertices = [{x:.5,y:0},{x:1,y:1},{x:0,y:1}]; break;
      case 'diamond': vertices = [{x:.5,y:0},{x:1,y:.5},{x:.5,y:1},{x:0,y:.5}]; break;
      case 'pentagon': vertices = regular(5); break;
      case 'hexagon': vertices = [{x:.25,y:0},{x:.75,y:0},{x:1,y:.5},{x:.75,y:1},{x:.25,y:1},{x:0,y:.5}]; break;
      case 'star': vertices = regular(5, true); break;
      case 'arrow': vertices = [{x:0,y:.28},{x:.62,y:.28},{x:.62,y:0},{x:1,y:.5},{x:.62,y:1},{x:.62,y:.72},{x:0,y:.72}]; break;
      case 'chevron': vertices = [{x:0,y:0},{x:.6,y:0},{x:1,y:.5},{x:.6,y:1},{x:0,y:1},{x:.4,y:.5}]; break;
      default: vertices = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    }
    vertices = vertices.map(p => ({x: p.x * e.w, y: p.y * e.h}));
    if (!e.radius) return `M ${point(vertices[0])} ${vertices.slice(1).map(p => `L ${point(p)}`).join(' ')} Z`;
    const corners = vertices.map((v, i) => {
      const before = vertices[(i + vertices.length - 1) % vertices.length], after = vertices[(i + 1) % vertices.length];
      const inLength = Math.hypot(v.x - before.x, v.y - before.y), outLength = Math.hypot(after.x - v.x, after.y - v.y);
      const incoming = {x:(v.x-before.x)/inLength,y:(v.y-before.y)/inLength}, outgoing = {x:(after.x-v.x)/outLength,y:(after.y-v.y)/outLength};
      const turn = Math.abs(Math.atan2(incoming.x*outgoing.y-incoming.y*outgoing.x, incoming.x*outgoing.x+incoming.y*outgoing.y));
      const tangent = Math.tan(turn/2), distance = Math.min(e.radius! * tangent, inLength*.49, outLength*.49);
      const control = tangent > 1e-8 ? 4/3 * Math.tan(turn/4) * distance/tangent : 0;
      const start = {x:v.x-incoming.x*distance,y:v.y-incoming.y*distance}, end = {x:v.x+outgoing.x*distance,y:v.y+outgoing.y*distance};
      return {start,end,a:{x:start.x+incoming.x*control,y:start.y+incoming.y*control},b:{x:end.x-outgoing.x*control,y:end.y-outgoing.y*control}};
    });
    return `M ${point(corners[0].start)} ${corners.map((c,i) => `${i ? `L ${point(c.start)} ` : ''}C ${point(c.a)} ${point(c.b)} ${point(c.end)}`).join(' ')} Z`;
  }
  function shadowFilter(e: Pick<Shape, 'shadow'>): string {
    const s = e.shadow;
    if (!s || !s.opacity) return 'none';
    const color = s.color.slice(1), r = parseInt(color.slice(0,2),16), g = parseInt(color.slice(2,4),16), b = parseInt(color.slice(4,6),16);
    return `drop-shadow(${s.x}px ${s.y}px ${s.blur}px rgba(${r},${g},${b},${s.opacity}))`;
  }
  return {shapePath, shadowFilter};
}
export const {shapePath, shadowFilter} = createShapeGeometry();


export function shapePreview(tool: ShapeInsertTool, size: {w: number; h: number}, scale = 1): string {
  return shapePath({...shapePreset(tool), ...size, radius: tool === 'roundrect' ? 24 * scale : 0});
}
