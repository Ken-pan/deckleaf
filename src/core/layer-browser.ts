import type {ContainerTree} from './container-tree';
import type {SlideElement,SlideGroup} from './model';
import type {Operation} from './operations';
export type LayerRow={id:string;depth:number;group?:SlideGroup;layer?:SlideElement;name?:string;count?:number;layout?:boolean};

/** Visible row order is also the range-selection contract; collapsed groups remain units. */
export function layerRangeSelection(rows:readonly LayerRow[],anchor:string,target:string,tree:ContainerTree):string[]{
  const a=rows.findIndex(row=>row.id===anchor),b=rows.findIndex(row=>row.id===target);
  const range=a<0?rows.filter(row=>row.id===target):rows.slice(Math.min(a,b),Math.max(a,b)+1);
  const ids=new Set<string>();
  for(const row of range){if(row.layer)ids.add(row.id);else{const members=tree.descendants(row.id),visible=members.filter(e=>!e.hidden);for(const e of visible.length?visible:members)ids.add(e.id);}}
  return [...ids];
}
export function renameLayerOperations(slideId:string,id:string,name:string,tree:ContainerTree):Operation[]{
  name=name.trim();if(!name||name.length>200)return [];
  const layer=tree.elements.get(id),group=tree.groupById.get(id),layout=tree.layouts.get(id);
  if(layer)return layer.locked||layer.name===name?[]:[{op:'update_element',slideId,elementId:id,patch:{name}}];
  if(!group||tree.stats.get(id)?.locked)return [];
  const ops:Operation[]=[];
  if(group.name!==name)ops.push({op:'set_group',slideId,group:{...group,name}});
  if(layout&&layout.name!==name)ops.push({op:'set_group_layout',slideId,layout:{...layout,name}});
  return ops;
}
