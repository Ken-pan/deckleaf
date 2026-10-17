<script lang="ts">
  import {ChevronDown} from '@lucide/svelte';
  import type {SlideElement} from '../core/model';
  import {editor} from '../core/editor.svelte';
  import {DEFAULT_LINE,type LineStyle} from '../core/lines';
  import {COLOR_ROLES,type ColorRole} from '../core/design-system-schema';
  import {deckDesignSystem,COLOR_LABELS} from '../core/deck-design-system';
  import {objectColorStyleOperations} from '../core/object-style-operations';
  import {PopoverPanel} from './ui';
  import ColorSwatch from './ui/ColorSwatch.svelte';
  import NumberField from './ui/NumberField.svelte';
  import LineIcon from './icons/LineIcon.svelte';
  import LineControls from './LineControls.svelte';
  let {element:e}:{element:SlideElement}=$props();
  const style=$derived(e.line??DEFAULT_LINE);
  const color=$derived(e.stroke==='transparent'?e.fill:e.stroke);
  const system=$derived(deckDesignSystem(editor.deck??{}));
  const roles=$derived(COLOR_ROLES.map(value=>({value,label:COLOR_LABELS[value],color:system.colors[value]})));
  let widthPanel=$state<PopoverPanel>();
  let typeAnchor=$state<HTMLDivElement>(),widthAnchor=$state<HTMLDivElement>();
  const focused=(anchor?:HTMLDivElement)=>anchor?.querySelector<HTMLButtonElement>('.ui-panel-trigger > button')??undefined;
  function patchLine(patch:Partial<LineStyle>){editor.patch({line:{...style,...patch}});}
  function linkColor(role:ColorRole){if(editor.slide)editor.commit(objectColorStyleOperations(editor.operationDocument(),editor.slide.id,[e.id],'stroke',role));}
  function thickness(width:number){editor.patch({strokeWidth:width},'line-width');}
</script>
<div class="line-selection-tools" role="group" aria-label="Line formatting">
  <div class="line-type-tool" bind:this={typeAnchor}>
    <PopoverPanel title="Line settings" iconOnly width={320} height={640} minHeight={180} autoHeight viewportOnly returnFocus={()=>focused(typeAnchor)}>
      {#snippet trigger()}<LineIcon {style}/><ChevronDown class="tool-chevron" size={12}/>{/snippet}
      <LineControls value={style} onchange={patchLine} opacity={e.opacity} onopacitychange={opacity=>editor.patch({opacity},'line-opacity')}/>
    </PopoverPanel>
  </div>
  <span class="tool-divider" aria-hidden="true"></span>
  <div class="line-color-tool"><ColorSwatch label="Line color" value={color} {roles} roleValue={e.design?.stroke} onrole={role=>linkColor(role as ColorRole)} oninput={stroke=>editor.patch({stroke},'line-color')} onchange={stroke=>editor.patch({stroke},'line-color')}/></div>
  <div class="line-width-tool" bind:this={widthAnchor}>
    <PopoverPanel bind:this={widthPanel} title="Line width" iconOnly width={240} height={280} minHeight={160} autoHeight viewportOnly returnFocus={()=>focused(widthAnchor)}>
      {#snippet trigger()}<span class="width-value">{Number((e.strokeWidth||2).toFixed(1))}<span class="unit">px</span></span><ChevronDown class="tool-chevron" size={12}/>{/snippet}
      <div class="width-options">
        <div class="width-presets" role="group" aria-label="Line width presets">{#each [1,2,3,4,6,8,12,16] as width}<button type="button" aria-label={`${width} px`} aria-pressed={e.strokeWidth===width} onclick={()=>{thickness(width);widthPanel?.close();}}><svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true"><path d="M3 8H21" stroke="currentColor" stroke-width={Math.min(width,8)} stroke-linecap="round"/></svg><span>{width}</span></button>{/each}</div>
        <NumberField label="Line width" prefix="Width" unit="px" min={1} max={100} step="any" value={e.strokeWidth||2} onchange={thickness}/>
      </div>
    </PopoverPanel>
  </div>
</div>
<style>
  .line-selection-tools {display:flex;align-items:center;gap:2px;min-width:0;}
  .line-selection-tools > div {flex:none;}
  .tool-divider {width:1px;height:16px;margin:0 4px;background:var(--border-subtle);flex:none;}
  .line-selection-tools :global(.ui-panel-trigger > button) {display:flex;align-items:center;justify-content:center;flex-direction:row;height:36px;min-height:36px;padding:0 8px;gap:6px;width:auto;}
  .line-selection-tools :global(.ui-panel-trigger > button > .tool-chevron) {width:12px;height:12px;color:var(--text-secondary);}
  .line-type-tool :global(.ui-panel-trigger > button){min-width:44px;}
  .line-color-tool :global(.color-picker) {display:grid;place-items:center;width:32px;height:36px;min-height:36px;padding:6px;}
  .line-color-tool :global(.color-preview) {width:18px;height:18px;min-width:18px;border-radius:4px;}
  .width-value {display:flex;align-items:baseline;gap:4px;font-variant-numeric:tabular-nums;white-space:nowrap;}
  .unit {font-size:var(--ui-meta);color:var(--text-secondary);}
  .width-options {display:grid;gap:12px;}
  .width-presets {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;}
  .width-presets button {display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;min-height:52px;border:0;border-radius:var(--r-control);background:transparent;color:var(--text-primary);font-size:var(--ui-meta);}
  .width-presets button[aria-pressed="true"] {background:var(--state-selected);}
  .width-presets button:hover {background:var(--state-hover);}
  @media(max-width:760px),(pointer:coarse){
    .line-selection-tools :global(.ui-panel-trigger > button){height:44px;min-height:44px;padding-inline:6px;}
    .line-color-tool :global(.color-picker){width:40px;height:44px;min-height:44px;}
    .tool-divider {margin-inline:2px;}
  }
</style>
