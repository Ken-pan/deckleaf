<script lang="ts">
  import type {Slide} from '../core/model';
  import {selectionBounds,type Bounds} from '../core/interactions';
  import {editor} from '../core/editor.svelte';
  import {canvasContainerRegions} from '../core/canvas-pointer';
  import {createContainerTree,groupBox} from '../core/container-tree';
  import {focusCanvasSelection} from '../editor-focus';
  let {mode,slide,selected,scale=1,frame=null,movement=null,onhover,onleave,onstart}:{mode:'hit'|'feedback';slide:Slide;selected:string[];scale?:number;frame?:Bounds|null;movement?:{ids:string[];dx:number;dy:number}|null;onhover?:(event:PointerEvent,id:string)=>void;onleave?:(id:string)=>void;onstart?:(event:PointerEvent,id:string)=>void}=$props();
  const tree=$derived(createContainerTree(slide));
  const regions=$derived(mode==='hit'?canvasContainerRegions(slide,editor.editingGroup,selected):[]);
  const frames=$derived.by(()=>{
    const ids=new Set(selected.filter(id=>id!==editor.selectedContainer&&tree.groupById.has(id)));
    if(editor.hovered&&tree.groupById.has(editor.hovered)&&editor.hovered!==editor.selectedContainer)ids.add(editor.hovered);
    if(editor.editingGroup&&editor.editingGroup!==editor.selectedContainer)ids.add(editor.editingGroup);
    return [...ids].flatMap(id=>{
      const plain=!tree.layouts.has(id),group=tree.groupById.get(id);
      const box=plain&&movement?selectionBounds(tree.descendants(id).filter(e=>!e.hidden).map(e=>movement!.ids.includes(e.id)?{...e,x:e.x+movement!.dx,y:e.y+movement!.dy}:e)):groupBox(slide,id);
      if(!box||!group||!tree.stats.get(id)?.visible)return[];
      const moving=movement&&tree.descendants(id).every(e=>e.hidden||movement!.ids.includes(e.id));
      return [{...box,x:box.x+(moving&&!plain?movement!.dx:0),y:box.y+(moving&&!plain?movement!.dy:0),id,name:tree.layouts.get(id)?.name??group.name}];
    });
  });
  function enter(id:string){editor.enterGroup(id);void focusCanvasSelection();}
</script>
{#if mode==='hit'}
  {#each regions as group(group.id)}
    <div class="canvas-container-hit" class:is-movable={!group.locked} style:left="{group.x}px" style:top="{group.y}px" style:width="{group.w}px" style:height="{group.h}px" data-container-id={group.id} role="button" tabindex="-1" aria-label={`Select group: ${group.name}`} aria-pressed={selected.includes(group.id)}
      onpointerenter={event=>onhover?.(event,group.id)} onpointermove={event=>onhover?.(event,group.id)} onpointerleave={()=>onleave?.(group.id)} onpointerdown={event=>onstart?.(event,group.id)}
      ondblclick={event=>{event.stopPropagation();enter(group.id);}} onkeydown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();enter(group.id);}}}></div>
  {/each}
{:else}
  {#each frames as box(box.id)}
    <div class="container-outline" class:scope-outline={box.id===editor.editingGroup&&!selected.includes(box.id)&&editor.hovered!==box.id} class:hover-outline={!selected.includes(box.id)&&box.id!==editor.editingGroup} style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px" style:border-width="{(selected.includes(box.id)?1.5:1)/scale}px" data-container-chrome={box.id}>
      {#if selected.includes(box.id)||editor.hovered===box.id}<button class="container-label" tabindex="-1" aria-label={`Select group: ${box.name}`} style:font-size="{12/scale}px" style:top="{selected.includes(box.id)?box.h+6/scale:-24/scale}px" style:max-width="{240/scale}px" style:padding="{2/scale}px {4/scale}px" onpointerenter={event=>onhover?.(event,box.id)} onpointerleave={()=>onleave?.(box.id)} onpointerdown={event=>onstart?.(event,box.id)} ondblclick={event=>{event.stopPropagation();enter(box.id);}}>{box.name}</button>{/if}
    </div>
  {/each}
  {#if editor.selectedContainer&&frame}<button class="container-label" tabindex="-1" aria-label="Enter selected group" title="Enter group · Double-click or Enter" style:left="{frame.x}px" style:top="{frame.y+frame.h+6/scale}px" style:font-size="{12/scale}px" style:max-width="{240/scale}px" style:padding="{2/scale}px {4/scale}px" onclick={()=>enter(editor.selectedContainer)}>{tree.layouts.get(editor.selectedContainer)?.name??tree.groupById.get(editor.selectedContainer)?.name}</button>{/if}
{/if}
<style>
  .canvas-container-hit{position:absolute;cursor:default;touch-action:none;outline:none}
  .canvas-container-hit.is-movable{cursor:grab}
  .container-outline{position:absolute;border:solid var(--canvas-selection);pointer-events:none}
  .scope-outline{border-style:dashed;opacity:.7}
  .hover-outline{border-color:color-mix(in srgb,var(--canvas-selection) 65%,transparent)}
  .container-label{position:absolute;left:0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--canvas-selection);font-family:var(--font-ui);border:0;background:var(--surface-overlay);border-radius:2px;pointer-events:auto;cursor:pointer}
</style>
