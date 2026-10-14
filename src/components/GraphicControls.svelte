<script lang="ts">
  import type {GraphicRecipe} from '../core/graphic-recipe';
  import {DEFAULT_GRAPHIC_RECIPE} from '../../public/resources/graphic-engine.js';
  let {value, repeatable, disabled = false, onchange}: {value:GraphicRecipe; repeatable:boolean; disabled?:boolean; onchange:(value:GraphicRecipe)=>void} = $props();
  const fields = [{key:'strength',label:'Strength',min:25,max:200,step:5,unit:'%',factor:100},{key:'scale',label:'Pattern size',min:50,max:300,step:5,unit:'%',factor:100},{key:'rotation',label:'Angle',min:0,max:180,step:1,unit:'°',factor:1}] as const;
  function update(key: keyof GraphicRecipe, raw: string, factor:number, min:number, max:number) {
    const number = Number(raw); if (!raw || !Number.isFinite(number)) return;
    onchange({...value,[key]:Math.min(max,Math.max(min,number))/factor});
  }
</script>
<div class="graphic-controls" aria-label="Graphic settings">
  <div class="control-head"><strong>Customize</strong><button class="text-btn" disabled={disabled || (value.strength===1 && value.scale===1 && value.rotation===0)} onclick={() => onchange({...DEFAULT_GRAPHIC_RECIPE})}>Reset</button></div>
  <div class="strength-presets" role="group" aria-label="Strength presets">{#each [{label:'Light',value:.6},{label:'Standard',value:1},{label:'Bold',value:1.6}] as preset}<button class="text-btn" aria-pressed={value.strength===preset.value} {disabled} onclick={() => onchange({...value,strength:preset.value})}>{preset.label}</button>{/each}</div>
  {#each fields.filter(field => repeatable || field.key==='strength') as field}
    <label class="graphic-control"><span>{field.label}</span><div class="control-inputs"><input type="range" aria-label={`Graphic ${field.label.toLowerCase()}`} aria-valuetext={`${Math.round(value[field.key]*field.factor)}${field.unit}`} min={field.min} max={field.max} step={field.step} value={value[field.key]*field.factor} {disabled} oninput={event=>update(field.key,event.currentTarget.value,field.factor,field.min,field.max)} /><div class="number-unit"><input type="number" aria-label={`${field.label} value`} min={field.min} max={field.max} step={field.step} value={Math.round(value[field.key]*field.factor)} {disabled} onchange={event=>{if(!event.currentTarget.value)event.currentTarget.value=String(Math.round(value[field.key]*field.factor));else update(field.key,event.currentTarget.value,field.factor,field.min,field.max);}} /><span>{field.unit}</span></div></div></label>
  {/each}
  {#if repeatable}<p>Size changes the repeat. The slide stays fully covered.</p>{/if}
</div>
<style>
  .graphic-controls{margin:8px 0 16px;display:grid;gap:8px;min-width:0}
  .control-head{display:flex;align-items:center;justify-content:space-between}.control-head strong{font-weight:550}
  .strength-presets{display:flex;gap:6px;flex-wrap:wrap}.strength-presets [aria-pressed=true]{background:var(--state-selected);color:var(--text-link)}
  .graphic-control{display:grid;gap:4px;min-width:0}.graphic-control>span{font-size:var(--ui-meta);color:var(--text-secondary)}
  .control-inputs{display:flex;gap:12px;align-items:center;min-width:0}.control-inputs>input{min-width:0;width:100%;accent-color:var(--text-link);height:28px}
  .number-unit{display:flex;gap:4px;align-items:center;flex:none;font-size:var(--ui-meta);color:var(--text-secondary)}.number-unit input{width:64px;height:32px;padding:4px 6px;border:1px solid var(--border-default);border-radius:var(--r-field);background:var(--fill-subtle);color:var(--text-primary);font:inherit}
  p{font-size:var(--ui-meta);line-height:1.4;color:var(--text-secondary);margin:2px 0}
  @media(pointer:coarse){.strength-presets button,.number-unit input,.control-inputs>input{min-height:44px}}
</style>
