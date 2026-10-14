import type { SlideElement } from './model';
import type { ElementShadow, ShapeVariant } from './shape-schema';

export const SHAPE_TOOLS = ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'pentagon', 'hexagon', 'star', 'arrow', 'chevron', 'line'] as const;
export type ShapeInsertTool = typeof SHAPE_TOOLS[number];
export const SHAPE_LABELS: Record<ShapeInsertTool, string> = {
  rect: 'Rectangle', roundrect: 'Rounded rectangle', ellipse: 'Ellipse', diamond: 'Diamond',
  triangle: 'Triangle', pentagon: 'Pentagon', hexagon: 'Hexagon', star: 'Star', arrow: 'Arrow', chevron: 'Chevron', line: 'Line',
};
export function isShapeTool(value: string | null | undefined): value is ShapeInsertTool {
  return SHAPE_TOOLS.includes(value as ShapeInsertTool);
}
export function isShape(e?: Pick<SlideElement, 'type'>): boolean { return Boolean(e && ['rect', 'ellipse', 'diamond', 'line'].includes(e.type)); }
export function hasShapeCorners(e: Pick<SlideElement, 'type'>): boolean { return e.type === 'rect' || e.type === 'diamond'; }
export function shapeKind(e: Pick<SlideElement, 'type' | 'shape'>): ShapeInsertTool {
  return e.type === 'rect' ? e.shape ?? 'rect' : e.type as ShapeInsertTool;
}
export function shapePreset(tool: ShapeInsertTool): Partial<SlideElement> & {type: SlideElement['type']} {
  if (['rect', 'ellipse', 'diamond', 'line'].includes(tool)) return {type: tool as SlideElement['type'], shape: undefined};
  return {type: 'rect', shape: tool === 'roundrect' ? undefined : tool as ShapeVariant, ...(tool === 'roundrect' ? {radius: 24} : {})};
}

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

/** Rounded and concave shapes select by their visible contour, not the empty frame corners. */
export function shapeContains(e: Pick<SlideElement,'type'|'shape'|'w'|'h'|'radius'>, p:{x:number;y:number}, tolerance=0):boolean {
  const tokens=shapePath(e).match(/[MLCZ]|-?\d+(?:\.\d+)?/g)!;
  const outline:{x:number;y:number}[]=[];let i=0,at={x:0,y:0};
  const point=()=>({x:Number(tokens[i++]),y:Number(tokens[i++])});
  while(i<tokens.length){
    const command=tokens[i++];
    if(command==='M'||command==='L'){at=point();outline.push(at);}
    else if(command==='C'){
      const a=point(),b=point(),end=point(),start=at;
      for(let step=1;step<=12;step++){const t=step/12,u=1-t;outline.push({x:u*u*u*start.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*end.y});}
      at=end;
    }
  }
  let inside=false;
  for(let j=0;j<outline.length;j++){
    const a=outline[j],b=outline[(j+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
    if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=Math.max(1e-6,tolerance))return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

export function shapePreview(tool: ShapeInsertTool, size: {w: number; h: number}, scale = 1): string {
  return shapePath({...shapePreset(tool), ...size, radius: tool === 'roundrect' ? 24 * scale : 0});
}
