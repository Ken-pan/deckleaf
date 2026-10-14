<script lang="ts">
  import {untrack,tick,onDestroy} from 'svelte';
  import {blockLayouts,blockLayoutLabel} from '../core/deck-blocks';
  import type {Slide} from '../core/model';
  import {editableTemplateBody,editableTemplateItems,type TemplateOptions} from '../core/template-contracts';
  import {seedTemplateInput,templateInputPatch,type TemplateInput} from '../core/template-input';
  import {Button} from './ui';
  import Notice from './ui/Notice.svelte';
  let {collection,layout,slide,options,onapply,onreset}:{collection:string;layout:string;slide:Slide;options:TemplateOptions;onapply:(patch:TemplateOptions)=>void;onreset:()=>void}=$props();
  let draft=$state<TemplateInput>({heading:'',headingSeed:'',body:'',items:'',dates:'',data:'',source:'',unit:'',forecast:'',forecastSeed:''}),error=$state(''),seedKey='';
  let disclosure:HTMLDetailsElement,run=0;let applying=$state(false);
  const chart=$derived(options.chart??slide.elements.find(e=>e.chart)?.chart);
  const blockKind=$derived(slide.groups?.find(g=>g.block)?.block?.kind);
  const blockOptions=$derived({...slide.groups?.find(g=>g.block)?.block?.options,...options.block});
  const metadata=$derived(layout==='timeline'||blockKind&&!['metrics','process','organization','architecture','kanban','swot'].includes(blockKind));
  const tabular=$derived(['table','comparison','action-plan'].includes(layout)||slide.elements.some(e=>e.type==='table'));
  onDestroy(()=>run++);
  $effect(()=>{const key=collection+'/'+layout;if(key!==seedKey){seedKey=key;untrack(seed);}});
  function seed(){draft=seedTemplateInput(collection,layout,slide,options);error='';}
  async function apply(){if(applying)return;const key=collection+'/'+layout,token=++run;applying=true;try{const patch=await templateInputPatch(layout,{...draft},options,chart);if(token!==run||key!==collection+'/'+layout)return;onapply(patch);if(patch.chart){draft.forecast=patch.chart.forecastFrom===undefined?'':String(patch.chart.forecastFrom);draft.forecastSeed=draft.forecast;}error='';}catch(e){if(token===run&&key===collection+'/'+layout)error=(e as Error).message;}finally{applying=false;}}
  function configureBlock(patch:NonNullable<TemplateOptions['block']>){try{onapply({block:{...options.block,...patch}});error='';}catch(e){error=(e as Error).message;}}
  async function reset(){run++;onreset();await tick();seed();}
</script>
<details class="template-content" bind:this={disclosure}>
  <summary onclick={()=>{if(!disclosure.open)seed();}}>Edit content and data</summary>
  <label class="field-label">Heading<textarea aria-label="Template heading" rows="2" bind:value={draft.heading}></textarea></label>
  {#if editableTemplateBody(layout)}<label class="field-label">Description<textarea aria-label="Template description" rows="3" bind:value={draft.body}></textarea></label>{/if}
  {#if editableTemplateItems(layout)}<label class="field-label">Items<textarea aria-label="Template content items" rows="5" bind:value={draft.items}></textarea></label><p class="hint">{layout==='dashboard'?'Paste one metric per row: label, value, then optional target or change.':'One item per row. Separate its title and explanation with Tab.'} Extra items continue on another slide.</p>{/if}
  {#if metadata}<label class="field-label">{blockKind==='gantt'?'Period ranges':blockKind==='funnel'?'Values':layout==='timeline'?'Dates':'Item metadata'}<textarea aria-label="Template milestone dates" rows="3" bind:value={draft.dates}></textarea></label><p class="hint">One value per item. Use start–end period numbers for schedules.</p>{/if}
  {#if tabular||chart}<label class="field-label">{chart?'Chart data':'Table data'}<textarea aria-label={chart?'Template chart data':'Template table data'} rows="6" bind:value={draft.data}></textarea></label><p class="hint">Paste CSV or spreadsheet cells with a header row.{chart?' Each following column is a series; every value must be a number.':' Long tables continue with repeated headers.'}</p><label class="field-label">Source<input aria-label="Template data source" bind:value={draft.source}/></label>{/if}
  {#if chart}<div class="data-options"><label class="field-label">Unit<input aria-label="Template chart unit" bind:value={draft.unit} maxlength="12" placeholder="%, min, pp"/></label>{#if ['line','area'].includes(chart.type)}<label class="field-label">Forecast starts at<select aria-label="Template forecast start" bind:value={draft.forecast}><option value="">No forecast</option>{#each chart.labels.slice(1) as label,i}<option value={String(i+1)}>{label}</option>{/each}</select></label>{/if}</div>{/if}
  {#if blockKind}<label class="field-label">Source<input aria-label="Template block source" bind:value={draft.source}/></label><div class="data-options"><label class="field-label">Block layout<select aria-label="Template block layout" value={blockOptions.layout??'auto'} onchange={e=>configureBlock({layout:e.currentTarget.value as 'auto'})}>{#each blockLayouts(blockKind) as mode}<option value={mode}>{blockLayoutLabel(blockKind,mode)}</option>{/each}</select></label><label class="field-label">Block style<select aria-label="Template block style" value={blockOptions.tone??'plain'} onchange={e=>configureBlock({tone:e.currentTarget.value as 'plain'})}><option value="plain">Plain</option><option value="surface">Soft fill</option><option value="outline">Outline</option><option value="accent">Accent</option></select></label></div><label class="block-check"><input type="checkbox" checked={blockOptions.showDetails??true} onchange={e=>configureBlock({showDetails:e.currentTarget.checked})}/>Show item details</label>{#if blockKind==='gantt'}<label class="field-label">Periods<input type="number" aria-label="Template schedule periods" min="2" max="12" value={blockOptions.periods??6} onchange={e=>configureBlock({periods:Number(e.currentTarget.value)})}/></label>{/if}{/if}
  {#if error}<Notice tone="error" title="Check the content" message={error}/>{/if}
  <div class="content-actions"><Button variant="secondary" busy={applying} onclick={apply}>Apply content</Button><Button variant="quiet" onclick={reset}>Reset content</Button></div>
</details>
<style>
  .block-check{display:flex;align-items:center;gap:8px;font-size:var(--ui-label)}
  .template-content{margin:0 0 18px}.template-content[open]{display:flex;flex-direction:column;gap:12px}.template-content summary{font-size:var(--ui-label);cursor:pointer;min-height:36px;display:flex;align-items:center}.template-content textarea{width:100%;min-width:0}.template-content .hint{font-size:var(--ui-meta);margin:0}.data-options{display:flex;gap:12px;flex-wrap:wrap}.data-options label{flex:1;min-width:150px}.content-actions{display:flex;gap:8px;flex-wrap:wrap}@media(pointer:coarse){.template-content summary{min-height:44px}}
</style>
