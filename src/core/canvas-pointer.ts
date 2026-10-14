import type {Slide} from './model';
import {createContainerTree,groupBox} from './container-tree';
import {selectionMembers} from './selection-transform';

/** Canvas hover follows the same nesting level as the next ordinary click. */
export function canvasHoverTarget(slide:Slide,id:string,scope='',individual=false):string {
  const tree=createContainerTree(slide);
  if(tree.groupById.has(id)||individual)return id;
  const chain=tree.ancestors(id),level=scope?chain.indexOf(scope):-1;
  return level>=0?(level>0?chain[level-1]:id):chain.at(-1)??id;
}

/** Empty space selects only direct containers; entering one releases its interior for box selection. */
export function canvasContainerRegions(slide:Slide,scope='',selected:string[]=[]) {
  const tree=createContainerTree(slide);
  return tree.groups.filter(g=>g.parent===(scope||undefined)&&(tree.layouts.has(g.id)||selected.includes(g.id))&&tree.descendants(g.id).some(e=>!e.hidden&&!e.designPattern)).flatMap(g=>{
    const box=groupBox(slide,g.id);return box?[{...box,id:g.id,name:tree.layouts.get(g.id)?.name??g.name,locked:tree.stats.get(g.id)!.locked}]:[];
  });
}

/** Hover must promise the same movable unit that a pointer press will select. */
export function canvasMovableIds(slide:Slide,selected:string[],context='',scope='',individual=false):Set<string> {
  const tree=createContainerTree(slide),picked=new Set(selected);
  const movableSelection=new Set(selected.length?selectionMembers(slide,selected,false,context,tree).map(e=>e.id):[]);
  const result=new Set<string>();
  for(const e of slide.elements){
    if(e.hidden||e.locked||e.designPattern)continue;
    if(individual){result.add(e.id);continue;}
    if(picked.has(e.id)){if(movableSelection.has(e.id))result.add(e.id);continue;}
    const chain=tree.ancestors(e.id),level=scope?chain.indexOf(scope):-1;
    const unit=level>=0?(level>0?chain[level-1]:e.id):chain.at(-1)??e.id;
    if(!tree.stats.get(unit)?.locked)result.add(e.id);
  }
  return result;
}
