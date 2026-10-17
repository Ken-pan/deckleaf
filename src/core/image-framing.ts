import type {SlideElement} from './model';
import {imageLayout} from './image-style';

/** Convert framing to an editable native picture with a source crop. */
export function nativeImageFrame(e:SlideElement,size:{w:number;h:number}):SlideElement {
  const r=imageLayout(e,size),v=r.visible;
  const x=e.flipX?e.w-v.x-v.w:v.x,y=e.flipY?e.h-v.y-v.h:v.y;
  const dx=x+v.w/2-e.w/2,dy=y+v.h/2-e.h/2,angle=e.rotation*Math.PI/180;
  const clean=(n:number)=>Math.max(0,Math.min(.9999,n));
  return {...e,x:e.x+e.w/2+dx*Math.cos(angle)-dy*Math.sin(angle)-v.w/2,y:e.y+e.h/2+dx*Math.sin(angle)+dy*Math.cos(angle)-v.h/2,w:v.w,h:v.h,fit:'fill',
    crop:{left:clean((v.x-r.x)/r.w),top:clean((v.y-r.y)/r.h),right:clean(1-(v.x+v.w-r.x)/r.w),bottom:clean(1-(v.y+v.h-r.y)/r.h)},
    imageSize:undefined,imagePosition:undefined,imageZoom:undefined};
}
