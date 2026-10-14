<script lang="ts">
  import { untrack,tick } from 'svelte';
  import type { SlideElement } from '../core/model';
  import { loadLibraryFont } from '../core/font-loading';
  let {element,fonts,editable=false,activePoint,onpoint}:{element:SlideElement;fonts?:import('../core/model').Deck['fonts'];editable?:boolean;activePoint?:{series:number;category:number};onpoint?:(series:number,category:number)=>void}=$props();
  let root=$state<HTMLDivElement>(),focusedPoint=$state<{series:number;category:number}|null>(null),hoverPoint=$state<{series:number;category:number}|null>(null);
  let attempt = $state(0),lastChart=$state<{svg:string;description:string}>();
  const signature = $derived(JSON.stringify([element.chart, element.values, element.w, element.h, element.fontSize, element.fontFamily, element.fill, element.name,editable]));
  const request = $derived.by(() => {
    signature;
    attempt;
    const snapshot = untrack(() => element), imported = untrack(() => fonts);
    const interactive=untrack(()=>editable);
    return Promise.all([import('../core/chart-render'), loadLibraryFont(snapshot.fontFamily, imported).catch(() => {})]).then(([render]) => ({svg: render.renderChartSvg(snapshot,interactive), description: render.chartAlt(snapshot)}));
  });
  $effect(()=>{let active=true;void request.then(result=>{if(active)lastChart=result;}).catch(()=>{});return()=>active=false;});
  function indices(node:Element){return {series:Number(node.getAttribute('data-chart-series')),category:Number(node.getAttribute('data-chart-category'))};}
  function target(event:Event){return editable&&event.target instanceof Element?event.target.closest<HTMLElement>('[data-chart-point]'):null;}
  function targets(){return Array.from(root?.querySelectorAll<HTMLElement>('[data-chart-point]')??[]);}
  function same(a:{series:number;category:number}|null|undefined,b:{series:number;category:number}){return a?.series===b.series&&a.category===b.category;}
  function updateTargets(){
    const nodes=targets(),wanted=activePoint??focusedPoint,current=nodes.some(n=>same(wanted,indices(n)))?wanted:(nodes[0]?indices(nodes[0]):null);let claimed=false;
    for(const node of nodes){const selected=same(current,indices(node));node.setAttribute('tabindex',editable&&selected&&!claimed?'0':'-1');if(selected)claimed=true;}
    for(const node of root?.querySelectorAll('[data-chart-mark]')??[]){const p=indices(node);node.toggleAttribute('data-chart-active',editable&&same(activePoint,p));node.toggleAttribute('data-chart-hover',editable&&same(hoverPoint??focusedPoint,p));}
  }
  $effect(()=>{root;lastChart;editable;activePoint;focusedPoint;hoverPoint;void tick().then(updateTargets);});
  $effect(()=>{lastChart;if(editable)void tick().then(()=>window.dispatchEvent(new Event('deck-studio-chart-rendered')));});
  function down(event:PointerEvent){const node=target(event);if(node){event.preventDefault();event.stopPropagation();node.focus({preventScroll:true});}}
  function choose(event:MouseEvent){
    let node=target(event);
    if(node?.hasAttribute('data-chart-line-hit')){let distance=Infinity;for(const n of targets().filter(n=>n.hasAttribute('data-chart-line-hit'))){const r=n.getBoundingClientRect(),d=Math.hypot(event.clientX-r.x-r.width/2,event.clientY-r.y-r.height/2);if(d<distance){distance=d;node=n;}}}
    if(node){event.preventDefault();event.stopPropagation();const p=indices(node);onpoint?.(p.series,p.category);}
  }
  function key(event:KeyboardEvent){
    const node=target(event);if(!node||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
    if(['Enter',' ','F2'].includes(event.key)){event.preventDefault();event.stopPropagation();const p=indices(node);onpoint?.(p.series,p.category);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();const p=indices(node),nodes=targets();
    const series=Math.max(0,p.series+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0)),category=event.key==='Home'?0:event.key==='End'?Math.max(...nodes.filter(n=>indices(n).series===p.series).map(n=>indices(n).category)):Math.max(0,p.category+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0));
    nodes.find(n=>same({series,category},indices(n)))?.focus({preventScroll:true});
  }
</script>
{#snippet visual(chart:{svg:string;description:string})}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div bind:this={root} class="chart-visual" class:point-editable={editable} role={editable?'group':'img'} aria-label={editable?`${element.name||'Chart'} · Drag a point to adjust · Click to edit`:chart.description} data-chart-rendered="true" onpointerdown={down} onclick={choose} ondblclick={event=>{if(target(event))event.stopPropagation();}} onkeydown={key} onfocusin={event=>{const node=target(event);if(node)focusedPoint=indices(node);}} onpointerover={event=>{const node=target(event);hoverPoint=node?indices(node):null;}} onpointerleave={()=>hoverPoint=null}>
    {@html editable?chart.svg.replace('<svg role="img"','<svg role="group" aria-label="Data points"'):chart.svg.replace('<svg role="img"','<svg aria-hidden="true"')}
  </div>
{/snippet}
{#await request}
  {#if lastChart}{@render visual(lastChart)}{:else}<div class="chart-state" role="status">Rendering chart…</div>{/if}
{:then chart}
  {@render visual(chart)}
{:catch}
  <div class="chart-state" role="status">Chart unavailable<button onclick={() => attempt++}>Retry</button></div>
{/await}
<style>
  .chart-visual{width:100%;height:100%;pointer-events:none}.chart-visual :global(svg){width:100%;height:100%;display:block}
  .point-editable{pointer-events:auto}.point-editable :global(svg){pointer-events:none}
  .point-editable :global([data-chart-point]){pointer-events:visiblePainted!important;cursor:pointer}
  .point-editable :global([data-chart-line-hit]){fill:transparent;stroke:transparent;stroke-width:calc(16px / var(--canvas-scale,1));pointer-events:all!important}
  .point-editable :global([data-chart-marker]){pointer-events:none!important}
  .point-editable :global([data-chart-mark][data-chart-active]),.point-editable :global([data-chart-mark][data-chart-hover]){stroke:var(--canvas-selection);stroke-width:calc(2px / var(--canvas-scale,1));stroke-opacity:1;opacity:1}
  .point-editable :global([data-chart-marker][data-chart-active]),.point-editable :global([data-chart-marker][data-chart-hover]){fill:var(--canvas-selection);fill-opacity:1}
  @media(pointer:coarse){.point-editable :global([data-chart-line-hit]){stroke-width:calc(44px / var(--canvas-scale,1))}}
  .chart-state{width:100%;height:100%;display:grid;place-content:center;gap:8px;font-size:18px;text-align:center;color:inherit}
</style>
