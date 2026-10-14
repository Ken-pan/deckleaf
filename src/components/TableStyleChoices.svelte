<script lang="ts">
  import {tablePresets,tablePresetStyle,tablePresentation,tablePresetMatches} from '../core/table-appearance';
  import type {SlideElement} from '../core/model';
  import type {DesignSystem} from '../core/design-system-schema';
  import type {TableStyle} from '../core/table-schema';
  let {element,system,dense=false,onchoose}:{element:SlideElement;system?:DesignSystem;dense?:boolean;onchoose:(style:TableStyle)=>void}=$props();
</script>
<div class="table-presets" class:dense role="group" aria-label="Table style presets">
  {#each tablePresets as preset}{@const p=tablePresentation({...element,tableStyle:tablePresetStyle(preset.id)},system)}
    <button type="button" aria-pressed={tablePresetMatches(element.tableStyle,preset.id)} title={preset.hint} onclick={()=>onchoose({...tablePresetStyle(preset.id),columnWidths:element.tableStyle?.columnWidths,columnAlign:element.tableStyle?.columnAlign})}>
      <svg viewBox="0 0 120 64" aria-hidden="true"><rect x="1" y="1" width="118" height="62" fill={p.background}/><rect x="1" y="1" width="118" height="20" fill={p.header}/>{#if p.banded}<rect x="1" y="42" width="118" height="21" fill={p.stripe}/>{/if}
        {#each [0,1,2] as row}{#each [0,1,2] as col}<rect x={9+col*38} y={9+row*21} width={col===0?22:16} height="3" rx="1.5" fill={row===0?p.headerText:p.text}/>{/each}{/each}
        {#each [21,42,63] as y}<path d={`M1 ${y} H119`} stroke={p.line} stroke-width=".7"/>{/each}{#if p.borders==='grid'}{#each [1,40,80,119] as x}<path d={`M${x} 1 V63`} stroke={p.line} stroke-width=".7"/>{/each}<path d="M1 1 H119" stroke={p.line} stroke-width=".7"/>{/if}
      </svg><span>{preset.label}</span>
    </button>
  {/each}
</div>
<style>
  .table-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.table-presets button{display:flex;flex-direction:column;gap:8px;text-align:left;padding:12px;background:var(--field-surface);border:1px solid var(--border-subtle);border-radius:var(--r-control);color:var(--text-secondary);font-size:var(--ui-label)}.table-presets svg{width:100%;height:60px}.table-presets button[aria-pressed='true']{border-color:var(--accent-line);background:var(--state-selected);color:var(--text-link)}.dense button{padding:8px;gap:4px}.dense svg{height:32px}
  @media(max-width:760px),(pointer:coarse){.table-presets button{min-height:44px}}
</style>
