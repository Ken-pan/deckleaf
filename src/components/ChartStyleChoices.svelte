<script lang="ts">
  import {chartPresets,chartPresetPatch,chartPresetMatches} from '../core/chart-style';
  import type {Chart} from '../core/chart-schema';
  let {chart,dense=false,onchoose}:{chart:Chart;dense?:boolean;onchoose:(patch:Partial<Chart>)=>void}=$props();
</script>
<div class="chart-presets" class:dense role="group" aria-label="Chart style presets">{#each chartPresets as preset}{@const style=chartPresetPatch(preset.id)}
  <button type="button" aria-pressed={chartPresetMatches(chart,preset.id)} title={preset.hint} onclick={()=>onchoose(style)}>
    <svg viewBox="0 0 120 64" aria-hidden="true">
      {#if style.grid}{#each [12,28,44,60] as y}<path d={`M4 ${y} H116`} stroke="currentColor" opacity=".14" stroke-dasharray="3 3"/>{/each}{/if}
      {#if chart.type==='pie'||chart.type==='donut'}<circle cx="60" cy="32" r="25" fill={chart.type==='pie'?chart.colors[0]:'none'} stroke={chart.type==='donut'?chart.colors[0]:'none'} stroke-width={50*(1-(style.visual?.donutHole??64)/100)}/><path d="M60 7 A25 25 0 0 1 85 32" fill="none" stroke={chart.colors[1]??chart.colors[0]} stroke-width={chart.type==='pie'?24:50*(1-(style.visual?.donutHole??64)/100)}/>
      {:else if chart.type==='line'||chart.type==='area'}{#if chart.type==='area'}<path d="M8 46 L40 30 L74 38 L112 12 V60 H8 Z" fill={chart.colors[0]} opacity={style.visual?.areaOpacity??.12}/>{/if}<path d="M8 46 L40 30 L74 38 L112 12" stroke={chart.colors[0]} stroke-width={style.visual?.lineWidth??3} fill="none"/>{#if style.visual?.pointSize}{#each [[8,46],[40,30],[74,38],[112,12]] as point}<circle cx={point[0]} cy={point[1]} r={(style.visual?.pointSize??4)/2} fill={chart.colors[0]}/>{/each}{/if}
      {:else}{#each [28,44,36,54] as h,i}<rect x={8+i*28} y={60-h} width="18" height={h} rx={style.visual?.cornerRadius??0} fill={chart.colors[i%chart.colors.length]}/>{/each}{/if}
    </svg><span>{preset.label}</span>
  </button>
{/each}</div>
<style>.chart-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.chart-presets button{display:flex;flex-direction:column;gap:8px;text-align:left;padding:12px;background:var(--field-surface);border:1px solid var(--border-subtle);border-radius:var(--r-control);color:var(--text-secondary);font-size:var(--ui-label)}.chart-presets svg{width:100%;height:60px}.chart-presets button[aria-pressed='true']{border-color:var(--accent-line);background:var(--state-selected);color:var(--text-link)}.dense button{padding:8px;gap:4px}.dense svg{height:32px}@media(max-width:760px),(pointer:coarse){.chart-presets button{min-height:44px}}</style>
