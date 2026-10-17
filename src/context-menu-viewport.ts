import type {ViewportBounds} from './ui-viewport';
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(value,Math.max(low,high)));
// Cursor menus use the whole visible viewport before introducing a scrollport.
export function contextMenuPlacement(point:{x:number;y:number},size:{width:number;height:number},viewport:ViewportBounds) {
  const margin=Math.min(12,viewport.width/4,viewport.height/4),gap=8;
  const left=viewport.left+margin,top=viewport.top+margin,right=viewport.left+viewport.width-margin,bottom=viewport.top+viewport.height-margin;
  const maxWidth=Math.max(1,right-left),maxHeight=Math.max(1,bottom-top);
  const width=Math.min(size.width,maxWidth),height=Math.min(size.height,maxHeight);
  const above=point.y-height-gap;
  const placement=point.y+gap+height<=bottom?'below':above>=top?'above':'overlay';
  return {left:clamp(point.x+width>right?point.x-width:point.x,left,right-width),top:clamp(placement==='above'?above:point.y+gap,top,bottom-height),maxWidth,maxHeight,placement};
}

// Keep a child beside its parent row, flipping at the viewport edge. If both
// sides are too narrow, the menu can use its compact drill-in presentation.
export function contextSubmenuPlacement(anchor:{left:number;right:number;top:number},size:{width:number;height:number},viewport:ViewportBounds,preferred:'left'|'right'='right'): {left:number;top:number;maxHeight:number;side:'left'|'right'} | undefined {
  const margin=12,gap=4;
  const left=viewport.left+margin,right=viewport.left+viewport.width-margin;
  const top=viewport.top+margin,bottom=viewport.top+viewport.height-margin;
  const fitsRight=anchor.right+gap+size.width<=right,fitsLeft=anchor.left-gap-size.width>=left;
  const side:'left'|'right'|undefined=preferred==='left'&&fitsLeft?'left':fitsRight?'right':fitsLeft?'left':undefined;
  if(!side)return;
  const maxHeight=Math.max(1,bottom-top),height=Math.min(size.height,maxHeight);
  return {left:side==='right'?anchor.right+gap:anchor.left-gap-size.width,top:clamp(anchor.top-4,top,bottom-height),maxHeight,side};
}
