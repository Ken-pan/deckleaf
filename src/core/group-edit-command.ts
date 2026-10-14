import type {Editor} from './editor.svelte';
import {groupElements,createGroupLayout} from './group-commands';

/** Container commands share the same deferred transaction implementation. */
export function editContainer(editor:Editor,action:'group'|'auto',ungroup:boolean,wrap:boolean,target:string,ids:string):void {
  if(!editor.slide||editor.activeId!==target||editor.selected.join(',')!==ids)return;
  const scope=action==='auto'?editor.individualSelection?editor.selectionScope:editor.selectedContainer||editor.editingGroup:ungroup?editor.selectedContainer:editor.selectionScope;
  const ops=action==='auto'?createGroupLayout(editor.slide,editor.selected,scope):groupElements(editor.slide,editor.selected,ungroup,scope,wrap),revision=editor.deck!.revision;
  editor.commit(ops);if(editor.deck!.revision===revision)return;
  if(action==='group'){const created=ops.find(op=>op.op==='set_group');if(created?.op==='set_group')editor.chooseGroup(created.group.id);else editor.selectedGroup='';}
  else{const layout=ops.find(op=>op.op==='set_group_layout');if(layout?.op==='set_group_layout')editor.chooseGroup(layout.layout.id);}
}
