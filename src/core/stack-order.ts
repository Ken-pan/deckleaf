import type {Slide} from './model';
import {slideGroups,descendants,selectionRoots} from './container-tree';
export type StackDirection=1|-1|'front'|'back';
function move<T>(items:T[],selected:(item:T)=>boolean,direction:StackDirection):T[]{
  const next=[...items];
  if(direction==='front'||direction==='back'){const chosen=next.filter(selected),rest=next.filter(v=>!selected(v));return direction==='front'?[...rest,...chosen]:[...chosen,...rest];}
  if(direction===1){for(let i=next.length-2;i>=0;i--)if(selected(next[i])&&!selected(next[i+1]))[next[i],next[i+1]]=[next[i+1],next[i]];}
  else for(let i=1;i<next.length;i++)if(selected(next[i])&&!selected(next[i-1]))[next[i],next[i-1]]=[next[i-1],next[i]];
  return next;
}
/** Groups occupy one stack position, while an individual child sorts within its group. */
export function reorderedSelection(slide:Slide,ids:string[],direction:StackDirection,context=''):string[]{
  const groups=slideGroups(slide),picked=new Set(selectionRoots(slide,ids,context)),index=new Map(slide.elements.map((e,i)=>[e.id,i]));let changed=false;
  const rank=(id:string)=>index.get(id)??Math.max(-1,...descendants(slide,id).map(e=>index.get(e.id)!));
  const editable=(id:string)=>{const members=descendants(slide,id);return members.length?members.every(e=>!e.locked):!slide.elements.find(e=>e.id===id)?.locked;};
  function walk(parent:string|undefined):string[]{
    const original=[...slide.elements.filter(e=>e.group===parent).map(e=>e.id),...groups.filter(g=>g.parent===parent).map(g=>g.id)].sort((a,b)=>rank(a)-rank(b));
    const ordered=move(original,id=>picked.has(id)&&editable(id),direction);if(ordered.some((id,i)=>id!==original[i]))changed=true;
    return ordered.flatMap(id=>groups.some(g=>g.id===id)?walk(id):[id]);
  }
  const ordered=walk(undefined);return changed?ordered:slide.elements.map(e=>e.id);
}
export function canReorderSelection(slide:Slide|undefined,ids:string[],direction:StackDirection,context=''):boolean {
  return Boolean(slide&&reorderedSelection(slide,ids,direction,context).some((id,i)=>id!==slide.elements[i].id));
}
