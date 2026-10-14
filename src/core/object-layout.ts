import { GroupLayoutSchema, type Slide, type SlideElement, type GroupLayout, type LayoutItem } from './model';
import { selectionBounds } from './interactions';
import {sameDocumentData} from './document-data';
import type { Operation } from './operations';
import {createContainerTree,slideGroups,descendants,directMembers,groupProxy,selectionRoots,ancestorIds} from './container-tree';
import {fitFlowText} from './flow-text-fit';

const round = (n: number) => Math.round(n * 10000) / 10000;
const offset = (space: number, align: 'start' | 'center' | 'end') => Math.max(0, space) * (align === 'end' ? 1 : align === 'center' ? .5 : 0);
export function selectedLayout(slide: Slide, ids: string[], context=''): GroupLayout | undefined {
  if(context)return slide.autoLayouts?.find(l=>l.id===context);
  const members = slide.elements.filter(e => ids.includes(e.id)),group=members[0]?.group;
  return group && members.every(e=>e.group===group)?slide.autoLayouts?.find(l=>l.id===group):undefined;
}
export function groupMembers(slide: Slide, ids: string[], context=''): SlideElement[] {
  if(context)return descendants(slide,context);
  const groups=new Set(slide.elements.filter(e=>ids.includes(e.id)).map(e=>e.group).filter((id):id is string=>Boolean(id)));
  const expanded=new Set([...ids,...[...groups].flatMap(id=>descendants(slide,id).map(e=>e.id))]);
  return slide.elements.filter(e=>expanded.has(e.id));
}

/** Explicit dimension edits leave Fill so the user's entered size remains authoritative. */
export function manualLayoutSizing(e:SlideElement,patch:Partial<SlideElement>):Partial<SlideElement> {
  if(patch.fontSize!==undefined&&e.layoutItem?.basisFontSize&&!patch.layoutItem)patch={...patch,layoutItem:{...e.layoutItem,basisFontSize:patch.fontSize}};
  if(e.layoutItem&&Object.hasOwn(patch,'group')&&patch.group!==e.group&&!patch.layoutItem)return {...patch,layoutItem:undefined};
  if(!e.layoutItem||patch.layoutItem)return patch;
  const width=patch.w!==undefined&&e.layoutItem.widthMode==='fill',height=patch.h!==undefined&&e.layoutItem.heightMode==='fill';
  return width||height?{...patch,layoutItem:{...e.layoutItem,...(width?{widthMode:'fixed' as const}:{}),...(height?{heightMode:'fixed' as const}:{})}}:patch;
}

type FlowItem = {element:SlideElement;box:NonNullable<ReturnType<typeof selectionBounds>>;resize?:(axis:'w'|'h',size:number)=>SlideElement};
const fill = (e:SlideElement,axis:'w'|'h') => e.layoutItem?.[axis==='w'?'widthMode':'heightMode']==='fill';
function limits(e:SlideElement,axis:'w'|'h') {
  const min=e.layoutItem?.[axis==='w'?'minWidth':'minHeight']??1,max=e.layoutItem?.[axis==='w'?'maxWidth':'maxHeight']??20000;
  if(min>max)throw new Error(`Minimum ${axis==='w'?'width':'height'} must not exceed maximum ${axis==='w'?'width':'height'}.`);
  return {min,max};
}
function setSize(item:FlowItem,axis:'w'|'h',value:number,measure:(e:SlideElement)=>SlideElement) {
  const {min,max}=limits(item.element,axis),size=round(Math.max(min,Math.min(max,value)));
  if(item.resize&&Math.abs(item.box[axis]-size)<.0001)return;
  let e=item.resize?item.resize(axis,size):{...item.element,[axis]:size};
  if(axis==='w'&&e.type==='text') {
    if(e.textSizing==='auto-width')e={...e,textSizing:'auto-height'};
    e=measure(e);
  }
  item.element=e;item.box=selectionBounds([e])!;
}
function preferredSize(item:FlowItem,axis:'w'|'h') {const {min,max}=limits(item.element,axis);return Math.max(min,Math.min(max,item.element.layoutItem?.[axis==='w'?'basisW':'basisH']??item.box[axis]));}
/** Equal shares constrained by each member's limits; unused capped space reaches the other members. */
function fillMain(items:FlowItem[],axis:'w'|'h',available:number,gap:number,measure:(e:SlideElement)=>SlideElement) {
  const flexible=items.filter(i=>fill(i.element,axis));if(!flexible.length)return;
  const budget=available-Math.max(0,items.length-1)*gap-items.filter(i=>!fill(i.element,axis)).reduce((sum,i)=>sum+i.box[axis],0);
  if(flexible.length===1){setSize(flexible[0],axis,budget,measure);return;}
  const constraints=flexible.map(item=>({item,...limits(item.element,axis)}));
  if(constraints.every(c=>c.min===1&&c.max===20000)){for(const c of constraints)setSize(c.item,axis,budget/flexible.length,measure);return;}
  const target=Math.max(constraints.reduce((sum,c)=>sum+c.min,0),Math.min(budget,constraints.reduce((sum,c)=>sum+c.max,0)));
  let lo=0,hi=Math.max(...constraints.map(c=>c.max));
  for(let pass=0;pass<45;pass++){const share=(lo+hi)/2,total=constraints.reduce((sum,c)=>sum+Math.max(c.min,Math.min(c.max,share)),0);if(total<target)lo=share;else hi=share;}
  for(const c of constraints)setSize(c.item,axis,(lo+hi)/2,measure);
}
/** Resolve saved geometry after text measurement. Hidden members retain order and consume no space. */
export function resolveGroupLayouts(slide: Slide, enforceLocks = false, measure:(e:SlideElement)=>SlideElement = e=>e): Slide {
  if (!slide.autoLayouts?.length) return slide;
  const tree=createContainerTree(slide),groups=tree.groups,groupIds=new Set(tree.groupById.keys());
  const originals=tree.elements,elements=new Map(originals),layouts=new Map(tree.layouts);
  const allocations=new Map<string,Partial<{w:number;h:number}>>();
  function proxy(id:string):SlideElement|undefined {
    const group=tree.groupById.get(id),source=tree.descendants(id),leaves=source.map(e=>elements.get(e.id)!);
    const visible=leaves.filter(e=>!e.hidden),box=layouts.get(id)??selectionBounds(visible.length?visible:leaves);
    if(!group||!leaves.length||!box)return;
    return {...leaves[0],x:box.x,y:box.y,w:box.w,h:box.h,id,name:layouts.get(id)?.name??group.name,type:'rect',group:group.parent,rotation:0,layoutItem:group.layoutItem,hidden:!visible.length,locked:tree.stats.get(id)?.locked??false};
  }
  function members(id:string) {return [...(tree.directElements.get(id)??[]).map(e=>elements.get(e.id)!),...(tree.childGroups.get(id)??[]).map(g=>proxy(g.id)).filter((e):e is SlideElement=>Boolean(e))];}
  function translate(id:string,dx:number,dy:number){
    if(Math.abs(dx)+Math.abs(dy)<.00001)return;
    for(const source of tree.descendants(id)){const e=elements.get(source.id)!;elements.set(e.id,{...e,x:round(e.x+dx),y:round(e.y+dy)});}
    const queue=[id];for(let i=0;i<queue.length;i++){const group=queue[i],l=layouts.get(group);if(l)layouts.set(group,{...l,x:round(l.x+dx),y:round(l.y+dy)});queue.push(...(tree.childGroups.get(group)??[]).map(g=>g.id));}
  }
  function resolve(id:string,allocation?:Partial<{w:number;h:number}>) {
    if(!allocation)for(const child of tree.childGroups.get(id)??[])resolve(child.id);
    else allocations.set(id,{...allocations.get(id),...allocation});
    const raw=layouts.get(id);
    if(!raw)return;
    const direct=members(raw.id);if(!direct.length)return;
    const resolved=new Map<string,SlideElement>();
    const byId=new Map(direct.map(e=>[e.id,e])),ordered=new Set(raw.order);
    const order=[...raw.order.filter(id=>byId.has(id)),...direct.filter(e=>!ordered.has(e.id)).map(e=>e.id)];
    const items:FlowItem[]=order.map(id=>byId.get(id)!).filter(e=>!e.hidden).map(e=>({element:e,box:selectionBounds([e])!,...(groupIds.has(e.id)?{resize:(axis:'w'|'h',size:number)=>{if(!layouts.has(e.id))throw new Error('Add auto layout to a group before using Fill.');resolve(e.id,{[axis]:size});return proxy(e.id)!;}}:{})}));
    const imposed=allocations.get(id);
    const l={...raw,order,...imposed,...(imposed?.w!==undefined?{widthMode:'fixed' as const}:{}),...(imposed?.h!==undefined?{heightMode:'fixed' as const,textFitHeight:Math.min(raw.textFitHeight??imposed.h,imposed.h)}:{})},p=l.padding,horizontal=l.direction==='horizontal';
    if(l.wrap&&l.direction!=='horizontal')l.wrap=false;
    if(items.some(i=>fill(i.element,'w')))l.widthMode='fixed';
    if(items.some(i=>fill(i.element,'h')))l.heightMode='fixed';
    if(l.wrap||l.gridSizing==='equal'&&l.direction==='grid')l.widthMode='fixed';
    const innerW=Math.max(1,l.w-p.left-p.right),innerH=Math.max(1,l.h-p.top-p.bottom),lineGap=l.lineGap??l.gap;
    function place(i:FlowItem,x:number,y:number) {
      const e=i.element,b=i.box,original=byId.get(e.id)!;
      const next={...e,x:round(x+e.x-b.x),y:round(y+e.y-b.y)};
      if(groupIds.has(e.id)){translate(e.id,next.x-original.x,next.y-original.y);return;}
      resolved.set(e.id,(['x','y','w','h','textSizing','fontSize','letterSpacing'] as const).every(key=>next[key]===original[key])?original:next);
    }
    if(l.direction==='grid') {
      if(l.adaptiveColumns)l.columns=items.length===4?2:Math.min(l.columns,Math.max(1,items.length));
      const cols=l.gridSizing==='equal'?l.columns:Math.min(l.columns,items.length),colWidths=Array.from({length:cols},()=>0),rowHeights:number[]=[];
      for(let i=0;i<items.length;i++){const c=i%l.columns;colWidths[c]=Math.max(colWidths[c]??0,fill(items[i].element,'w')?preferredSize(items[i],'w'):items[i].box.w);}
      if(l.gridSizing==='equal')colWidths.fill(Math.max(1,(innerW-Math.max(0,cols-1)*l.gap)/Math.max(1,cols),...items.map(i=>fill(i.element,'w')?limits(i.element,'w').min:i.box.w)));
      for(let i=0;i<items.length;i++) {
        const item=items[i],c=i%l.columns,r=Math.floor(i/l.columns);
        if(fill(item.element,'w'))setSize(item,'w',colWidths[c],measure);
        if(l.adaptiveColumns&&groupIds.has(item.element.id))setSize(item,'h',Math.max(1,(innerH-(Math.ceil(items.length/l.columns)-1)*lineGap)/Math.ceil(items.length/l.columns)),measure);
        const naturalH=fill(item.element,'h')?preferredSize(item,'h'):item.box.h;
        rowHeights[r]=Math.max(rowHeights[r]??0,naturalH);
      }
      const contentW=colWidths.reduce((a,b)=>a+b,0)+Math.max(0,cols-1)*l.gap,contentH=rowHeights.reduce((a,b)=>a+b,0)+Math.max(0,rowHeights.length-1)*lineGap;
      if(l.widthMode==='hug')l.w=round(Math.max(1,contentW+p.left+p.right));if(l.heightMode==='hug')l.h=round(Math.max(1,contentH+p.top+p.bottom));
      const colOffsets:number[]=[],rowOffsets:number[]=[];let colX=0,rowY=0;for(const width of colWidths){colOffsets.push(colX);colX+=width+l.gap;}for(const height of rowHeights){rowOffsets.push(rowY);rowY+=height+lineGap;}
      for(let i=0;i<items.length;i++) {
        const item=items[i],c=i%l.columns,r=Math.floor(i/l.columns);
        if(fill(item.element,'h'))setSize(item,'h',rowHeights[r],measure);
        place(item,l.x+p.left+colOffsets[c]+offset(colWidths[c]-item.box.w,l.align),l.y+p.top+rowOffsets[r]);
      }
    } else {
      const main=horizontal?'w':'h',cross=horizontal?'h':'w',available=horizontal?innerW:innerH;
      if(l.wrap)for(const item of items)if(fill(item.element,'w'))setSize(item,'w',preferredSize(item,'w'),measure);
      const lines:FlowItem[][]=[];let used=0;
      const breakGap=l.justify==='space-between'?0:l.gap;
      for(const item of items) {
        if(!lines.length||l.wrap&&lines.at(-1)!.length&&used+breakGap+item.box[main]>available+.0001){lines.push([]);used=0;}
        const line=lines.at(-1)!;used+=(line.length?breakGap:0)+item.box[main];line.push(item);
      }
      for(const line of lines) {
        const allocationGap=l.justify==='space-between'?0:l.gap;
        fillMain(line,main,available,allocationGap,measure);
        if(!l.wrap)for(const item of line)if(fill(item.element,cross))setSize(item,cross,horizontal?innerH:innerW,measure);
      }
      let flowGap=l.gap;
      if(l.textFitHeight&&!l.wrap){
        const fit=fitFlowText(items.map(i=>i.element),l.textFitHeight,flowGap,horizontal,measure);flowGap=fit.gap;
        items.forEach((item,i)=>{item.element=fit.elements[i];item.box=selectionBounds([item.element])!;});
      }
      const crossSizes=lines.map(line=>Math.max(0,...line.map(i=>fill(i.element,cross)&&l.wrap?preferredSize(i,cross):i.box[cross])));
      if(l.wrap)for(let r=0;r<lines.length;r++)for(const item of lines[r])if(fill(item.element,'h'))setSize(item,'h',crossSizes[r],measure);
      const lengths=lines.map(line=>line.reduce((sum,i)=>sum+i.box[main],0)+Math.max(0,line.length-1)*flowGap);
      const mainContent=Math.max(0,...lengths),crossContent=crossSizes.reduce((a,b)=>a+b,0)+Math.max(0,lines.length-1)*lineGap;
      if(l.widthMode==='hug')l.w=round(Math.max(1,(horizontal?mainContent:crossContent)+p.left+p.right));
      if(l.heightMode==='hug')l.h=round(Math.max(1,(horizontal?crossContent:mainContent)+p.top+p.bottom));
      let crossCursor=0;
      for(let r=0;r<lines.length;r++) {
        const line=lines[r],space=horizontal?l.w-p.left-p.right:l.h-p.top-p.bottom,occupied=line.reduce((sum,i)=>sum+i.box[main],0);
        const gap=l.justify==='space-between'&&line.length>1?Math.max(0,(space-occupied)/(line.length-1)):flowGap;
        const free=space-occupied-Math.max(0,line.length-1)*gap;
        let cursor=l.justify==='space-between'?0:offset(free,l.justify);
        const crossSpace=l.wrap?crossSizes[r]:horizontal?l.h-p.top-p.bottom:l.w-p.left-p.right;
        for(const item of line){const crossOffset=crossCursor+offset(crossSpace-item.box[cross],l.align);place(item,l.x+p.left+(horizontal?cursor:crossOffset),l.y+p.top+(horizontal?crossOffset:cursor));cursor+=item.box[main]+gap;}
        crossCursor+=crossSizes[r]+lineGap;
      }
    }
    for(const [id,e] of resolved)elements.set(id,e);
    const saved={...l,...(imposed?.w!==undefined?{widthMode:raw.widthMode}:{}),...(imposed?.h!==undefined?{heightMode:raw.heightMode}:{})};
    layouts.set(id,GroupLayoutSchema.parse(saved));
  }
  // The tree is validated before recursion; saved flat decks need no migration.
  for(const group of groups.filter(g=>!g.parent))resolve(group.id);
  const nextElements=slide.elements.map(e=>elements.get(e.id)!);
  const nextLayouts=slide.autoLayouts.map(l=>layouts.get(l.id)!).filter(l=>tree.descendants(l.id).length>0);
  if(enforceLocks)for(const e of nextElements){const before=originals.get(e.id)!;if(before.locked&&(['x','y','w','h'] as const).some(k=>Math.abs(e[k]-before[k])>.0001))throw new Error('Auto layout would move or resize a locked object. Unlock it first.');}
  if(nextElements.every((e,i)=>e===slide.elements[i])&&sameDocumentData(nextLayouts,slide.autoLayouts))return slide;
  return {...slide,elements:nextElements,autoLayouts:nextLayouts.length?nextLayouts:undefined};
}

/** Drag an individual child past a neighbor to reorder; dragging the complete group moves its frame. */
export function dragLayoutMember(slide: Slide, ids: string[], dx: number, dy: number,context=''): Operation[] | undefined {
  const roots=selectionRoots(slide,ids,context);if(roots.length!==1)return;
  const e=slide.elements.find(e=>e.id===roots[0])??groupProxy(slide,roots[0]);
  const l=slide.autoLayouts?.find(l=>l.id===e?.group);
  if(!l||!e)return;
  const direct=directMembers(slide,l.id),members=l.order.map(id=>direct.find(e=>e.id===id)!).filter(e=>e&&!e.hidden);
  if(members.length===1)return;
  const horizontal=l.direction==='horizontal',axis=horizontal?'x':'y',dimension=horizontal?'w':'h';
  const target=e[axis]+(horizontal?dx:dy)+e[dimension]/2;
  const rest=members.filter(v=>v.id!==e.id);let index=rest.findIndex(v=>target<v[axis]+v[dimension]/2);
  if(l.direction==='grid'||l.wrap) {
    const rows:SlideElement[][]=[];
    for(const v of rest) {const row=rows.find(r=>r.some(i=>v.y<i.y+i.h-.001&&v.y+v.h>i.y+.001));if(row)row.push(v);else rows.push([v]);}
    const y=e.y+dy+e.h/2,x=e.x+dx+e.w/2;
    const row=[...rows].sort((a,b)=>Math.abs(y-(Math.min(...a.map(v=>v.y))+Math.max(...a.map(v=>v.y+v.h)))/2)-Math.abs(y-(Math.min(...b.map(v=>v.y))+Math.max(...b.map(v=>v.y+v.h)))/2))[0];
    if(row){const before=row.find(v=>x<v.x+v.w/2);index=before?rest.indexOf(before):rest.indexOf(row.at(-1)!)+1;}
  }
  const visible=rest.map(v=>v.id);visible.splice(index<0?visible.length:index,0,e.id);
  let cursor=0;const order=l.order.map(id=>members.some(v=>v.id===id)?visible[cursor++]:id);
  return order.every((id,i)=>id===l.order[i])?[]:[{op:'set_group_layout',slideId:slide.id,layout:{...l,order}}];
}
