import type {Slide} from './model';
import type {Operation} from './operations';
import {createContainerTree,selectionRoots} from './container-tree';

// Delete the same complete units as move/resize, including hidden descendants.
// A locked descendant protects its whole selected group from partial deletion.
export function deleteSelection(slide:Slide,ids:string[],context='') {
  const tree=createContainerTree(slide),all=new Set<string>(),removable=new Set<string>();
  for(const id of selectionRoots(slide,ids,context,tree)){
    const leaves=tree.descendants(id),element=tree.elements.get(id),members=leaves.length?leaves:element?[element]:[];
    for(const e of members)all.add(e.id);
    if(!members.some(e=>e.locked))for(const e of members)removable.add(e.id);
  }
  const operations:Operation[]=slide.elements.filter(e=>removable.has(e.id)).map(e=>({op:'delete_element',slideId:slide.id,elementId:e.id}));
  return {operations,blocked:all.size-removable.size};
}
