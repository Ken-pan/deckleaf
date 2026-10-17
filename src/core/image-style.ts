import type {SlideElement} from './model';

export function createImageRendering(){
// Coordinates are in the unrotated, unflipped frame. Legacy crops keep their
// original stretched-region semantics until explicitly edited with imageSize.
function imageLayout(e: SlideElement, size: {w:number;h:number}) {
  const c=e.crop??{left:0,right:0,top:0,bottom:0},p=['cover','crop'].includes(e.fit)?e.imagePosition??{x:.5,y:.5}:{x:.5,y:.5},z=e.fit==='crop'?e.imageZoom??1:1;
  const cw=size.w*(1-c.left-c.right),ch=size.h*(1-c.top-c.bottom);
  const fit=e.crop&&!e.imageSize?'fill':e.fit==='crop'?'cover':e.fit;
  const scale=fit==='cover'?Math.max(e.w/cw,e.h/ch):Math.min(e.w/cw,e.h/ch);
  const w=size.w*(fit==='fill'?e.w/cw:scale)*z,h=size.h*(fit==='fill'?e.h/ch:scale)*z;
  const left=(e.w-w*(1-c.left-c.right))*p.x,top=(e.h-h*(1-c.top-c.bottom))*p.y;
  const x=left-c.left*w,y=top-c.top*h;
  const clipX=Math.max(0,left,x),clipY=Math.max(0,top,y);
  return {x,y,w,h,visible:{x:clipX,y:clipY,w:Math.max(0,Math.min(e.w,left+w*(1-c.left-c.right),x+w)-clipX),h:Math.max(0,Math.min(e.h,top+h*(1-c.top-c.bottom),y+h)-clipY)}};
}
function imageStyle(e: SlideElement) {
  const c = e.crop;
  const p=e.sourceRegion||!['cover','crop'].includes(e.fit)?{x:.5,y:.5}:e.imagePosition??{x:.5,y:.5},z=!e.sourceRegion&&e.fit==='crop'?e.imageZoom??1:1;
  if((e.imageSize||c)&&!e.sourceRegion){
    const r=imageLayout(e,e.imageSize??{w:1,h:1});
    return `position:absolute;max-width:none;width:${r.w/e.w*100}%;height:${r.h/e.h*100}%;left:${r.x/e.w*100}%;top:${r.y/e.h*100}%;object-fit:fill;${c?`clip-path:inset(${c.top*100}% ${c.right*100}% ${c.bottom*100}% ${c.left*100}%);`:''}`;
  }
  const transform=`object-position:${p.x*100}% ${p.y*100}%;transform:scale(${z});transform-origin:${p.x*100}% ${p.y*100}%;`;
  return c ? `position:absolute;max-width:none;width:${100 / (1 - c.left - c.right)}%;height:${100 / (1 - c.top - c.bottom)}%;left:${-c.left * 100 / (1 - c.left - c.right)}%;top:${-c.top * 100 / (1 - c.top - c.bottom)}%;object-fit:fill;${transform}` : `display:block;width:100%;height:100%;object-fit:${e.fit==='crop'?'cover':e.fit};${transform}`;
}

return {imageStyle,imageLayout};
}
export const {imageStyle,imageLayout}=createImageRendering();
