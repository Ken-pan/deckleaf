import {uid,type Slide,type SlideElement,type GroupLayout,type LayoutItem} from './model';
import {selectionBounds} from './interactions';
import {slideGroups,descendants,directMembers,selectionRoots,ancestorIds,groupProxy} from './container-tree';
import {selectedLayout} from './object-layout';
import type {Operation} from './operations';
const round=(n:number)=>Math.round(n*10000)/10000;
/** Preserve existing rhythm when creating a flow, rather than imposing a fixed gap. */
export function inferGroupFlow(members: SlideElement[]) {
  const visible=members.filter(e=>!e.hidden),items=(visible.length?visible:members).map(e=>({e,b:selectionBounds([e])!}));
  const rows:typeof items[]=[];
  for(const item of [...items].sort((a,b)=>a.b.y-b.b.y||a.b.x-b.b.x)) {
    const row=rows.find(r=>Math.abs(r[0].b.y-item.b.y)<=Math.min(16,r[0].b.h/4,item.b.h/4));
    if(row)row.push(item);else rows.push([item]);
  }
  const xSpread=Math.max(...items.map(i=>i.b.x))-Math.min(...items.map(i=>i.b.x)),ySpread=Math.max(...items.map(i=>i.b.y))-Math.min(...items.map(i=>i.b.y));
  let direction:GroupLayout['direction']=items.length<2?(items[0].b.w>=items[0].b.h?'horizontal':'vertical'):xSpread>=ySpread?'horizontal':'vertical';
  const columns=Math.max(1,...rows.map(r=>r.length));
  if(rows.filter(r=>r.length>1).length>1&&columns<=12&&rows.filter(r=>r.length>1).every(r=>r.every(i=>rows[0].some(first=>Math.abs(first.b.x-i.b.x)<=16))))direction='grid';
  const sorted=direction==='grid'?rows.flatMap(r=>r.sort((a,b)=>a.b.x-b.b.x)):[...items].sort((a,b)=>direction==='horizontal'?a.b.x-b.b.x||a.b.y-b.b.y:a.b.y-b.b.y||a.b.x-b.b.x);
  const axis=direction==='vertical'?'y':'x',size=direction==='vertical'?'h':'w';
  const pairs=direction==='grid'?rows.flatMap(r=>r.slice(1).map((i,n)=>i.b.x-r[n].b.x-r[n].b.w)):sorted.slice(1).map((i,n)=>i.b[axis]-sorted[n].b[axis]-sorted[n].b[size]);
  const gap=round(Math.min(2000,Math.max(0,pairs.length?pairs.reduce((a,b)=>a+b,0)/pairs.length:24)));
  const cross=direction==='vertical'?'x':'y',crossSize=direction==='vertical'?'w':'h';
  const alignment=(['start','center','end'] as const).map(align=>{const values=items.map(i=>i.b[cross]+(align==='center'?.5:align==='end'?1:0)*i.b[crossSize]);return {align,spread:Math.max(...values)-Math.min(...values)};}).sort((a,b)=>a.spread-b.spread)[0].align;
  const rowGaps=rows.slice(1).map((row,i)=>Math.min(...row.map(item=>item.b.y))-Math.max(...rows[i].map(item=>item.b.y+item.b.h)));
  return {direction,gap,...(direction==='grid'?{lineGap:round(Math.min(2000,Math.max(0,rowGaps.reduce((a,b)=>a+b,0)/rowGaps.length)))}:{}),align:direction==='grid'?'start' as const:alignment,columns:direction==='grid'?columns:2,order:[...sorted.map(i=>i.e.id),...members.filter(e=>!sorted.some(i=>i.e.id===e.id)).map(e=>e.id)]};
}
export function groupElements(slide:Slide,ids:string[],ungroup=false,context='',wrap=false):Operation[] {
  const roots=selectionRoots(slide,ids,context),groups=slideGroups(slide);
  if(ungroup) {
    const targets=context?[context]:[...new Set(roots.flatMap(id=>groups.some(g=>g.id===id)?[id]:ancestorIds(slide,id).slice(0,1)))];
    if(targets.some(id=>descendants(slide,id).some(e=>e.locked)))throw new Error('Unlock all group members before changing the group.');
    return targets.map(groupId=>({op:'remove_group',slideId:slide.id,groupId}));
  }
  if(!roots.length||roots.length<2&&!wrap)return[];
  if(roots.some(id=>descendants(slide,id).some(e=>e.locked)||slide.elements.find(e=>e.id===id)?.locked))throw new Error('Unlock all group members before changing the group.');
  const parents=roots.map(id=>slide.elements.find(e=>e.id===id)?.group??groups.find(g=>g.id===id)?.parent);
  const parent=parents.every(id=>id===parents[0])?parents[0]:undefined,id=uid('group');
  const ops:Operation[]=[{op:'set_group',slideId:slide.id,group:{id,name:'Group',...(parent?{parent}:{})}}];
  for(const root of roots){const g=groups.find(g=>g.id===root);ops.push(g?{op:'set_group',slideId:slide.id,group:{...g,parent:id,layoutItem:undefined}}:{op:'update_element',slideId:slide.id,elementId:root,patch:{group:id}});}
  if(parent){const l=slide.autoLayouts?.find(l=>l.id===parent);if(l){let inserted=false;const order=l.order.flatMap(v=>{if(!roots.includes(v))return[v];if(inserted)return[];inserted=true;return[id];});if(!inserted)order.push(id);ops.push({op:'set_group_layout',slideId:slide.id,layout:{...l,order}});}}
  return ops;
}
/** Manual creation applies to a multi-selection or a selected container. */
export function canAddAutoLayout(selectionCount:number,selectedContainer=''):boolean {
  return selectionCount>1||Boolean(selectedContainer);
}
export function createGroupLayout(slide:Slide,ids:string[],context=''):Operation[] {
  const roots=selectionRoots(slide,ids,context),groups=slideGroups(slide);
  let existing=groups.some(g=>g.id===context)?context:roots.length===1&&groups.some(g=>g.id===roots[0])?roots[0]:undefined;
  // A partial legacy selection can still add a new object to its existing flow.
  const selected=slide.elements.filter(e=>ids.includes(e.id)),old=selected.map(e=>e.group).filter(Boolean);
  if(!existing&&!context&&old.length&&new Set(old).size===1&&!roots.some(id=>groups.some(g=>g.id===id)))existing=old[0];
  let members=existing?directMembers(slide,existing):roots.map(id=>slide.elements.find(e=>e.id===id)??groupProxy(slide,id)).filter((e):e is SlideElement=>Boolean(e));
  if(existing)members=[...members,...selected.filter(e=>!e.group&&!members.some(v=>v.id===e.id))];
  if(!members.length)return[];
  if(members.some(e=>e.locked))throw new Error('Unlock all group members before adding auto layout.');
  const previous=slide.autoLayouts?.find(l=>l.id===existing);
  if(previous&&members.length===directMembers(slide,existing!).length)return[];
  const id=existing??uid('group'),bounds=selectionBounds(members)!,flow=inferGroupFlow(members);
  const parents=members.map(e=>e.group),parent=parents.every(p=>p===parents[0])?parents[0]:undefined;
  const ops:Operation[]=[{op:'set_group',slideId:slide.id,group:groups.find(g=>g.id===id)??{id,name:'Auto layout',...(parent?{parent}:{})}}];
  for(const e of members)if(e.group!==id){const g=groups.find(g=>g.id===e.id);ops.push(g?{op:'set_group',slideId:slide.id,group:{...g,parent:id,layoutItem:undefined}}:{op:'update_element',slideId:slide.id,elementId:e.id,patch:{group:id}});}
  const layout:GroupLayout=previous?{...previous,order:[...previous.order,...members.map(e=>e.id).filter(id=>!previous.order.includes(id))]}:{id,name:existing&&groups.find(g=>g.id===existing)?.name!=='Group'?groups.find(g=>g.id===existing)!.name:'Auto layout',...flow,padding:{top:0,right:0,bottom:0,left:0},justify:'start',...bounds,widthMode:'hug',heightMode:'hug'};
  ops.push({op:'set_group_layout',slideId:slide.id,layout});
  if(!existing&&parent){const l=slide.autoLayouts?.find(l=>l.id===parent);if(l){let inserted=false;const chosen=new Set(members.map(e=>e.id));const order=l.order.flatMap(v=>{if(!chosen.has(v))return[v];if(inserted)return[];inserted=true;return[id];});if(!inserted)order.push(id);ops.push({op:'set_group_layout',slideId:slide.id,layout:{...l,order}});}}
  return ops;
}

export function layoutItemOperations(slide:Slide,ids:string[],patch:Partial<LayoutItem>):Operation[] {
  const l=selectedLayout(slide,ids);if(!l)return[];
  const members=slide.elements.filter(e=>ids.includes(e.id));
  if(members.some(e=>e.locked))throw new Error('Unlock selected members before changing their sizing.');
  if(members.some(e=>e.rotation%360!==0)&&(patch.widthMode==='fill'||patch.heightMode==='fill'))throw new Error('Reset object rotation before using Fill.');
  return members.map(e=>({op:'update_element',slideId:slide.id,elementId:e.id,patch:{layoutItem:{widthMode:'fixed',heightMode:'fixed',...e.layoutItem,...patch,...(patch.widthMode==='fill'&&e.layoutItem?.widthMode!=='fill'?{basisW:e.w}:{}),...(patch.heightMode==='fill'&&e.layoutItem?.heightMode!=='fill'?{basisH:e.h}:{})},...(e.type==='text'&&patch.widthMode==='fill'&&e.textSizing==='auto-width'?{textSizing:'auto-height' as const}:{}),...(e.type==='text'&&patch.heightMode==='fill'?{textSizing:'fixed' as const}:{})}}));
}

export function layoutOverflow(slide:Slide,l:GroupLayout) {
  const boxes=directMembers(slide,l.id).filter(e=>!e.hidden).map(e=>selectionBounds([e])!);
  return {width:Math.max(0,...boxes.map(b=>b.x+b.w+l.padding.right-l.x-l.w)),height:Math.max(0,...boxes.map(b=>b.y+b.h+l.padding.bottom-l.y-l.h))};
}
