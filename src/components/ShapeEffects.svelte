<script lang="ts">
  import {DEFAULT_SHADOW, shadowColorPatch, type ElementShadow} from '../core/shape-schema';
  import NumberField from './ui/NumberField.svelte';
  import ColorField from './ui/ColorField.svelte';
  import PropertyRow from './ui/PropertyRow.svelte';
  let {value, mixed=false, mixedFields={}, disabled=false, onchange, onpatch}: {value?:ElementShadow; mixed?:boolean; mixedFields?:Partial<Record<keyof ElementShadow,boolean>>; disabled?:boolean; onchange:(value:ElementShadow|undefined)=>void;onpatch?:(patch:Partial<ElementShadow>)=>void}=$props();
  const current=$derived(value??DEFAULT_SHADOW);
  function patch(next:Partial<ElementShadow>){if(onpatch)onpatch(next);else onchange({...current,...next});}
</script>
<fieldset class="shape-effects" aria-label="Shape shadow" {disabled}>
  <label class="ui-property-check"><input type="checkbox" aria-label="Shadow" checked={Boolean(value)} indeterminate={mixed} {disabled} onchange={event=>onchange(event.currentTarget.checked?{...current}:undefined)}/><span>Shadow</span></label>
  {#if value || mixed}
    <div class="shadow-settings">
      <PropertyRow label="Color"><ColorField label="Shadow color" value={current.color} mixed={mixedFields.color??mixed} allowClear={false} onchange={color=>patch(shadowColorPatch(color))}/></PropertyRow>
      <NumberField label="Shadow opacity" preset="percent" prefix="Opacity" value={Math.round(current.opacity*100)} mixed={mixedFields.opacity??mixed} {disabled} unit="%" min={0} max={100} onchange={opacity=>patch({opacity:opacity/100})}/>
      <NumberField label="Shadow blur" preset="spacing" prefix="Blur" value={current.blur} mixed={mixedFields.blur??mixed} {disabled} unit="px" min={0} max={200} onchange={blur=>patch({blur})}/>
      <div class="property-grid">
        <NumberField label="Shadow X offset" preset="offset" prefix="X" value={current.x} mixed={mixedFields.x??mixed} {disabled} unit="px" min={-500} max={500} onchange={x=>patch({x})}/>
        <NumberField label="Shadow Y offset" preset="offset" prefix="Y" value={current.y} mixed={mixedFields.y??mixed} {disabled} unit="px" min={-500} max={500} onchange={y=>patch({y})}/>
      </div>
    </div>
  {/if}
</fieldset>
<style>
  .shape-effects,.shadow-settings{display:flex;flex-direction:column;gap:8px;min-width:0}
  .shape-effects{border:0;border-top:1px solid var(--border-subtle);margin:0;padding:8px 0 0}
  .property-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,6.5rem),1fr));gap:8px;min-width:0}
</style>
