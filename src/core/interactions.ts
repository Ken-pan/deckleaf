import type { SlideElement,SlideGroup } from './model';

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export type ResizeHandle = Corner | 'n' | 'e' | 's' | 'w';
export const boxResizeHandles: ResizeHandle[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'];
export type ResizeCursor = 'ew-resize' | 'nwse-resize' | 'ns-resize' | 'nesw-resize';
/** Native cursor axes are screen-relative; CSS transforms do not rotate them. */
export function resizeCursor(e: Pick<SlideElement, 'rotation' | 'flipX' | 'flipY' | 'type' | 'w' | 'h'>, corner: ResizeHandle): ResizeCursor {
  const x = (corner.includes('e') ? 1 : corner.includes('w') ? -1 : 0) * (e.flipX ? -1 : 1);
  const y = (corner.includes('s') ? 1 : corner.includes('n') ? -1 : 0) * (e.flipY ? -1 : 1);
  // Line endpoints follow the actual slope; box corners keep the familiar
  // diagonal affordance regardless of the box's aspect ratio.
  const angle = Math.atan2(y * (e.type === 'line' ? e.h : 1), x * (e.type === 'line' ? e.w : 1)) * 180 / Math.PI + e.rotation;
  const axis = ((Math.round(angle / 45) % 4) + 4) % 4;
  return (['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const)[axis];
}
export const dragThreshold = (pointerType: string) => pointerType === 'touch' ? 8 : 4;
export const passedDragThreshold = (dx: number, dy: number, pointerType: string) => Math.hypot(dx, dy) >= dragThreshold(pointerType);
export type Point = {x: number; y: number};
export type Bounds = {x: number; y: number; w: number; h: number};
export function resizeHandlePoint(e: Pick<SlideElement, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'flipX' | 'flipY'>, handle: ResizeHandle): Point {
  const a = e.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const x = (handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0) * (e.flipX ? -1 : 1) * e.w / 2;
  const y = (handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0) * (e.flipY ? -1 : 1) * e.h / 2;
  return {x: e.x + e.w / 2 + c * x - s * y, y: e.y + e.h / 2 + s * x + c * y};
}

export function elementCorners(e: SlideElement): Point[] {
  const a = e.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => ({x:e.x+e.w/2+c*x*e.w/2-s*y*e.h/2,y:e.y+e.h/2+s*x*e.w/2+c*y*e.h/2}));
}
export function selectionBounds(elements: SlideElement[]): Bounds | null {
  if (!elements.length) return null;
  const points = elements.flatMap(elementCorners), x = Math.min(...points.map(p=>p.x)), y = Math.min(...points.map(p=>p.y));
  return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
}
export function selectionUnit(elements: SlideElement[], id: string, individual = false): string[] {
  const e = elements.find(e=>e.id===id);
  if (!e) return [];
  return !individual && e.group && !e.hidden ? elements.filter(v=>v.group===e.group&&!v.hidden).map(v=>v.id) : [id];
}
export function chooseSelection(elements: SlideElement[], selected: string[], id: string, multiple = false, individual = false): string[] {
  const unit = selectionUnit(elements,id,individual);
  if (!multiple) return unit;
  return unit.every(id=>selected.includes(id)) ? selected.filter(id=>!unit.includes(id)) : [...new Set([...selected,...unit])];
}
export type MarqueeOptions = {mode?:'intersect'|'contain';individual?:boolean};
/** Separating axes avoid selecting the empty corners of a rotated object's bounds. */
export function marqueeIntersects(e:SlideElement,box:Bounds):boolean {
  const corners=elementCorners(e),rect=[{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}];
  const angle=e.rotation*Math.PI/180,axes=[{x:1,y:0},{x:0,y:1},{x:Math.cos(angle),y:Math.sin(angle)},{x:-Math.sin(angle),y:Math.cos(angle)}];
  return axes.every(axis=>{const a=corners.map(p=>p.x*axis.x+p.y*axis.y),b=rect.map(p=>p.x*axis.x+p.y*axis.y);return Math.max(...a)>=Math.min(...b)&&Math.max(...b)>=Math.min(...a);});
}
export function marqueeSelection(elements: SlideElement[], box: Bounds, base: string[] = [],containers:SlideGroup[]=[],options:MarqueeOptions={}): string[] {
  const groups = new Map<string,SlideElement[]>();
  for (const e of elements) { let key=options.individual?e.id:e.group||e.id;const seen=new Set<string>();while(!options.individual&&!seen.has(key)){seen.add(key);const parent=containers.find(g=>g.id===key)?.parent;if(!parent)break;key=parent;}const unit=groups.get(key);if(unit)unit.push(e);else groups.set(key,[e]); }
  const contains = (p:Point) => p.x>=box.x&&p.x<=box.x+box.w&&p.y>=box.y&&p.y<=box.y+box.h;
  const picked=[...groups.values()].flatMap(unit=>{
    const visible=unit.filter(e=>!e.hidden&&!e.designPattern);
    if(!visible.length||unit.some(e=>e.locked))return[];
    const hit=options.mode==='contain'?visible.every(e=>elementCorners(e).every(contains)):visible.some(e=>marqueeIntersects(e,box));
    return hit?visible.map(e=>e.id):[];
  });
  const existing=new Set(elements.map(e=>e.id));
  return [...new Set([...base.filter(id=>existing.has(id)),...picked])];
}

/** Images keep their existing frame proportions; Shift temporarily inverts the lock. */
export function keepsAspectRatio(e: Pick<SlideElement, 'type' | 'aspectRatioLocked'>, shift = false): boolean {
  const locked = e.aspectRatioLocked ?? e.type === 'image';
  return shift ? !locked : locked;
}
export function resizedDimensions(e: Pick<SlideElement, 'type' | 'aspectRatioLocked' | 'w' | 'h'>, axis: 'w' | 'h', value: number): {w?: number; h?: number} {
  if (!keepsAspectRatio(e)) return {[axis]: value};
  const factor = value / e[axis];
  return {w: e.w * factor, h: e.h * factor};
}

/** Keep the opposite corner or edge midpoint fixed in the object's transformed axes. */
export function resizeFromCorner(e: SlideElement, dx: number, dy: number, corner: ResizeHandle, proportional = false) {
  const angle = e.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const fx = e.flipX ? -1 : 1, fy = e.flipY ? -1 : 1;
  const sx = corner.includes('e') ? 1 : corner.includes('w') ? -1 : 0, sy = corner.includes('s') ? 1 : corner.includes('n') ? -1 : 0;
  const localX = (c * dx + s * dy) * fx, localY = (-s * dx + c * dy) * fy;
  const minW = Math.min(e.w, 20), minH = Math.min(e.h, 20);
  let w = Math.max(minW, e.w + sx * localX), h = Math.max(minH, e.h + sy * localY);
  if (proportional) {
    const ratio = !sy || sx && Math.abs(localX / e.w) >= Math.abs(localY / e.h) ? w / e.w : h / e.h;
    const safeRatio = Math.max(ratio, minW / e.w, minH / e.h);
    w = e.w * safeRatio; h = e.h * safeRatio;
  }
  const cx = fx * sx * (w - e.w) / 2, cy = fy * sy * (h - e.h) / 2;
  return {x: e.x + (e.w - w) / 2 + c * cx - s * cy, y: e.y + (e.h - h) / 2 + s * cx + c * cy, w, h};
}
