import type {SlideElement} from './model';
import type {Point} from './interactions';
import {selectionBounds} from './interactions';
import {lineGeometry} from './line-path';
import {DEFAULT_LINE} from './line-schema';
import {lineLabelElement} from './line-label';
import {SNAP_INCREMENT} from './numeric-increment';
export type LinePoint='start'|'end'|'bend';
export type LineGuide={from:Point;to:Point};
const rotate=(p:Point,angle:number):Point=>{const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:p.x*c-p.y*s,y:p.x*s+p.y*c};};
export function lineLocalToWorld(e:SlideElement,p:Point):Point {
  const offset=rotate({x:(p.x-e.w/2)*(e.flipX?-1:1),y:(p.y-e.h/2)*(e.flipY?-1:1)},e.rotation);
  return {x:e.x+e.w/2+offset.x,y:e.y+e.h/2+offset.y};
}
export function lineWorldToLocal(e:SlideElement,p:Point):Point {
  const offset=rotate({x:p.x-e.x-e.w/2,y:p.y-e.y-e.h/2},-e.rotation);
  return {x:e.w/2+offset.x*(e.flipX?-1:1),y:e.h/2+offset.y*(e.flipY?-1:1)};
}
export function lineEndpoints(e:SlideElement){const g=lineGeometry(e);return {start:lineLocalToWorld(e,g.start),end:lineLocalToWorld(e,g.end)};}

/** Normalize signed endpoint extents in the existing local rotation, preserving the stationary endpoint. */
export function lineEndpointPatch(e:SlideElement,which:'start'|'end',target:Point):Partial<SlideElement> {
  const world=lineEndpoints(e),a=rotate(which==='start'?target:world.start,-e.rotation),b=rotate(which==='end'?target:world.end,-e.rotation);
  const fixed=which==='start'?b:a,moving=which==='start'?a:b;
  // The document's one-pixel extent is its legacy representation of a flat axis.
  for(const axis of ['x','y'] as const)if(Math.abs(moving[axis]-fixed[axis])<1)moving[axis]=fixed[axis];
  if(Math.hypot(a.x-b.x,a.y-b.y)<1)return {};
  const w=Math.max(1,Math.abs(b.x-a.x)),h=Math.max(1,Math.abs(b.y-a.y));
  const center=rotate({x:(a.x+b.x)/2,y:(a.y+b.y)/2},e.rotation),x=center.x-w/2,y=center.y-h/2;
  if(w>20000||h>20000||Math.abs(x)>20000||Math.abs(y)>20000)return {};
  return {x,y,w,h,flipX:b.x<a.x,flipY:b.y<a.y};
}
export function lineBendPoint(e:SlideElement,clearance=12):Point|null {
  if(e.w<=1||e.h<=1)return null;
  const bend=e.line?.bend??.5,route=e.line?.route??'straight',g=lineGeometry(e);
  if(route==='elbow'||route==='rounded'){
    const point={x:e.w*bend,y:(g.start.y+g.end.y)/2};
    if(!e.text)return point;
    const label=lineLabelElement(e);
    const r=route==='rounded'?Math.min(e.w*bend,e.w*(1-bend),e.h/2,24):0;
    return [point,{x:point.x,y:r},{x:point.x,y:e.h-r}].find(p=>{const world=lineLocalToWorld(e,p);return world.x<label.x-clearance||world.x>label.x+label.w+clearance||world.y<label.y-clearance||world.y>label.y+label.h+clearance;})??null;
  }
  if(route==='curve')return {x:e.w*bend,y:g.start.y};
  if(route==='arc')return {x:g.start.x,y:e.h*bend};
  if(route==='step'){
    const point={x:e.w/2,y:e.h*bend};if(!e.text)return point;const label=lineLabelElement(e);
    return [point,{x:e.w*.25,y:point.y},{x:e.w*.75,y:point.y}].find(p=>{const world=lineLocalToWorld(e,p);return world.x<label.x-clearance||world.x>label.x+label.w+clearance||world.y<label.y-clearance||world.y>label.y+label.h+clearance;})??null;
  }
  return null;
}
export function lineBendPatch(e:SlideElement,world:Point):Partial<SlideElement> {
  const p=lineWorldToLocal(e,world),vertical=e.line?.route==='step'||e.line?.route==='arc';
  return {line:{...DEFAULT_LINE,...e.line,bend:Math.max(.1,Math.min(.9,vertical?p.y/e.h:p.x/e.w))}};
}
export function lineSnapTargets(e:SlideElement,elements:SlideElement[],page?:{width:number;height:number}):Point[] {
  const ends=lineEndpoints(e),points:Point[]=[ends.start,ends.end];
  if(page)for(const x of [0,page.width/2,page.width])for(const y of [0,page.height/2,page.height])points.push({x,y});
  for(const item of elements){
    if(item.id===e.id||item.hidden||item.designPattern)continue;
    if(item.type==='line'){const pair=lineEndpoints(item);points.push(pair.start,pair.end);continue;}
    const box=selectionBounds([item]);if(!box)continue;
    for(const x of [box.x,box.x+box.w/2,box.x+box.w])for(const y of [box.y,box.y+box.h/2,box.y+box.h])points.push({x,y});
  }
  return points;
}
export function lineEndpointTarget(e:SlideElement,which:'start'|'end',raw:Point,options:{shift?:boolean;alt?:boolean;snapping?:boolean;grid?:boolean;threshold?:number;targets?:Point[]}={}):{point:Point;guides:LineGuide[]} {
  const pair=lineEndpoints(e),fixed=which==='start'?pair.end:pair.start;
  let point={...raw};const guides:LineGuide[]=[];
  if(options.shift&&!options.alt){const a=Math.round(Math.atan2(raw.y-fixed.y,raw.x-fixed.x)/(Math.PI/4))*Math.PI/4,d=Math.hypot(raw.x-fixed.x,raw.y-fixed.y);return {point:{x:fixed.x+Math.cos(a)*d,y:fixed.y+Math.sin(a)*d},guides};}
  if(!options.snapping||options.alt)return {point,guides};
  if(options.grid)point={x:Math.round(point.x/SNAP_INCREMENT)*SNAP_INCREMENT,y:Math.round(point.y/SNAP_INCREMENT)*SNAP_INCREMENT};
  for(const axis of ['x','y'] as const){const other=axis==='x'?'y':'x';let best:Point|undefined,distance=options.threshold??6;
    for(const candidate of [fixed,...(options.targets??[])]){const delta=Math.abs(candidate[axis]-raw[axis]);if(delta<distance||(delta===distance&&best&&Math.abs(candidate[other]-raw[other])<Math.abs(best[other]-raw[other]))){distance=delta;best=candidate;}}
    if(best){point[axis]=best[axis];guides.push({from:{...best},to:point});}
  }
  return {point,guides};
}
