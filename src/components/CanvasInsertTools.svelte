<script lang="ts">
  import {pasteFromClipboard} from '../editor-clipboard';
  import { MousePointer2, Type, Square, Table2, ChartColumn, AppWindow, Plus, Star, PanelsTopBottom, LayoutTemplate } from '@lucide/svelte';
  import { resourceIcons, shapeToolIcons } from './icons';
  import {SHAPE_TOOLS, SHAPE_LABELS, isShapeTool} from '../core/shapes';
  import { ActionMenu } from './ui';
  import { type InsertTool, type PrimitiveInsertTool } from '../core/insertion';
  import type { ResourceQuickView } from './resource-library-view';
  let {insertTool, resourceOpen, resourceActiveView, resourceBusy = false, disabled = false, onselect, oninsert, onresource, onchart, onprototype, onpageelements, onblocks}: {
    insertTool: InsertTool | null; resourceOpen: boolean; resourceActiveView?: ResourceQuickView; resourceBusy?: boolean; disabled?: boolean;
    onselect: () => void; oninsert: (tool: PrimitiveInsertTool) => void; onresource: (view: ResourceQuickView, anchor: HTMLButtonElement) => void;
    onchart: () => void; onprototype: () => void; onpageelements: () => void; onblocks: () => void;
  } = $props();
  let moreGroup = $state<HTMLDivElement>();
  const ShapeIcon = $derived(isShapeTool(insertTool) ? shapeToolIcons[insertTool] : Square);
  function openGraphics() { const anchor = moreGroup?.querySelector<HTMLButtonElement>('button'); if (anchor) onresource('graphics', anchor); }
  const resourceTools = [
    {id: 'photo', label: 'Photos', title: 'Photos', icon: resourceIcons.photo},
    {id: 'icon', label: 'Icons', title: 'Icons', icon: resourceIcons.icon},
    {id: 'illustration', label: 'Art', title: 'Illustrations', icon: resourceIcons.illustration},
  ] as const;
</script>
      <div class="toolbar-group insert-tools" aria-label="Insert tools">
        <div class="insert-primary" role="group" aria-label="Canvas tools">
        <button class="text-btn dock-select" aria-label="Select" title="Select · Esc" aria-pressed={!insertTool && !resourceOpen} onclick={onselect}><MousePointer2 /><span class="dock-label">Select</span></button>
        <button class="text-btn text-entry" class:active={insertTool === 'text'} aria-pressed={insertTool === 'text'} {disabled} onclick={() => oninsert('text')} title="Place text · T" aria-label="Insert text"><Type /><span class="dock-label">Text</span></button>
        <ActionMenu label="Insert shapes" active={isShapeTool(insertTool)} {disabled} items={SHAPE_TOOLS.map(tool=>({label:SHAPE_LABELS[tool],icon:shapeToolIcons[tool],shortcut:tool==='rect'?'R':undefined,divider:tool==='line',onselect:()=>oninsert(tool)}))}><ShapeIcon size={16} /><span class="dock-label">Shapes</span></ActionMenu>
        <button class="text-btn table-entry" class:active={insertTool === 'table'} aria-pressed={insertTool === 'table'} {disabled} onclick={() => oninsert('table')} title="Insert table" aria-label="Insert table"><Table2 size={16}/><span class="dock-label">Table</span></button>
        </div>
        <div class="resource-tools" role="group" aria-label="Resource categories">
        <button class="text-btn resource-entry" class:active={insertTool==='block'} {disabled} onclick={onblocks} title="Blocks · Diagrams, plans and business content" aria-label="Blocks" aria-haspopup="dialog"><LayoutTemplate size={16}/><span class="dock-label">Blocks</span></button>
        {#each resourceTools as tool}
          <button class="text-btn resource-entry" data-resource-view={tool.id} class:active={resourceOpen && resourceActiveView === tool.id} disabled={disabled || resourceBusy} title={tool.title} aria-label={tool.label === tool.title ? `${tool.title} resources` : `${tool.label} · ${tool.title} resources`} aria-haspopup="dialog" aria-controls="workspace-resource-popover" aria-expanded={resourceOpen && resourceActiveView === tool.id} popovertarget="workspace-resource-popover" popovertargetaction="show" onclick={event => { event.preventDefault(); void onresource(tool.id, event.currentTarget); }} onkeydown={event => { if (!event.isComposing && event.keyCode !== 229 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowDown') { event.preventDefault(); if (!resourceOpen || resourceActiveView !== tool.id) void onresource(tool.id, event.currentTarget); } }}><tool.icon size={16} /><span class="dock-label">{tool.label}</span></button>
        {/each}
        </div>
        <div class="insert-secondary" bind:this={moreGroup}>
        <ActionMenu label="More insert tools" active={insertTool === 'chart' || resourceOpen && ['graphics','favorites'].includes(resourceActiveView??'')} {disabled} items={[
          {label:'Paste',shortcut:'⌘V',onselect:()=>{onselect();return pasteFromClipboard();}},
          {label:'Paste as text',onselect:()=>{onselect();return pasteFromClipboard({textOnly:true});}},
          {label: 'Saved resources', icon: Star, disabled: resourceBusy, onselect: () => { const anchor=moreGroup?.querySelector<HTMLButtonElement>('button'); if(anchor)onresource('favorites',anchor); }},
          {label: 'Patterns & textures', icon: resourceIcons.graphics, disabled: resourceBusy, onselect: openGraphics},
          {label: 'Chart', icon: ChartColumn, onselect: onchart},
          {label: 'Slide details', icon: PanelsTopBottom, divider: true, onselect: onpageelements},
          {label: 'Interactive prototype', icon: AppWindow, divider: true, onselect: onprototype},
          
        ]}><Plus size={16} /><span class="dock-label">More</span></ActionMenu>
        </div>
      </div>
<style>
  .insert-primary, .resource-tools { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .resource-tools { border-left: 1px solid var(--border-subtle); padding-left: 8px; margin-left: 4px; }
  .insert-primary > button, .resource-tools > button { width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0; justify-content: center; }
  .resource-entry[aria-expanded='true'] { background: var(--state-selected); color: var(--text-link); }
  @media (max-width: 760px), (pointer: coarse) {
    :global(.canvas-insert-dock) .insert-tools { display: grid; grid-template-columns: repeat(5,minmax(44px,1fr)); gap: 4px; }
    .insert-primary { grid-column: 1 / 5; grid-row: 1; justify-content: center; }
    .insert-secondary { grid-column: 5; grid-row: 1; }
    .resource-tools { grid-column: 1 / -1; grid-row: 2; justify-content: space-between; border-left: 0; border-top: 1px solid var(--border-subtle); padding: 4px 0 0; margin: 0; }
    .insert-primary > button, .resource-tools > button { width: auto; min-width: 44px; height: auto; min-height: 52px; padding: 4px 6px; flex-direction: column; gap: 4px; }
    .resource-tools > button { font-size: var(--ui-meta); }
  }
</style>
