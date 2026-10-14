<script lang="ts">
  import {Table2,SlidersHorizontal} from '@lucide/svelte';
  import {Button} from './ui';
  import AsyncFeature from './AsyncFeature.svelte';
  import TableStyleChoices from './TableStyleChoices.svelte';
  import type {SlideElement} from '../core/model';
  import {editor} from '../core/editor.svelte';
  import {tableRowHeights} from '../core/table-fit';
  import {countLabel} from '../core/ui-copy';
  let {element}:{element:SlideElement}=$props();
  let open=$state(false),initialTab=$state<'data'|'style'>('data');
  const neededHeight=$derived(Math.ceil(tableRowHeights(element).reduce((a,b)=>a+b,0)));
  const rows=$derived(element.cells?.length??0),columns=$derived(Math.max(0,...(element.cells??[]).map(row=>row.length)));
</script>
<p class="data-summary">{countLabel(rows,'row')} · {countLabel(columns,'column')}</p>
<TableStyleChoices {element} system={editor.deck?.designSystem} dense onchoose={tableStyle=>{if(!element.locked&&JSON.stringify(tableStyle)!==JSON.stringify(element.tableStyle))editor.patch({tableStyle});}}/>
<div class="table-actions"><Button variant="secondary" onclick={()=>{initialTab='data';open=true;}}><Table2 size={16}/>Data</Button><Button variant="quiet" onclick={()=>{initialTab='style';open=true;}}><SlidersHorizontal size={16}/>Customize</Button></div>
<div class="table-fit">{#if neededHeight>element.h+1}<span>Content exceeds the table.</span><Button variant="quiet" disabled={!editor.deck||element.h>=editor.deck.height-element.y} onclick={()=>{if(editor.deck)editor.patch({h:Math.min(neededHeight,Math.max(1,editor.deck.height-element.y))});}}>Fit height</Button>{/if}</div>
<p class="data-tip">Drag dividers to resize rows or columns. Select cells to copy or paste.</p>
{#if open}<AsyncFeature feature="table" props={{elementId:element.id,initialTab,onclose:()=>open=false}} modalTitle="Edit table" onclose={()=>open=false}/>{/if}
<style>.table-fit{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:var(--ui-meta);color:var(--text-secondary)}.table-fit:empty{display:none}.data-summary,.data-tip{font-size:var(--ui-meta);color:var(--text-secondary);line-height:var(--ui-line-reading)}.table-actions{display:flex;flex-wrap:wrap;gap:8px}</style>
