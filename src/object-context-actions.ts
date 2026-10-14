import { Copy, ClipboardPaste, Scissors, Trash2, Lock, Unlock, Eye, EyeOff, Type, Image, Group, Ungroup, Layers, PanelRight, BringToFront, SendToBack, AlignHorizontalJustifyCenter, SquareDashedMousePointer, ArrowLeft } from '@lucide/svelte';
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
import {pasteFromClipboard} from './editor-clipboard';
import {objectClipboardActions} from './clipboard-actions';
import type {Point} from './core/interactions';

export function objectContextActions(options: {properties:()=>void; replace:(id:string)=>void; align:()=>void;pastePoint?:Point}): ContextActions {
  const slide=editor.slide!, selection=editor.selection, first=selection[0], group=editor.selectedContainer;
  const members=group?descendants(slide,group):selection;
  const locked=members.some(e=>e.locked), allLocked=members.every(e=>e.locked), hidden=members.every(e=>e.hidden);
  const unlockable=allLocked||Boolean(group&&locked);
  const layout=selectedLayout(slide,editor.selected,group||editor.editingGroup);
  const arrange: ContextMenuItem[] = [
    {label:'Align and distribute',icon:AlignHorizontalJustifyCenter,disabled:locked,onselect:options.align},
    ...([{label:'Bring forward',direction:1,icon:BringForward},{label:'Send backward',direction:-1,icon:SendBackward},{label:'Bring to front',direction:'front',icon:BringToFront},{label:'Send to back',direction:'back',icon:SendToBack}] as const).map((item,index)=>({label:item.label,icon:item.icon,divider:index===0,disabled:locked||!canReorderSelection(slide,editor.selected,item.direction,editor.selectionScope),onselect:()=>editor.reorderSelection(item.direction)})),
    {label:layout?'Auto layout properties':'Add auto layout',disabled:locked,divider:true,onselect:async()=>{if(!layout)await editor.autoLayout();options.properties();}},
    ...(selection.length>1&&!group?[{label:'Group selection',icon:Group,shortcut:'⌘G',disabled:locked,onselect:()=>editor.group()}]:[]),
    ...(group?[{label:'Ungroup',icon:Ungroup,shortcut:'⇧⌘G',disabled:locked,onselect:()=>editor.group(true)}]:[]),
  ];
  const items: ContextMenuItem[] = [
    ...(selection.length===1&&first?.type==='text'&&!locked?[{label:'Edit text',icon:Type,shortcut:'Enter',disabled:first.hidden,onselect:()=>{editor.choose(first.id,false,true);editor.editingId=first.id;}}]:[]),
    ...(selection.length===1&&first?.type==='image'?[{label:'Replace image',icon:Image,disabled:locked,onselect:()=>options.replace(first.id)}]:[]),
    ...(group?[{label:'Enter group',icon:EnterGroupIcon,onselect:()=>{editor.enterGroup();void focusCanvasSelection();}}]:[]),
    ...groupExitActions(),
    ...objectClipboardActions().map((item,i)=>({...item,divider:i===0&&Boolean(group||first?.type==='text'||first?.type==='image')})),
    ...(options.pastePoint?[{label:'Paste here',onselect:()=>pasteFromClipboard({point:options.pastePoint})}]:[]),
    {label:'Duplicate',icon:Copy,shortcut:'⌘D',disabled:locked,onselect:()=>void objectAction(()=>editor.duplicateSelection())},
    {label:'Arrange',icon:BringToFront,divider:true,children:arrange},
    {label:unlockable?'Unlock':'Lock',icon:unlockable?Unlock:Lock,onselect:()=>editor.patch({locked:!unlockable})},
    {label:hidden?'Show':'Hide',icon:hidden?Eye:EyeOff,onselect:()=>editor.commit(members.map(e=>({op:'update_element',slideId:slide.id,elementId:e.id,patch:{hidden:!hidden}})))},
    {label:'Select',icon:SquareDashedMousePointer,children:[
      ...(first?[{label:'Overlapping objects',icon:Layers,disabled:first.hidden,onselect:()=>{editor.layerPickerId=first.id;}}]:[]),
      {label:editor.editingGroup?'All group members':'All objects on slide',shortcut:'⌘A',onselect:()=>editor.selectAll()},
      {label:editor.additiveSelection?'Finish multiple selection':'Select multiple objects',checked:editor.additiveSelection,onselect:()=>{editor.additiveSelection=!editor.additiveSelection;}},
      ...(editor.editingGroup?[{label:'Done editing group',icon:ArrowLeft,onselect:()=>{editor.exitGroup();void focusCanvasSelection();}}]:[]),
    ]},
    {label:'Object properties',icon:PanelRight,onselect:options.properties},
    {label:'Delete',icon:Trash2,shortcut:'⌫',tone:'danger',divider:true,disabled:locked,onselect:()=>void objectAction(()=>editor.remove())},
  ];
  return {label:group?'Group':selection.length===1?`${elementLabels[first.type]} · ${first.name}`:`${selection.length} objects`,items};
}
