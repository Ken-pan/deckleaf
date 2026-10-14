<script lang="ts">
  import {DEFAULT_SHADOW, shadowColorPatch, type ElementShadow} from '../core/shape-schema';
  import {uiDisclosure} from '../ui-motion';
  import NumberField from './ui/NumberField.svelte';
  import ColorField from './ui/ColorField.svelte';
  import {ChevronDown} from '@lucide/svelte';
  let {value, mixed=false, mixedFields={}, disabled=false, onchange, onpatch}: {value?:ElementShadow; mixed?:boolean; mixedFields?:Partial<Record<keyof ElementShadow,boolean>>; disabled?:boolean; onchange:(value:ElementShadow|undefined)=>void;onpatch?:(patch:Partial<ElementShadow>)=>void}=$props();
  const current=$derived(value??DEFAULT_SHADOW);
  function patch(next:Partial<ElementShadow>){if(onpatch)onpatch(next);else onchange({...current,...next});}
</script>
<fieldset class="shape-effects" aria-label="Shape shadow" {disabled}>
  <label class="shadow-toggle"><input type="checkbox" aria-label="Shadow" checked={Boolean(value)} indeterminate={mixed} {disabled} onchange={event=>onchange(event.currentTarget.checked?{...current}:undefined)}/><span>Shadow</span></label>
  {#if value || mixed}<details use:uiDisclosure>
    <summary><span>Shadow settings</span><ChevronDown size={14} aria-hidden="true"/></summary>
    <div class="shadow-settings">
      <div class="color-row"><span>Color</span><ColorField label="Shadow color" value={current.color} mixed={mixedFields.color??mixed} allowClear={false} onchange={color=>patch(shadowColorPatch(color))}/></div>
      <div class="property-grid">
        <div class="shadow-number-setting"><span aria-hidden="true">Opacity</span><NumberField label="Shadow opacity" prefix="" value={Math.round(current.opacity*100)} mixed={mixedFields.opacity??mixed} {disabled} unit="%" min={0} max={100} onchange={opacity=>patch({opacity:opacity/100})}/></div>
        <div class="shadow-number-setting"><span aria-hidden="true">Blur</span><NumberField label="Shadow blur" prefix="" value={current.blur} mixed={mixedFields.blur??mixed} {disabled} unit="px" min={0} max={200} onchange={blur=>patch({blur})}/></div>
        <NumberField label="Shadow X offset" prefix="X" value={current.x} mixed={mixedFields.x??mixed} {disabled} unit="px" min={-500} max={500} onchange={x=>patch({x})}/>
        <NumberField label="Shadow Y offset" prefix="Y" value={current.y} mixed={mixedFields.y??mixed} {disabled} unit="px" min={-500} max={500} onchange={y=>patch({y})}/>
      </div>
    </div>
  </details>{/if}
</fieldset>
<style>
  .shape-effects,.shadow-settings{display:flex;flex-direction:column;gap:8px;min-width:0}
  .shape-effects{border:0;border-top:1px solid var(--border-subtle);margin:0;padding:8px 0 0}
  .property-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,6.5rem),1fr));gap:8px;min-width:0}
  .shadow-number-setting{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:var(--ui-label);color:var(--text-secondary)}
  .color-row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px;align-items:center;font-size:var(--ui-label);color:var(--text-secondary)}
  .shadow-toggle{display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer;font-size:var(--ui-label)}
  .shadow-toggle input{width:auto;min-height:0;margin:0}
  summary{display:flex;align-items:center;gap:8px;min-height:32px;list-style:none;cursor:pointer;font-size:var(--ui-label);color:var(--text-secondary);border-radius:var(--r-sm)}
  summary::-webkit-details-marker{display:none}summary span{flex:1;min-width:0}summary :global(svg){flex:none}details[open]>summary :global(svg){rotate:180deg}summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}.shadow-settings{padding-top:8px}
  @media(max-width:760px),(pointer:coarse){.shadow-toggle,summary{min-height:44px}.color-row{grid-template-columns:32px minmax(0,1fr)}}
  @container(max-width:13rem){.color-row{grid-template-columns:1fr;gap:4px}}
</style>
