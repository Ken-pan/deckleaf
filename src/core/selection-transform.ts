import type {Deck,Slide,SlideElement,LayoutItem} from './model';
import type {Operation} from './operations';
import {selectionRoots,descendants,createContainerTree,type ContainerTree} from './container-tree';
import {selectionBounds,resizeFromCorner,type Bounds,type ResizeHandle} from './interactions';
import {scaledTextStyle} from './text-sizing';
import {scaleTableStyle} from './table-schema';

/** A complete visible group also owns its hidden members. Locked groups remain intact. */
function membersFromRoots(slide:Slide,roots:string[],includeLocked:boolean,tree:ContainerTree):SlideElement[] {
  const picked=new Set<string>();
  for(const id of roots){const leaves=tree.descendants(id),element=tree.elements.get(id),members=leaves.length?leaves:element?[element]:[];if(!includeLocked&&members.some(e=>e.locked))continue;for(const e of members)picked.add(e.id);}
  return slide.elements.filter(e=>picked.has(e.id));
}
export function selectionMembers(slide:Slide,ids:string[],includeLocked=false,context='',tree=createContainerTree(slide)):SlideElement[] {
  return membersFromRoots(slide,selectionRoots(slide,ids,context,tree),includeLocked,tree);
}
export function selectionFrame(slide:Slide,ids:string[],context='',tree=createContainerTree(slide)):Bounds|null {
  const roots=selectionRoots(slide,ids,context,tree),members=membersFromRoots(slide,roots,false,tree);
  if(roots.length===1&&tree.groupById.has(roots[0])&&members.length)return tree.layouts.get(roots[0])??selectionBounds(members.filter(e=>!e.hidden))??selectionBounds(members);
  const picked=new Set(members.filter(e=>!e.hidden).map(e=>e.id));
  const boxes=roots.flatMap(id=>{
    if(tree.groupById.has(id)){
      const visible=tree.descendants(id).filter(e=>picked.has(e.id));if(!visible.length)return[];
      return[tree.layouts.get(id)??selectionBounds(visible)!];
    }
    const e=tree.elements.get(id);return e&&picked.has(id)?[selectionBounds([e])!]:[];
  });
  if(!boxes.length)return null;
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return{x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
export function selectionKeepsRatio(members:SlideElement[],shift=false,hasLayout=false):boolean {
  return !shift||hasLayout||members.some(e=>Math.abs(e.rotation/90-Math.round(e.rotation/90))>.00001||e.type==='text'&&e.textSizing!=='fixed');
}
const quarterTurn=(e:SlideElement)=>Math.abs(Math.round(e.rotation/90))%2===1;
const scaledItem=(item:LayoutItem,sx:number,sy:number):LayoutItem=>({...item,...Object.fromEntries(Object.entries(item).filter(([,value])=>typeof value==='number').map(([key,value])=>[key,Math.max(1,Math.min(20000,(value as number)*(key.endsWith('W')||key.endsWith('Width')?sx:sy)))]))});
/** Clamp the entire scale once, so a small label cannot distort the other members. */
export function resizeSelectionFrame(frame:Bounds,members:SlideElement[],dx:number,dy:number,corner:ResizeHandle,proportional=true):Bounds {
  const e={...frame,rotation:0,flipX:false,flipY:false} as SlideElement;
  const requested=resizeFromCorner(e,dx,dy,corner,proportional);
  let minX=0,minY=0,maxX=Infinity,maxY=Infinity;
  for(const v of members){const w=quarterTurn(v)?v.h:v.w,h=quarterTurn(v)?v.w:v.h;minX=Math.max(minX,1/w);minY=Math.max(minY,1/h);maxX=Math.min(maxX,20000/w);maxY=Math.min(maxY,20000/h);
    if(['text','table','chart'].includes(v.type)){minX=Math.max(minX,4/v.fontSize);minY=Math.max(minY,4/v.fontSize);maxX=Math.min(maxX,500/v.fontSize);maxY=Math.min(maxY,500/v.fontSize);}}
  let sx=Math.max(minX,Math.min(maxX,requested.w/frame.w)),sy=Math.max(minY,Math.min(maxY,requested.h/frame.h));
  if(proportional)sx=sy=Math.max(minX,minY,Math.min(maxX,maxY,requested.w/frame.w));
  const w=frame.w*sx,h=frame.h*sy;
  return{x:corner.includes('w')?frame.x+frame.w-w:corner.includes('e')?frame.x:frame.x+(frame.w-w)/2,y:corner.includes('n')?frame.y+frame.h-h:corner.includes('s')?frame.y:frame.y+(frame.h-h)/2,w,h};
}
export function selectionScalePatches(members:SlideElement[],from:Bounds,to:Bounds):Map<string,Partial<SlideElement>> {
  const sx=to.w/from.w,sy=to.h/from.h,uniform=Math.abs(sx-sy)<.000001,fontScale=Math.min(sx,sy),patches=new Map<string,Partial<SlideElement>>();
  if(!uniform&&members.some(e=>Math.abs(e.rotation/90-Math.round(e.rotation/90))>.00001||e.type==='text'&&e.textSizing!=='fixed'))throw new Error('Resize this selection proportionally to preserve rotated objects and automatic text.');
  for(const e of members){const w=e.w*(quarterTurn(e)?sy:sx),h=e.h*(quarterTurn(e)?sx:sy),cx=to.x+(e.x+e.w/2-from.x)*sx,cy=to.y+(e.y+e.h/2-from.y)*sy;
    const tableStyle=scaleTableStyle(e.tableStyle,fontScale);
    patches.set(e.id,{x:cx-w/2,y:cy-h/2,w,h,...(e.type==='text'?{textSizing:e.textSizing}:{}),...(['text','table','chart'].includes(e.type)?scaledTextStyle(e,e.fontSize*fontScale):{}),...(tableStyle?{tableStyle:{...tableStyle,padding:Math.min(1000,tableStyle.padding!),borderWidth:Math.min(100,tableStyle.borderWidth!)}}:{}),...(e.tableFit?{tableFit:{...e.tableFit,minimumFontSize:Math.max(4,Math.min(500,e.tableFit.minimumFontSize*fontScale)),padding:Math.min(100,e.tableFit.padding*fontScale)}}:{}),radius:Math.min(500,e.radius*fontScale),strokeWidth:Math.min(100,e.strokeWidth*fontScale),...(e.shadow?{shadow:{...e.shadow,blur:Math.min(200,e.shadow.blur*fontScale),x:Math.max(-500,Math.min(500,e.shadow.x*fontScale)),y:Math.max(-500,Math.min(500,e.shadow.y*fontScale))}}:{}),...(e.layoutItem?{layoutItem:scaledItem(e.layoutItem,sx,sy)}:{})});}
  return patches;
}
function selectionScaleMetadata(slide:Slide,members:SlideElement[],from:Bounds,to:Bounds) {
  const sx=to.w/from.w,sy=to.h/from.h,picked=new Set(members.map(e=>e.id));
  const complete=(id:string)=>descendants(slide,id).every(e=>picked.has(e.id));
  return {groups:slide.groups?.map(g=>g.layoutItem&&complete(g.id)?{...g,layoutItem:scaledItem(g.layoutItem,sx,sy)}:g),
    autoLayouts:slide.autoLayouts?.map(l=>complete(l.id)?{...l,x:to.x+(l.x-from.x)*sx,y:to.y+(l.y-from.y)*sy,w:l.w*sx,h:l.h*sy,gap:l.gap*(l.direction==='vertical'?sy:sx),...(l.lineGap!==undefined?{lineGap:l.lineGap*sy}:{}),padding:{left:l.padding.left*sx,right:l.padding.right*sx,top:l.padding.top*sy,bottom:l.padding.bottom*sy}}:l)};
}
/** Pointer previews use the same member and layout geometry as the transaction. */
export function selectionScalePreview(slide:Slide,members:SlideElement[],from:Bounds,to:Bounds):Slide {
  const patches=selectionScalePatches(members,from,to);
  return {...slide,...selectionScaleMetadata(slide,members,from,to),elements:slide.elements.map(e=>patches.has(e.id)?{...e,...patches.get(e.id)}:e)};
}
export function scaleSelection(deck:Deck,slideId:string,ids:string[],from:Bounds,to:Bounds,context=''):Operation[] {
  const slide=deck.slides.find(s=>s.id===slideId)!;const members=selectionMembers(slide,ids,false,context);if(!members.length)return[];
  const patches=selectionScalePatches(members,from,to),ops:Operation[]=members.map(e=>({op:'update_element',slideId,elementId:e.id,patch:patches.get(e.id)!})),meta=selectionScaleMetadata(slide,members,from,to);
  for(const g of meta.groups??[])if(g!==slide.groups?.find(v=>v.id===g.id))ops.push({op:'set_group',slideId,group:g});
  for(const l of meta.autoLayouts??[])if(l!==slide.autoLayouts?.find(v=>v.id===l.id))ops.push({op:'set_group_layout',slideId,layout:l});
  return ops;
}
