<script lang="ts">
  import {editor} from '../core/editor.svelte';
  import {slideGroups,ancestorIds} from '../core/container-tree';
  import {focusCanvasSelection} from '../editor-focus';
  import {ChevronRight} from '@lucide/svelte';
  import {Check} from '@lucide/svelte';
  import {tick} from 'svelte';
  let pathElement=$state<HTMLDivElement>();
  let group=$derived(editor.slide&&slideGroups(editor.slide).find(g=>g.id===editor.editingGroup));
  let path=$derived(group&&editor.slide?[...ancestorIds(editor.slide,group.id)].reverse().map(id=>slideGroups(editor.slide!).find(g=>g.id===id)!).filter(Boolean):[]);
  $effect(()=>{group?.id;void tick().then(()=>{if(pathElement)pathElement.scrollLeft=pathElement.scrollWidth;});});
  function leave(all=false){editor.exitGroup(all);void focusCanvasSelection();}
  function enter(id:string){editor.enterGroup(id);void focusCanvasSelection();}
</script>
{#if group}<nav class="group-edit-bar" aria-label="Group editing path">
  <button onclick={()=>leave(true)} aria-label="Exit all groups">Slide</button><ChevronRight size={12}/><div class="group-path" bind:this={pathElement}>
  {#each path as ancestor(ancestor.id)}<button onclick={()=>enter(ancestor.id)} title={ancestor.name} aria-label={`Edit group: ${ancestor.name}`}>{ancestor.name}</button><ChevronRight size={12}/>{/each}
  <span title={group.name} aria-current="location">{group.name}</span></div>
  <button class="exit-group" aria-label="Done editing group" title="Done editing group · Esc" onclick={()=>leave()}><Check size={14}/><span>Done</span></button>
</nav>{/if}
<style>
  .group-edit-bar{position:absolute;top:12px;left:12px;z-index:45;display:flex;align-items:center;max-width:calc(100% - 24px);padding:0 4px;border:1px solid var(--border-default);border-radius:var(--r-control);background:var(--surface-overlay);font-size:var(--ui-meta)}
  .group-path{min-width:0;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:thin}
  button{background:none;border:0;min-height:44px;min-width:44px;max-width:112px;padding:0 8px;font:inherit;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
  .group-path>span{min-width:40px;max-width:112px;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--text-secondary);flex:none}
  .group-path :global(svg){flex:none;color:var(--text-tertiary)}
  .group-edit-bar> :global(svg){flex:none;color:var(--text-tertiary)}
  .exit-group{display:flex;align-items:center;gap:6px;flex:none;border-left:1px solid var(--border-subtle);margin-left:4px}
  @media(max-width:760px){.group-edit-bar{z-index:35}}
</style>
