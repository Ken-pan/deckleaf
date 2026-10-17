<script lang="ts">
  import {ArrowLeftRight} from '@lucide/svelte';
  import {LINE_ROUTES,LINE_DASHES,LINE_ENDS,DEFAULT_LINE,lineMarkup,type LineStyle} from '../core/lines';
  import NumberField from './ui/NumberField.svelte';
  import PropertyRow from './ui/PropertyRow.svelte';
  import {Button} from './ui';
  import LineIcon from './icons/LineIcon.svelte';
  let {value=DEFAULT_LINE,mixed=[],opacity,onopacitychange,onchange}:{value?:LineStyle;mixed?:(keyof LineStyle)[];opacity?:number;onopacitychange?:(value:number)=>void;onchange:(patch:Partial<LineStyle>)=>void}=$props();
  const patterns=LINE_DASHES.slice(0,3),routes=LINE_ROUTES.slice(0,4);
  const previewMixed=$derived(mixed.some(key=>['route','dash','start','end'].includes(key)));
</script>
<div class="line-controls">
  {#if !previewMixed}<svg class="line-preview" viewBox={value.route==='straight'?'-16 -28 272 56':'-16 -8 272 56'} role="img" aria-label="Line style preview">{@html lineMarkup({w:240,h:value.route==='straight'?1:40,strokeWidth:2,line:value},'currentColor')}</svg>{/if}
  <fieldset class="line-group">
    <legend>Endpoints</legend>
    <div class="endpoint-swap"><Button kind="icon" size="sm" aria-label="Swap endpoints" title="Swap endpoints" disabled={mixed.includes('start')||mixed.includes('end')} onclick={()=>onchange({start:value.end,end:value.start})}><ArrowLeftRight size={16}/></Button></div>
    <div class="line-endpoints">
      {#each ['start','end'] as key}
        {@const field=key as 'start'|'end'}
        <label class="field-label"><span class="endpoint-label">{key==='start'?'Start':'End'}{#if !mixed.includes(field)}<LineIcon style={{...DEFAULT_LINE,[field]:value[field]}} size={20} width={36} layout="horizontal"/>{/if}</span><select class="ui-property-input" aria-label={`Line ${key}`} value={mixed.includes(field)?'':value[field]} onchange={e=>onchange({[field]:e.currentTarget.value})}>{#if mixed.includes(field)}<option value="" disabled>Mixed</option>{/if}{#each LINE_ENDS as item}<option value={item.value}>{item.label}</option>{/each}</select></label>
      {/each}
    </div>
    <details><summary>Endpoint size</summary><div class="extra-options"><NumberField label="Endpoint size" prefix="Size" unit="×" min={1} max={6} step="any" keyboardStep={.25} value={value.markerSize} mixed={mixed.includes('markerSize')} onchange={markerSize=>onchange({markerSize})}/></div></details>
  </fieldset>
  <fieldset class="line-group">
    <legend>Stroke</legend>
    <div class="line-choices patterns" role="group" aria-label="Stroke pattern">
      {#each patterns as item}
        <button type="button" aria-label={item.label} aria-pressed={!mixed.includes('dash')&&value.dash===item.value} onclick={()=>onchange({dash:item.value})}><LineIcon style={{...DEFAULT_LINE,dash:item.value,cap:value.cap}} size={24} width={40} layout="horizontal"/><span>{item.label}</span></button>
      {/each}
    </div>
    <details open={!mixed.includes('dash')&&!patterns.some(item=>item.value===value.dash)}><summary>More stroke options</summary><div class="extra-options">
      <PropertyRow label="Pattern"><select class="ui-property-input" aria-label="Line pattern" value={mixed.includes('dash')?'':value.dash} onchange={e=>onchange({dash:e.currentTarget.value as LineStyle['dash']})}>{#if mixed.includes('dash')}<option value="" disabled>Mixed</option>{/if}{#each LINE_DASHES as item}<option value={item.value}>{item.label}</option>{/each}</select></PropertyRow>
      <PropertyRow label="Caps"><select class="ui-property-input" aria-label="Line caps" value={mixed.includes('cap')?'':value.cap} onchange={e=>onchange({cap:e.currentTarget.value as LineStyle['cap']})}>{#if mixed.includes('cap')}<option value="" disabled>Mixed</option>{/if}<option value="butt">Flat</option><option value="round">Round</option><option value="square">Square</option></select></PropertyRow>
      {#if opacity!==undefined&&onopacitychange}<NumberField label="Line opacity" prefix="Opacity" unit="%" min={0} max={100} step="any" value={Math.round(opacity*100)} onchange={value=>onopacitychange?.(value/100)}/>{/if}
    </div></details>
  </fieldset>
  <fieldset class="line-group">
    <legend>Path</legend>
    <div class="line-choices routes" role="group" aria-label="Path shape">
      {#each routes as item}
        <button type="button" aria-label={item.label} aria-pressed={!mixed.includes('route')&&value.route===item.value} onclick={()=>onchange({route:item.value})}><LineIcon style={{...DEFAULT_LINE,route:item.value}} size={24}/><span>{item.value==='rounded'?'Round':item.label}</span></button>
      {/each}
    </div>
    <details open={!mixed.includes('route')&&!routes.some(item=>item.value===value.route)}><summary>More path options</summary><div class="extra-options">
      <PropertyRow label="Path"><select class="ui-property-input" aria-label="Line path" value={mixed.includes('route')?'':value.route} onchange={e=>onchange({route:e.currentTarget.value as LineStyle['route']})}>{#if mixed.includes('route')}<option value="" disabled>Mixed</option>{/if}{#each LINE_ROUTES as item}<option value={item.value}>{item.label}</option>{/each}</select></PropertyRow>
      {#if !['straight','zigzag','wave'].includes(value.route)}<NumberField label="Line bend" prefix="Bend" unit="%" min={10} max={90} step="any" value={Math.round(value.bend*100)} mixed={mixed.includes('bend')} onchange={bend=>onchange({bend:bend/100})}/>{/if}
    </div></details>
  </fieldset>
</div>
<style>
  .line-controls {display:grid;gap:12px;min-width:0;}
  .line-preview {width:100%;height:48px;color:var(--text-primary);background:var(--surface-sunken);border-radius:var(--r-control);}
  .line-group {position:relative;display:grid;gap:8px;min-width:0;margin:0;padding:8px 0 0;border:0;border-top:1px solid var(--border-subtle);}
  .line-group legend {padding:0 8px 0 0;color:var(--text-primary);font-size:var(--ui-label);font-weight:500;}
  .endpoint-swap {position:absolute;right:0;top:-24px;padding-left:4px;}
  .line-endpoints {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
  .line-endpoints .field-label {display:grid;gap:4px;margin:0;}
  .endpoint-label {display:flex;align-items:center;justify-content:space-between;min-height:20px;}
  .line-endpoints select {width:100%;min-width:0;}
  .line-choices {display:grid;gap:4px;}
  .patterns {grid-template-columns:repeat(3,minmax(0,1fr));}
  .routes {grid-template-columns:repeat(4,minmax(0,1fr));}
  .line-choices button {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:60px;padding:6px 2px;border:0;border-radius:var(--r-control);background:transparent;color:var(--text-primary);cursor:pointer;}
  .line-choices button[aria-pressed="true"] {background:var(--state-selected);}
  .line-choices :global(svg) {display:block;flex:none;}
  .line-choices span {font-size:var(--ui-meta);line-height:1.4;overflow-wrap:anywhere;}
  summary {cursor:pointer;font-size:var(--ui-meta);color:var(--text-secondary);padding:4px 0;}
  .extra-options {display:grid;gap:12px;padding-top:8px;}
  @media(hover:hover){.line-choices button:hover{background:var(--state-hover);}.line-choices button[aria-pressed="true"]:hover{background:var(--state-selected);}}
  @media(pointer:coarse),(max-width:760px){select {min-height:44px;}summary {min-height:44px;display:flex;align-items:center;gap:4px;}summary::before{content:'▸';}details[open]>summary::before{content:'▾';}.endpoint-swap{top:-30px;}.endpoint-swap :global(button){min-height:44px;min-width:44px;}}
</style>
