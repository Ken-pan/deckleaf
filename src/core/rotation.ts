import type {Slide,SlideElement} from './model';
import type {Operation} from './operations';
import {selectionBounds,type Bounds,type Point} from './interactions';
import {ancestorIds} from './container-tree';

export const rotationCursor=`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M25 13a10 10 0 1 0-2 12M25 6v7h-7" stroke="white" stroke-width="5"/><path d="M25 13a10 10 0 1 0-2 12M25 6v7h-7" stroke="#202020" stroke-width="2"/></g></svg>')}" ) 16 16, crosshair`;
type RotationReference={element:SlideElement;box:Bounds;proximity:number};
export interface RotationScene {references:RotationReference[];anchors:SlideElement[];box:Bounds}
export interface RotationSnap {kind:'common'|'object'|'step';key:string;angle:number;delta:number;memberId?:string;referenceId?:string}
export interface RotationGesture {center:Point;lastAngle:number;delta:number;angle:number;members:SlideElement[];single:boolean;scene?:RotationScene;snap?:RotationSnap}
type RotationOptions={enabled?:boolean;alt?:boolean;scale?:number;pointerType?:string};
export const normalizeRotation=(angle:number)=>((angle%360)+360)%360;
export const formatRotation=(angle:number,signed=false)=>{
  const rounded=Math.round((signed?angle:normalizeRotation(angle))*10)/10;
  const value=signed?rounded:rounded%360;
  return`${signed&&value>0?'+':''}${Object.is(value,-0)?0:value}°`;
};
const pointerAngle=(p:Point,c:Point)=>Math.atan2(p.y-c.y,p.x-c.x)*180/Math.PI;
const angleDistance=(a:number,b:number)=>((a-b+540)%360+360)%360-180;
const visible=(e:SlideElement)=>!e.hidden&&e.opacity>0&&!e.designPattern;
/** Keep authored local angles, including members of reference groups. A group has no stored bearing. */
function scene(slide:Slide,members:SlideElement[],frame:Bounds,page?:{width:number;height:number}):RotationScene {
  const ids=new Set(members.map(e=>e.id));
  const references=slide.elements.filter(e=>!ids.has(e.id)&&visible(e)).flatMap(e=>{
    const box=selectionBounds([e])!;
    const proximity=Math.hypot(Math.max(0,box.x-frame.x-frame.w,frame.x-box.x-box.w),Math.max(0,box.y-frame.y-frame.h,frame.y-box.y-box.h));
    return page&&(box.x+box.w<0||box.y+box.h<0||box.x>page.width||box.y>page.height)?[]:[{element:{...e},box,proximity}];
  }).sort((a,b)=>a.proximity-b.proximity||a.element.id.localeCompare(b.element.id));
  // One large, visible member for each bearing keeps mixed selections useful without hidden anchors.
  const anchors:SlideElement[]=[];
  for(const e of members.filter(visible).sort((a,b)=>b.w*b.h-a.w*a.h))if(!anchors.some(a=>Math.abs(angleDistance(a.rotation,e.rotation))<.05))anchors.push({...e});
  return {references,anchors:anchors.slice(0,16),box:{...frame}};
}
function allowed(slide:Slide,members:SlideElement[],single:boolean) {
  if(!members.length||members.some(e=>e.locked||e.designPattern))return false;
  // Flow frames are axis-aligned. A rigid group turn would be undone by reflow.
  return single||!members.some(e=>(slide.autoLayouts??[]).some(l=>ancestorIds(slide,e.id).includes(l.id)));
}
function begin(frame:Bounds,members:SlideElement[],point:Point,single:boolean,scene?:RotationScene):RotationGesture {
  const center={x:frame.x+frame.w/2,y:frame.y+frame.h/2};
  return {center,lastAngle:pointerAngle(point,center),delta:0,angle:0,members:members.map(e=>({...e})),single,scene};
}
function update(g:RotationGesture,point:Point,shift=false,options:RotationOptions={}):RotationGesture {
  if(Math.hypot(point.x-g.center.x,point.y-g.center.y)<.001)return g;
  const lastAngle=pointerAngle(point,g.center),step=((lastAngle-g.lastAngle+540)%360)-180,delta=g.delta+step;
  const base=g.single?g.members[0].rotation:0;
  let snap:RotationSnap|undefined;
  if(!options.alt&&shift){const angle=Math.round((base+delta)/15)*15;snap={kind:'step',key:'step',angle:normalizeRotation(angle),delta:angle-base};}
  else if(!options.alt&&options.enabled){
    const scale=Math.max(.01,options.scale??1),touch=options.pointerType==='touch';
    const radius=Math.hypot(point.x-g.center.x,point.y-g.center.y)*scale;
    // Screen-distance capture stays predictable at different zoom levels, with bounded angular pull.
    const capture=Math.max(touch?1.25:.75,Math.min(touch?5:3.5,Math.atan2(touch?9:6,radius)*180/Math.PI));
    const release=Math.max(touch?2:1.25,Math.min(touch?7.5:5.5,Math.atan2(touch?14:9,radius)*180/Math.PI));
    const bearing=base+delta,common=Math.round(bearing/45)*45;
    const choices:Array<{snap:RotationSnap;distance:number;proximity:number}>=[];
    const add=(snap:RotationSnap,proximity=0)=>{const distance=Math.abs(snap.delta-delta);if(distance<=release)choices.push({snap,distance,proximity});};
    add({kind:'common',key:`common:${normalizeRotation(common)}`,angle:normalizeRotation(common),delta:common-base});
    if(g.scene){
      const refs=g.scene.references.slice(0,32).filter(r=>r.proximity*scale<=240);
      for(const r of refs)for(const anchor of g.scene.anchors){
        const angle=normalizeRotation(r.element.rotation),target=delta+angleDistance(angle,anchor.rotation+delta);
        add({kind:'object',key:`object:${anchor.id}:${r.element.id}`,angle,delta:target,memberId:anchor.id,referenceId:r.element.id},r.proximity*scale);
      }
    }
    const candidate=choices.filter(c=>c.distance<=capture).sort((a,b)=>(a.distance-(a.snap.kind==='object'?.15:0))-(b.distance-(b.snap.kind==='object'?.15:0))||a.proximity-b.proximity||a.snap.key.localeCompare(b.snap.key))[0];
    const held=choices.find(c=>c.snap.key===g.snap?.key);
    // Keep the target at its boundary, but allow a deliberate approach to another close angle.
    snap=held&&(!candidate||candidate.snap.key===held.snap.key||held.distance-candidate.distance<1)?held.snap:candidate?.snap;
  }
  return {...g,lastAngle,delta,angle:snap?.delta??delta,snap};
}
function patches(g:RotationGesture):Map<string,Partial<SlideElement>> {
  const radians=g.angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  return new Map(g.members.map(e=>{
    const dx=e.x+e.w/2-g.center.x,dy=e.y+e.h/2-g.center.y;
    const layoutItem=e.layoutItem&&(e.layoutItem.widthMode==='fill'||e.layoutItem.heightMode==='fill')?{...e.layoutItem,...(e.layoutItem.widthMode==='fill'?{widthMode:'fixed' as const}:{}),...(e.layoutItem.heightMode==='fill'?{heightMode:'fixed' as const}:{})}:e.layoutItem;
    return [e.id,{x:g.center.x+dx*c-dy*s-e.w/2,y:g.center.y+dx*s+dy*c-e.h/2,rotation:normalizeRotation(e.rotation+g.angle),...(layoutItem!==e.layoutItem?{layoutItem,w:e.w,h:e.h,...(e.type==='text'?{textSizing:e.textSizing}:{})}:{})}];
  }));
}
function preview(slide:Slide,g:RotationGesture):Slide {
  const p=patches(g);return {...slide,elements:slide.elements.map(e=>p.has(e.id)?{...e,...p.get(e.id)}:e)};
}
function operations(slide:Slide,g:RotationGesture):Operation[] {
  if(!allowed(slide,g.members,g.single)||Math.abs(normalizeRotation(g.angle+180)-180)<.001)return [];
  return [...patches(g)].map(([elementId,patch])=>({op:'update_element',slideId:slide.id,elementId,patch}));
}
export const rotationTools={cursor:rotationCursor,allowed,scene,begin,update,preview,operations};
