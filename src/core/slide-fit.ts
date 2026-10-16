import type {Deck} from './model';
import {inlineTextWidth,inlineTextLines} from './inline-text-width';
import {browserTextSize,type TextSizeMeasure} from './text-layout';

export const slideTextSize:TextSizeMeasure=(e,deck)=>typeof document!=='undefined'?browserTextSize({...e,textSizing:e.textSizing==='auto-width'?'auto-width':'auto-height',maxLines:undefined},deck):{w:inlineTextWidth(e.text,e.fontSize,e.fontFamily)+(e.padding?.left??0)+(e.padding?.right??0),h:inlineTextLines(e.text,e.fontSize,e.fontFamily,e.textSizing==='auto-width'?20000:e.w-(e.padding?.left??0)-(e.padding?.right??0))*e.fontSize*e.lineHeight+(e.padding?.top??0)+(e.padding?.bottom??0)};
export type SlideFitIssue={slideId:string;number:number;code:'separator'|'outside'|'clipped'|'overlap';elementIds:string[];fields:string[];message:string};

/** Inspect native content frames, never decorative shapes or image overlays.
 * Browser callers measure paragraphs; server callers explicitly report estimates. */
export function reviewSlideFit(deck:Deck,slideIds?:string[],measure:TextSizeMeasure=slideTextSize){
 const issues:SlideFitIssue[]=[];let inspectedObjects=0,unmappedSlides=0;
 for(const [index,slide] of deck.slides.entries()){
  if(slide.hidden||(slideIds&&!slideIds.includes(slide.id)))continue;
  const slots=new Map(slide.template?.slots?.map(s=>[s.elementId,s.key]));
  if(!slots.size){unmappedSlides++;continue;}
  const content=slide.elements.filter(e=>!e.hidden&&e.opacity>0&&!e.pageElement&&slots.has(e.id)&&['text','table','chart'].includes(e.type)).map(e=>e.type==='text'&&e.textSizing==='auto-height'?{...e,h:Math.max(e.h,measure(e,deck)?.h??e.h)}:e);
  inspectedObjects+=content.length;
  const add=(code:SlideFitIssue['code'],elementIds:string[],message:string)=>issues.push({slideId:slide.id,number:index+1,code,elementIds,fields:elementIds.map(id=>slots.get(id)!),message:`Slide ${index+1}: ${message}`});
  for(const e of content){
   if(e.type==='text'&&e.text.trim()&&slide.template?.variant.startsWith('list-')&&slide.elements.some(line=>line.type==='line'&&!line.hidden&&line.opacity>0&&Math.abs(line.rotation)<.1&&line.w>e.w*.8&&line.x<e.x+e.w&&line.x+line.w>e.x&&line.y>e.y+2&&line.y<e.y+e.h-2))add('separator',[e.id],`${slots.get(e.id)} crosses a row separator. Reflow the rows or shorten this field while preserving details in notes.`);
   if(e.x< -1||e.y< -1||e.x+e.w>deck.width+1||e.y+e.h>deck.height+1)add('outside',[e.id],`${slots.get(e.id)} extends past the canvas after text wrapping. Reduce visible copy and preserve details in notes.`);
   if(e.type==='text'&&e.text.trim()&&e.clipText!==false&&e.textSizing!=='auto-height'){
    const height=measure(e,deck)?.h;
    if(height!==undefined&&height>e.h+Math.max(4,e.fontSize*.25))add('clipped',[e.id],`${slots.get(e.id)} may clip in its text frame. Shorten this visible field and retain the explanation in notes.`);
   }
  }
  for(let i=0;i<content.length;i++)for(const b of content.slice(i+1)){
   const a=content[i];if(Math.abs(a.rotation)>.1||Math.abs(b.rotation)>.1)continue;
   const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
   if(overlap>Math.min(a.w*a.h,b.w*b.h)*.12)add('overlap',[a.id,b.id],`${slots.get(a.id)} overlaps ${slots.get(b.id)}. Reduce copy or choose a composition with enough room for both.`);
  }
 }
 return {measurement:measure===slideTextSize?(typeof document==='undefined'?'estimated':'browser'):'provided',inspectedObjects,unmappedSlides,issues,limitation:'Native content frames only. This is layout feedback, not an image-based aesthetic or factual review. Inspect rendered pages before delivery.'};
}
