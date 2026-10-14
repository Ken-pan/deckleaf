import type {Editor} from './editor.svelte';
import {slideGroups,treeSelection} from './container-tree';

export function selectMovedLayers(editor:Editor,ids:string[],parent?:string):void {
  const slide=editor.slide;if(!slide)return;const groups=new Set(slideGroups(slide).map(g=>g.id));
  editor.selected=ids.flatMap(id=>groups.has(id)?treeSelection(slide,id,true):[id]);
  editor.selectedGroup=ids.length===1&&groups.has(ids[0])?ids[0]:'';
  editor.individualSelection=editor.individualSelection&&!ids.some(id=>groups.has(id));
  editor.editingGroupId=parent??'';editor.hovered='';editor.editingId='';
}
