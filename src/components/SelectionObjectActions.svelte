<script lang="ts">
  import {canAddAutoLayout} from '../core/group-commands';
  import {canReorderSelection} from '../core/stack-order';
  import {selectionMembers} from '../core/selection-transform';
  import {editor} from '../core/editor.svelte';
  import {objectAction} from '../editor-focus';
  import {objectClipboardActions} from '../clipboard-actions';
  import {groupExitActions} from '../group-exit-actions';
  import {ActionMenu,Button} from './ui';
  import AsyncFeature from './AsyncFeature.svelte';
  import AlignmentControls from './AlignmentControls.svelte';
  import {selectedLayout} from '../core/object-layout';
  import {EnterGroupIcon} from './icons/workspace-icons';
  import {layoutIcons} from './icons/layout-icons';
  import BringForward from './icons/BringForward.svelte';
  import SendBackward from './icons/SendBackward.svelte';
  import {Ellipsis, Copy, Trash2, Lock, Unlock, BringToFront, SendToBack, Group, Ungroup, Layers, SquareDashedMousePointer, AlignHorizontalJustifyCenter, PanelRight} from '@lucide/svelte';
  let {onproperties,mode='all'}: {onproperties:()=>void;mode?:'all'|'primary'|'more'}=$props();
  let alignment=$state<{openAt:(rect:DOMRect)=>void}>();
  let editingBlock=$state('');
  const single=$derived(editor.selection.length===1), first=$derived(editor.selection[0]);
  const allLocked=$derived(editor.selection.length>0&&editor.selection.every(e=>e.locked));
  const blockedGroup=$derived(Boolean(editor.selectedContainer&&editor.slide&&selectionMembers(editor.slide,editor.selected,true,editor.selectedContainer).some(e=>e.locked)));
  const unlockable=$derived(allLocked||blockedGroup);
  const editable=$derived(editor.selection.filter(e=>!e.locked));
  const grouped=$derived(Boolean(editor.selectedContainer));
  const block=$derived(editor.slide?.groups?.find(group=>group.id===editor.selectedContainer)?.block);
  const layout=$derived(editor.slide&&selectedLayout(editor.slide,editor.selected,editor.selectedContainer||(!editor.selectedContainer&&editor.selected.length>1?editor.editingGroup:'')));

</script>
{#if mode!=='more'&&editor.selection.length>1&&!allLocked}
  <AlignmentControls compact />
  {#if block}<Button disabled={blockedGroup} onclick={()=>editingBlock=editor.selectedContainer}>Edit block</Button>{:else if grouped}<button class="icon-btn" aria-label="Enter group" title="Enter group · Enter" onclick={event=>void objectAction(()=>editor.enterGroup(),event)}><EnterGroupIcon size={16}/></button>{/if}
  <button class="icon-btn" class:compact-group-utility={grouped} class:compact-block-utility={Boolean(block)} aria-label={grouped?'Ungroup selection':'Group selection'} title={grouped?'Ungroup selection':'Group selection'} disabled={blockedGroup||!grouped&&editable.length<2} onclick={()=>editor.group(grouped)}>{#if grouped}<Ungroup size={16}/>{:else}<Group size={16}/>{/if}</button>
{/if}
{#if mode!=='primary'}
{#if !allLocked&&editor.selection.some(e=>e.type!=='text')&&!(single&&first?.type==='line')}<button class="icon-btn" class:compact-group-utility={grouped} class:compact-block-utility={Boolean(block)} aria-label="Duplicate selection" title="Duplicate selection" onclick={event=>void objectAction(()=>editor.duplicateSelection(),event)}><Copy size={16}/></button>{/if}
<ActionMenu label="More object actions" iconOnly items={[
  {label:'Object properties',icon:PanelRight,onselect:onproperties},
  ...objectClipboardActions(),
  ...(editor.selectedContainer?[{label:'Enter group',icon:EnterGroupIcon,onselect:()=>editor.enterGroup()}]:[]),
  ...(editor.editingGroup?[{label:'Select all members',icon:SquareDashedMousePointer,onselect:()=>editor.selectAll()}]:[]),
  ...groupExitActions(),
  {label:'Duplicate selection',icon:Copy,disabled:allLocked||!editor.selection.length,onselect:event=>void objectAction(()=>editor.duplicateSelection(),event)},
  {label:unlockable?'Unlock selection':'Lock selection',icon:unlockable?Unlock:Lock,disabled:!editor.selection.length,onselect:()=>editor.patch({locked:!unlockable})},
  {label:'Align and distribute',icon:AlignHorizontalJustifyCenter,divider:true,disabled:allLocked||blockedGroup||!editor.selection.length,onselect:()=>{const target=document.activeElement;if(target instanceof HTMLElement)alignment?.openAt(target.getBoundingClientRect());}},
  {label:'Bring forward',icon:BringForward,disabled:!canReorderSelection(editor.slide,editor.selected,1,editor.selectionScope),onselect:()=>editor.reorderSelection(1)},
  {label:'Send backward',icon:SendBackward,disabled:!canReorderSelection(editor.slide,editor.selected,-1,editor.selectionScope),onselect:()=>editor.reorderSelection(-1)},
  {label:'Bring to front',icon:BringToFront,disabled:!canReorderSelection(editor.slide,editor.selected,'front',editor.selectionScope),onselect:()=>editor.reorderSelection('front')},
  {label:'Send to back',icon:SendToBack,disabled:!canReorderSelection(editor.slide,editor.selected,'back',editor.selectionScope),onselect:()=>editor.reorderSelection('back')},
  ...(layout||canAddAutoLayout(editor.selected.length,editor.selectedContainer)?[{label:layout?single&&!grouped?'Member layout properties':'Auto layout properties':'Add auto layout',icon:layoutIcons[layout?.direction??'horizontal'],disabled:allLocked||blockedGroup,onselect:()=>{if(!layout)editor.autoLayout();onproperties();}}]:[]),
  ...(editor.selection.length>1?[{label:'Group selection',icon:Group,disabled:blockedGroup||editable.length<2,onselect:()=>editor.group()}]:[]),
  ...(editor.selectedContainer?[{label:'Ungroup selection',icon:Ungroup,disabled:allLocked||blockedGroup,onselect:()=>editor.group(true)}]:[]),
  ...(single?[{label:'Select overlapping objects',icon:Layers,divider:true,onselect:()=>editor.layerPickerId=first.id}]:[]),
  {label:editor.additiveSelection?'Finish multiple selection':'Select multiple objects',icon:SquareDashedMousePointer,onselect:()=>editor.additiveSelection=!editor.additiveSelection},
  {label:'Delete selection',icon:Trash2,tone:'danger',divider:true,disabled:allLocked||blockedGroup||!editor.selection.length,onselect:event=>void objectAction(()=>editor.remove(),event)},
]}><Ellipsis size={16}/></ActionMenu>
<AlignmentControls compact hiddenTrigger bind:this={alignment}/>
{/if}
<style>
  @media(max-width:380px){.compact-group-utility{display:none}}
  @media(max-width:760px),(pointer:coarse){.compact-block-utility{display:none}}
</style>
{#if editingBlock}<AsyncFeature feature="blocks" props={{targetGroupId:editingBlock,onclose:()=>editingBlock=''}} onclose={()=>editingBlock=''} modalTitle="Edit block"/>{/if}
