import type {SlideElement} from './model';
import {imageLayout} from './image-style';
export type CropBox={x:number;y:number;w:number;h:number};
export const clampCrop=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function initialCropImage(e:SlideElement,size:{w:number;h:number}):CropBox{
  // Stretch has no proportional source scale. Start Crop with natural proportions.
  const source=e.fit==='fill'?{...e,fit:'cover' as const,crop:undefined,imageZoom:undefined}:e;
  const {x,y,w,h}=imageLayout(source,size);return {x,y,w,h};
}
export function panCropImage(image:CropBox,_frame:CropBox,dx:number,dy:number):CropBox{
  return {...image,x:image.x+dx,y:image.y+dy};
}
export function resizeCropImage(image:CropBox,handle:string,dx:number,dy:number,minSize=1):CropBox{
  const sx=handle.includes('w')?-1:1,sy=handle.includes('n')?-1:1;
  const k=Math.max(minSize/image.w,minSize/image.h,1+(Math.abs(dx/image.w)>Math.abs(dy/image.h)?sx*dx/image.w:sy*dy/image.h));
  const w=image.w*k,h=image.h*k;
  return {x:handle.includes('w')?image.x+image.w-w:image.x,y:handle.includes('n')?image.y+image.h-h:image.y,w,h};
}
export function cropRatioFrame(frame:CropBox,image:CropBox,ratio:number):CropBox{
  const l=Math.max(frame.x,image.x),t=Math.max(frame.y,image.y),r=Math.min(frame.x+frame.w,image.x+image.w),b=Math.min(frame.y+frame.h,image.y+image.h);
  const w=Math.min(r-l,(b-t)*ratio),h=w/ratio;
  return {x:l+(r-l-w)/2,y:t+(b-t-h)/2,w,h};
}
export function resizeCropFrame(frame:CropBox,_image:CropBox,handle:string,dx:number,dy:number,ratio?:number,symmetric=false):CropBox{
  const min=Math.min(8,frame.w/4,frame.h/4),cx=frame.x+frame.w/2,cy=frame.y+frame.h/2,factor=symmetric?2:1;
  let w=Math.max(min,frame.w+(handle.includes('w')?-dx:handle.includes('e')?dx:0)*factor),h=Math.max(min,frame.h+(handle.includes('n')?-dy:handle.includes('s')?dy:0)*factor);
  if(ratio){if(handle.includes('w')||handle.includes('e'))h=w/ratio;else w=h*ratio;}
  return {x:symmetric?cx-w/2:handle.includes('w')?frame.x+frame.w-w:frame.x,y:symmetric?cy-h/2:handle.includes('n')?frame.y+frame.h-h:frame.y,w,h};
}
/** Preserve the visible pixels and the frame center through rotation and flips. */
export function cropImagePatch(e:SlideElement,size:{w:number;h:number},frame:CropBox,image:CropBox):Partial<SlideElement>{
  const c={left:(frame.x-image.x)/image.w,top:(frame.y-image.y)/image.h,right:(image.x+image.w-frame.x-frame.w)/image.w,bottom:(image.y+image.h-frame.y-frame.h)/image.h};
  const cw=size.w*(1-c.left-c.right),ch=size.h*(1-c.top-c.bottom),cover=Math.max(frame.w/cw,frame.h/ch),zoom=image.w/size.w/cover;
  const slackX=frame.w-image.w*(1-c.left-c.right),slackY=frame.h-image.h*(1-c.top-c.bottom);
  const p={x:Math.abs(slackX)<1e-6?.5:clampCrop((image.x-frame.x+c.left*image.w)/slackX,0,1),y:Math.abs(slackY)<1e-6?.5:clampCrop((image.y-frame.y+c.top*image.h)/slackY,0,1)};
  const dx=(frame.x+frame.w/2-e.w/2)*(e.flipX?-1:1),dy=(frame.y+frame.h/2-e.h/2)*(e.flipY?-1:1),a=e.rotation*Math.PI/180;
  return {x:e.x+e.w/2+dx*Math.cos(a)-dy*Math.sin(a)-frame.w/2,y:e.y+e.h/2+dx*Math.sin(a)+dy*Math.cos(a)-frame.h/2,w:frame.w,h:frame.h,fit:'crop',crop:c,imageSize:size,imagePosition:p,imageZoom:Math.max(.000001,Math.min(20,zoom))};
}
