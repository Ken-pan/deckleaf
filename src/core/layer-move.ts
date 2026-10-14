import type {Slide} from './model';
import type {Operation} from './operations';
import {createContainerTree,type ContainerTree} from './container-tree';

export type LayerDrop={target:string|null;position:'before'|'after'|'inside'};
export type LayerMove={ids:string[];parent?:string;operations:Operation[];reason?:string};

/** Matches the layer panel: front first for stacks, flow order for auto layout. */
export function layerChildren(tree:ContainerTree,parent?:string):string[] {
  const children=[...(tree.directElements.get(parent)??[]).map(e=>e.id),...(tree.childGroups.get(parent)??[]).map(g=>g.id)];
  const order=tree.layouts.get(parent??'')?.order;
  if(order){const rank=new Map(order.map((id,i)=>[id,i]));return children.sort((a,b)=>(rank.get(a)??order.length)-(rank.get(b)??order.length));}
  return children.sort((a,b)=>(tree.rank.get(b)??-1)-(tree.rank.get(a)??-1));
}

/** Derive shared operations without mutating geometry or embedded source data. */
export function layerMove(slide:Slide,source:string[],drop:LayerDrop,tree=createContainerTree(slide)):LayerMove {
  const picked=new Set(source),ids=[...picked].filter(id=>!tree.ancestors(id).some(g=>picked.has(g))),roots=new Set(ids);
  const fail=(reason:string):LayerMove=>({ids,operations:[],reason});
  const parentOf=(id:string)=>tree.elements.get(id)?.group??tree.groupById.get(id)?.parent;
  if(!ids.length||ids.some(id=>!tree.elements.has(id)&&!tree.groupById.has(id)))return fail('This layer no longer exists.');
  if(ids.some(id=>tree.elements.get(id)?.designPattern))return fail('Background patterns stay on the slide.');
  if(ids.some(id=>tree.elements.get(id)?.locked||tree.stats.get(id)?.locked))return fail('Unlock the selected layers before moving them.');
  if(drop.target===null&&drop.position!=='inside')return fail('Choose a layer or a container.');
  if(drop.target!==null&&!tree.elements.has(drop.target)&&!tree.groupById.has(drop.target))return fail('The destination no longer exists.');
  if(drop.position==='inside'&&drop.target!==null&&!tree.groupById.has(drop.target))return fail('Drop inside a group, or between layers.');
  if(drop.target!==null&&picked.has(drop.target))return drop.position==='inside'?fail('A group cannot contain itself.'):({ids,operations:[]});
  const parent=drop.position==='inside'?drop.target??undefined:parentOf(drop.target!);
  if(parent&&ids.some(id=>id===parent||tree.ancestors(parent).includes(id)))return fail('A group cannot move into its descendants.');
  const depth=parent?tree.ancestors(parent).length+1:0;
  if(ids.some(id=>tree.groupById.has(id)&&depth+Math.max(1,...tree.descendants(id).map(e=>tree.ancestors(e.id).indexOf(id)+1))>32))return fail('Keep group nesting within 32 levels.');
  const affected=new Set<string>();
  for(const id of ids)for(const ancestor of tree.ancestors(id))if(tree.layouts.has(ancestor))affected.add(ancestor);
  if(parent)for(const id of [parent,...tree.ancestors(parent)])if(tree.layouts.has(id))affected.add(id);
  if([...affected].some(id=>tree.stats.get(id)?.locked))return fail('Unlock the affected auto layout before moving layers.');

  // Keep a multi-selection in its visible tree order, including selected subtrees.
  const ordered:string[]=[];
  function visit(at?:string){for(const id of layerChildren(tree,at)){if(roots.has(id))ordered.push(id);else if(tree.groupById.has(id))visit(id);}}
  visit();
  const siblingOrders=new Map<string|undefined,string[]>();
  const oldParents=new Set(ids.map(parentOf));
  for(const p of [...oldParents,parent])siblingOrders.set(p,layerChildren(tree,p).filter(id=>!picked.has(id)));
  const destination=siblingOrders.get(parent)!;
  let position=drop.position==='inside'?destination.length:destination.indexOf(drop.target!)+(drop.position==='after'?1:0);
  if(position<0)return fail('The destination no longer exists.');
  destination.splice(position,0,...ordered);
  const moved=ids.some(id=>parentOf(id)!==parent);
  // Empty wrappers disappear in the transaction. Exclude their proxies before
  // validating a destination layout's direct membership.
  const counts=new Map([...tree.stats].map(([id,stats])=>[id,stats.count]));
  for(const id of ids)if(parentOf(id)!==parent){
    const size=tree.groupById.has(id)?tree.descendants(id).length:1;
    for(const ancestor of tree.ancestors(id))counts.set(ancestor,(counts.get(ancestor)??0)-size);
    if(parent)for(const ancestor of [parent,...tree.ancestors(parent)])counts.set(ancestor,(counts.get(ancestor)??0)+size);
  }
  for(const [p,order] of siblingOrders)siblingOrders.set(p,order.filter(id=>!tree.groupById.has(id)||(counts.get(id)??0)>0));
  const orderChanged=[...siblingOrders].some(([p,order])=>{const before=layerChildren(tree,p);return before.length!==order.length||order.some((id,i)=>id!==before[i]);});
  if(!moved&&!orderChanged)return {ids,parent,operations:[]};

  const operations:Operation[]=[];
  for(const id of ids)if(parentOf(id)!==parent){const group=tree.groupById.get(id);operations.push(group?{op:'set_group',slideId:slide.id,group:{...group,parent,layoutItem:undefined}}:{op:'update_element',slideId:slide.id,elementId:id,patch:{group:parent,layoutItem:undefined}});}
  for(const [p,order] of siblingOrders){const layout=p?tree.layouts.get(p):undefined;if(layout&&order.length)operations.push({op:'set_group_layout',slideId:slide.id,layout:{...layout,order}});}
  // Flow changes use the saved layout order. Plain siblings use the paint stack.
  if([...siblingOrders.keys()].some(p=>!p||!tree.layouts.has(p))){
    function paint(at?:string):string[]{
      const order=siblingOrders.get(at)??layerChildren(tree,at);
      // Auto-layout paint order remains independent from its spatial flow.
      const stack=at&&tree.layouts.has(at)?[...order].sort((a,b)=>(tree.rank.get(a)??-1)-(tree.rank.get(b)??-1)):[...order].reverse();
      return stack.flatMap(id=>tree.groupById.has(id)?paint(id):[id]);
    }
    const painted=paint().filter(id=>!tree.elements.get(id)?.designPattern);let offset=0;
    const order=slide.elements.map(e=>e.designPattern?e.id:painted[offset++]);
    if(order.some((id,i)=>id!==slide.elements[i].id))operations.push({op:'reorder_elements',slideId:slide.id,ids:order});
  }
  return {ids:ordered,parent,operations};
}
