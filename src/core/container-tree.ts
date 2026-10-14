import type {Slide,SlideElement,SlideGroup} from './model';
import {selectionBounds,marqueeSelection,type Bounds,type MarqueeOptions} from './interactions';

/** One index per read/transaction. It never caches mutable document geometry. */
export function createContainerTree(slide:Slide) {
  const layouts=new Map((slide.autoLayouts??[]).map(l=>[l.id,l]));
  const groupById=new Map((slide.groups??[]).map(g=>[g.id,g]));
  for(const id of new Set([...slide.elements.map(e=>e.group).filter((id):id is string=>Boolean(id)),...layouts.keys()]))if(!groupById.has(id))groupById.set(id,{id,name:layouts.get(id)?.name??'Group'});
  const groups=[...groupById.values()],elements=new Map(slide.elements.map(e=>[e.id,e]));
  const childGroups=new Map<string|undefined,SlideGroup[]>(),directElements=new Map<string|undefined,SlideElement[]>();
  for(const g of groups){const list=childGroups.get(g.parent)??[];list.push(g);childGroups.set(g.parent,list);}
  const chains=new Map<string,string[]>(),leaves=new Map<string,SlideElement[]>(),rank=new Map<string,number>();
  function ancestors(id:string) {
    const cached=chains.get(id);if(cached)return cached;
    const chain:string[]=[],seen=new Set<string>();let parent=elements.get(id)?.group??groupById.get(id)?.parent;
    while(parent&&!seen.has(parent)&&chain.length<32){seen.add(parent);chain.push(parent);parent=groupById.get(parent)?.parent;}
    chains.set(id,chain);return chain;
  }
  slide.elements.forEach((e,i)=>{const direct=directElements.get(e.group)??[];direct.push(e);directElements.set(e.group,direct);rank.set(e.id,i);for(const id of ancestors(e.id)){const list=leaves.get(id)??[];list.push(e);leaves.set(id,list);rank.set(id,i);}});
  const stats=new Map(groups.map(g=>{const members=leaves.get(g.id)??[];return[g.id,{count:members.length,visible:members.filter(e=>!e.hidden).length,locked:members.some(e=>e.locked)}] as const;}));
  return {groups,groupById,elements,layouts,childGroups,directElements,rank,stats,ancestors,descendants:(id:string)=>leaves.get(id)??[]};
}
export type ContainerTree=ReturnType<typeof createContainerTree>;

/** Legacy flat groups remain readable without rewriting their saved document. */
export function slideGroups(slide:Slide):SlideGroup[] {
  const groups=new Map((slide.groups??[]).map(g=>[g.id,g]));
  for(const id of new Set([...slide.elements.map(e=>e.group).filter((id):id is string=>Boolean(id)),...(slide.autoLayouts??[]).map(l=>l.id)]))if(!groups.has(id))groups.set(id,{id,name:slide.autoLayouts?.find(l=>l.id===id)?.name??'Group'});
  return [...groups.values()];
}
export function descendants(slide:Slide,id:string):SlideElement[] {
  const groups=slideGroups(slide),ids=new Set([id]);
  for(let n=0;n<32;n++){const children=groups.filter(g=>g.parent&&ids.has(g.parent)&&!ids.has(g.id));if(!children.length)break;for(const g of children)ids.add(g.id);}
  return slide.elements.filter(e=>e.group&&ids.has(e.group));
}
export function ancestorIds(slide:Slide,id:string):string[] {
  const groups=slideGroups(slide),chain:string[]=[];let parent=slide.elements.find(e=>e.id===id)?.group??groups.find(g=>g.id===id)?.parent;
  while(parent&&!chain.includes(parent)&&chain.length<32){chain.push(parent);parent=groups.find(g=>g.id===parent)?.parent;}
  return chain;
}
export function groupBox(slide:Slide,id:string) {return slide.autoLayouts?.find(l=>l.id===id)??selectionBounds(descendants(slide,id).filter(e=>!e.hidden))??selectionBounds(descendants(slide,id));}
/** Lightweight geometry proxies allow the same flow algorithm to place containers and leaves. */
export function groupProxy(slide:Slide,id:string):SlideElement|undefined {
  const group=slideGroups(slide).find(g=>g.id===id),leaves=descendants(slide,id),box=groupBox(slide,id);
  if(!group||!leaves.length||!box)return;
  return {...leaves[0],...box,id,name:slide.autoLayouts?.find(l=>l.id===id)?.name??group.name,type:'rect',group:group.parent,rotation:0,layoutItem:group.layoutItem,hidden:leaves.every(e=>e.hidden),locked:leaves.some(e=>e.locked)};
}
export function directMembers(slide:Slide,id:string):SlideElement[] {
  return [...slide.elements.filter(e=>e.group===id),...slideGroups(slide).filter(g=>g.parent===id).map(g=>groupProxy(slide,g.id)).filter((e):e is SlideElement=>Boolean(e))];
}
/** An editing scope selects its direct contents, never the enclosing container. */
export const editingSelectionScope=(id:string)=>`@scope:${id}`;
export const selectionEditingScope=(context:string)=>context.startsWith('@scope:')?context.slice(7):'';
export const individualSelectionScope='@leaves';
/** Highest fully selected container wins; partial selections remain individual leaves. */
export function selectionRoots(slide:Slide,ids:string[],context='',tree=createContainerTree(slide)):string[] {
  const selected=new Set(ids);
  if(context===individualSelectionScope)return slide.elements.filter(e=>selected.has(e.id)).map(e=>e.id);
  const scope=selectionEditingScope(context);
  if(context&&ids.length===1&&ids[0]===context&&tree.elements.has(context))return[context];
  if(context&&!scope&&tree.groupById.has(context)&&tree.descendants(context).filter(e=>!e.hidden).every(e=>selected.has(e.id)))return[context];
  const complete=new Set(tree.groups.filter(g=>{if(scope&&!tree.ancestors(g.id).includes(scope))return false;const leaves=tree.descendants(g.id).filter(e=>!e.hidden);return leaves.length&&leaves.every(e=>selected.has(e.id));}).map(g=>g.id));
  const roots=new Set<string>();
  for(const e of slide.elements.filter(e=>selected.has(e.id))){const ancestor=[...tree.ancestors(e.id)].reverse().find(id=>complete.has(id));roots.add(ancestor??e.id);}
  return [...roots];
}
export function arrangementParent(slide:Slide,ids:string[],context=''):string|undefined {
  const roots=selectionRoots(slide,ids,context),groups=slideGroups(slide);
  const parents=roots.map(id=>slide.elements.find(e=>e.id===id)?.group??groups.find(g=>g.id===id)?.parent);
  return parents.length&&parents.every(id=>id===parents[0])?parents[0]:undefined;
}
export function treeSelection(slide:Slide,id:string,individual=false,tree=createContainerTree(slide)):string[] {
  if(tree.groupById.has(id)){const es=tree.descendants(id),visible=es.filter(e=>!e.hidden);return (visible.length?visible:es).map(e=>e.id);}
  const ancestors=tree.ancestors(id);return !individual&&ancestors.length?tree.descendants(ancestors.at(-1)!).filter(e=>!e.hidden).map(e=>e.id):[id];
}

/** Resolve one direct editing unit in the active container, or the outer root on the slide. */
export function selectionTarget(slide:Slide,id:string,scope='',individual=false,tree=createContainerTree(slide)):string {
  if(individual||tree.groupById.has(id))return id;
  const chain=tree.ancestors(id);if(!scope)return chain.at(-1)??id;
  const level=chain.indexOf(scope);return level>0?chain[level-1]:id;
}
export function groupMarquee(slide:Slide,scope:string,box:Bounds,base:string[]=[],options:MarqueeOptions={}):string[] {
  if(!scope)return marqueeSelection(slide.elements,box,base,slideGroups(slide),options);
  const elements=descendants(slide,scope).map(e=>e.group===scope?{...e,group:undefined}:e),groups=slideGroups(slide).filter(g=>ancestorIds(slide,g.id).includes(scope)).map(g=>g.parent===scope?{...g,parent:undefined}:g);
  return [...new Set([...base.filter(id=>slide.elements.some(e=>e.id===id)),...marqueeSelection(elements,box,[],groups,options)])];
}
