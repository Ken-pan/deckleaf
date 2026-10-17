import {canEditText} from './core/shapes';
import { Copy, Trash2, Lock, Unlock, Eye, EyeOff, Type, Image, Group, Ungroup, BringToFront, SendToBack, AlignHorizontalJustifyCenter, LayoutGrid } from '@lucide/svelte';
import { editor } from './core/editor.svelte';
import { descendants } from './core/container-tree';
import { canReorderSelection } from './core/stack-order';
import { selectedLayout } from './core/object-layout';
import { elementLabels } from './components/element-labels';
import BringForward from './components/icons/BringForward.svelte';
import SendBackward from './components/icons/SendBackward.svelte';
import { EnterGroupIcon } from './components/icons/workspace-icons';
import { focusCanvasSelection, objectAction } from './editor-focus';
import type { ContextActions, ContextMenuItem } from './context-menu';
import {groupExitActions} from './group-exit-actions';
import {objectClipboardActions} from './clipboard-actions';
import {arrangeContextActions} from './arrange-context-actions';

export function objectContextActions(options: {properties:()=>void; replace:(id:string)=>void; fromLayer?:boolean}): ContextActions {
  const slide=editor.slide!, selection=editor.selection, first=selection[0], group=editor.selectedContainer;
  const members=group?descendants(slide,group):selection;
  const locked=members.some(e=>e.locked), hidden=members.every(e=>e.hidden);
  const label=group?'Group':selection.length===1?`${elementLabels[first.type]} · ${first.name}`:`${selection.length} objects`;
  const clipboard=objectClipboardActions().filter(item=>item.label==='Cut'||item.label==='Copy');
  // A locked selection needs a way back into editing, not a list of disabled tools.
  if(locked)return {label,items:[
    ...clipboard.filter(item=>item.label==='Copy'),
    {label:members.length>1?'Unlock selection':'Unlock',icon:Unlock,onselect:()=>editor.patch({locked:false})},
  ]};
  const layout=selectedLayout(slide,editor.selected,group||editor.editingGroup);
  const stack:ContextMenuItem[]=([{label:'Bring forward',direction:1,icon:BringForward},{label:'Send backward',direction:-1,icon:SendBackward},{label:'Bring to front',direction:'front',icon:BringToFront},{label:'Send to back',direction:'back',icon:SendToBack}] as const)
    .filter(item=>canReorderSelection(slide,editor.selected,item.direction,editor.selectionScope))
    .map(item=>({label:item.label,icon:item.icon,onselect:()=>editor.reorderSelection(item.direction)}));
  const arrange=arrangeContextActions();
  const groupActions:ContextMenuItem[]=[
    ...(group?[
      {label:'Enter group',icon:EnterGroupIcon,onselect:()=>{editor.enterGroup();void focusCanvasSelection();}},
      {label:'Ungroup',icon:Ungroup,shortcut:'⇧⌘G',onselect:()=>editor.group(true)},
    ]:[]),
    ...groupExitActions(),
  ];
  const primary:ContextMenuItem[]=[
    ...(selection.length===1&&canEditText(first)&&!hidden?[{label:'Edit text',icon:Type,shortcut:'Enter',onselect:()=>{editor.choose(first.id,false,true);editor.editingId=first.id;}}]:[]),
    ...(selection.length===1&&first?.type==='image'?[{label:'Replace image',icon:Image,onselect:()=>options.replace(first.id)}]:[]),
  ];
  return {label,items:[
    ...primary,
    ...clipboard.map((item,i)=>({...item,divider:i===0&&primary.length>0})),
    {label:'Duplicate',icon:Copy,shortcut:'⌘D',onselect:()=>void objectAction(()=>editor.duplicateSelection())},
    ...(selection.length>1&&!group?[{label:'Group selection',icon:Group,shortcut:'⌘G',divider:true,onselect:()=>editor.group()}]:[]),
    ...(groupActions.length?[{label:'Group',icon:Group,divider:true,children:groupActions}]:[]),
    ...(stack.length?[{label:'Order',icon:BringToFront,divider:!(selection.length>1||groupActions.length),children:stack}]:[]),
    ...(arrange.length?[{label:'Arrange',icon:AlignHorizontalJustifyCenter,children:arrange}]:[]),
    ...(layout||group||selection.length>1?[{label:'Auto layout',icon:LayoutGrid,onselect:async()=>{if(!layout)await editor.autoLayout();options.properties();}}]:[]),
    {label:'Lock',icon:Lock,onselect:()=>editor.patch({locked:true})},
    ...(options.fromLayer||hidden?[{label:hidden?'Show':'Hide',icon:hidden?Eye:EyeOff,onselect:()=>editor.commit(members.map(e=>({op:'update_element' as const,slideId:slide.id,elementId:e.id,patch:{hidden:!hidden}})))}]:[]),
    {label:'Delete',icon:Trash2,shortcut:'⌫',tone:'danger',divider:true,onselect:()=>void objectAction(()=>editor.remove())},
  ]};
}
