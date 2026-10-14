<script lang="ts">
  import type {SlideElement} from '../core/model';
  import {chartFromElement,chartTypes,validateChart} from '../core/charts';
  import {countLabel} from '../core/ui-copy';
  import {editor} from '../core/editor.svelte';
  import AsyncFeature from './AsyncFeature.svelte';
  import ChartStyleChoices from './ChartStyleChoices.svelte';
  import {Button} from './ui';
  import {ChartColumn,SlidersHorizontal} from '@lucide/svelte';
  let {element}:{element:SlideElement}=$props();
  let open=$state(false),initialTab=$state<'data'|'style'>('data');
  const chart=$derived.by(()=>{try{return chartFromElement(element);}catch{return undefined;}});
  function patch(value:Partial<NonNullable<typeof chart>>){if(chart&&!element.locked){const next=validateChart({...chart,...value});if(JSON.stringify(next)!==JSON.stringify(chart))editor.patch({chart:next,values:undefined});}}
</script>
<p class="chart-summary">{chartTypes.find(t=>t.id===chart?.type)?.label??'Chart'} · {countLabel(chart?.labels.length??0,'category','categories')} · {countLabel(chart?.series.length??0,'series','series')}</p>
{#if chart}<ChartStyleChoices {chart} dense onchoose={patch}/><div class="chart-quick"><label><input type="checkbox" checked={chart.showValues} onchange={event=>patch({showValues:event.currentTarget.checked})}/>Values</label><label><input type="checkbox" checked={chart.legend} onchange={event=>patch({legend:event.currentTarget.checked})}/>Legend</label></div>{/if}
<div class="chart-actions"><Button variant="secondary" onclick={()=>{initialTab='data';open=true;}}><ChartColumn size={16}/>Data</Button><Button variant="quiet" onclick={()=>{initialTab='style';open=true;}}><SlidersHorizontal size={16}/>Customize</Button></div>
{#if open}<AsyncFeature feature="chart" props={{elementId:element.id,initialTab,onclose:()=>open=false}} modalTitle="Edit chart" onclose={()=>open=false}/>{/if}
<style>.chart-summary{font-size:var(--ui-meta);color:var(--text-secondary);line-height:var(--ui-line-reading)}.chart-actions{display:flex;flex-wrap:wrap;gap:8px}.chart-quick{display:flex;flex-wrap:wrap;gap:16px}.chart-quick label{display:flex;align-items:center;gap:8px;min-height:32px;font-size:var(--ui-label)}.chart-quick input{width:16px;height:16px;min-height:16px;margin:0}@media(max-width:760px),(pointer:coarse){.chart-quick label{min-height:44px}}</style>
