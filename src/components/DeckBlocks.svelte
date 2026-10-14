<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { ArrowLeft, Plus, Trash2, Search, ArrowUp, ArrowDown, Copy } from '@lucide/svelte';
  import { editor } from '../core/editor.svelte';
  import { BLOCK_CATEGORIES, blockSpec, blockLayouts, blockLayoutLabel, blockFingerprint, updateDeckBlock, createDeckBlock, defaultBlockOptions, searchDeckBlocks, type BlockId, type BlockCategory, type BlockOptions, type DeckBlock } from '../core/deck-blocks';
  import {descendants,groupBox} from '../core/container-tree';
  import {blockPresets,applyBlockPreset,parseBlockItems,moveBlockItem,duplicateBlockItem,removeBlockItem} from '../core/deck-block-presets';
  import Notice from './ui/Notice.svelte';
  import Dialog from './Dialog.svelte';
  import DeckBlockPreview from './DeckBlockPreview.svelte';
  import {loadLibraryTypography} from '../core/font-loading';
  import {Button, DialogFooter, EmptyState} from './ui';
  let {onclose, onplace, initialId, targetGroupId}: {onclose: () => void; onplace?: (block: DeckBlock, origin: {deckId:string;slideId:string;revision:number}) => void; initialId?: BlockId; targetGroupId?:string} = $props();
  const origin={deckId:editor.deck!.id,slideId:editor.slide!.id,revision:editor.deck!.revision};
  const page=editor.deck!,slide=editor.slide!;
  const target=untrack(()=>slide.groups?.find(g=>g.id===targetGroupId));
  const frame=target?groupBox(slide,target.id):null;
  const edited=Boolean(target?.block&&target.block.fingerprint!==blockFingerprint(descendants(slide,target.id)));
  const first=untrack(()=>target?.block?.kind??initialId);
  let preset=$state('default'),paste=$state('');
  let query=$state(''),category=$state<BlockCategory>('All'),chosen=$state<BlockId|null>(first??null);
  let options=$state<BlockOptions>(structuredClone(target?.block?.options??defaultBlockOptions(first??'architecture')));
  let error=$state(''),fontEpoch=$state(0),placing=$state(false),fontsLoading=$state(true);
  onMount(()=>{let disposed=false;const changed=()=>fontEpoch++;document.fonts.addEventListener('loadingdone',changed);void loadLibraryTypography([{...slide,elements:createDeckBlock('architecture',defaultBlockOptions('architecture'),page,slide).elements}],page.fonts).catch(()=>{}).finally(()=>{if(!disposed){fontEpoch++;fontsLoading=false;}});return()=>{disposed=true;document.fonts.removeEventListener('loadingdone',changed);};});
  let results=$derived(searchDeckBlocks(query,category));
  let spec=$derived(chosen?blockSpec(chosen):null);
  let preview=$derived.by(()=>{fontEpoch;if(!chosen)return null;try{return {block:createDeckBlock(chosen,options,page,slide,frame??undefined),error:''};}catch(e){return {block:null,error:e instanceof Error?e.message:'Check the block content.'};}});
  function choose(id:BlockId){chosen=id;options=defaultBlockOptions(id);preset='default';paste='';error='';}
  function place(){if(!preview?.block||preview.block.fitIssues.length||fontsLoading)return;if(editor.deck?.id!==origin.deckId||editor.slide?.id!==origin.slideId||editor.deck.revision!==origin.revision){error='The slide changed. Reopen Blocks to use the current version.';return;}if(target){try{const result=updateDeckBlock(editor.slide!,target.id,preview.block);editor.commit(result.operations,'','manual',origin.revision);if(editor.deck.revision!==origin.revision){editor.chooseGroup(target.id);onclose();}else error=editor.error;}catch(e){error=(e as Error).message;}}else{placing=true;onplace?.(preview.block,origin);}}
  function addItem(){if(!spec||options.items.length>=spec.max)return;options.items=[...options.items,{label:`${spec.fields[0]} ${options.items.length+1}`,detail:'Add a description',meta:chosen==='gantt'?'1–2':'',...(['architecture','organization'].includes(chosen??'')?{parent:0}:{})}];}
  function moveItem(index:number,step:number){if(chosen)options.items=moveBlockItem(chosen,options.items,index,step);}
  function duplicateItem(index:number){if(!chosen||!spec||options.items.length>=spec.max)return;options.items=duplicateBlockItem(chosen,options.items,index);}
  function removeItem(index:number){if(chosen)options.items=removeBlockItem(chosen,options.items,index);}
  function resetContent(){if(!chosen)return;const seed=target?.block?.options??defaultBlockOptions(chosen);options={...options,title:seed.title,items:seed.items.map(item=>({...item}))};error='';}
  function applyPaste(){if(!chosen)return;try{options.items=parseBlockItems(paste,chosen);error='';}catch(e){error=(e as Error).message;}}
</script>

<Dialog title={target?`Edit ${target.name}`:'Blocks'} wide workspace class="deck-blocks-dialog" onclose={onclose} returnFocus={()=>placing?document.querySelector<HTMLElement>('.canvas-stage')??undefined:undefined}>
  {#snippet footer()}<DialogFooter>{#snippet info()}<span class="hint">{chosen?'Text, shapes and lines stay editable.':'Choose a block to customize and place.'}</span>{/snippet}{#snippet actions()}<Button onclick={onclose}>{chosen?'Cancel':'Close'}</Button>{#if chosen}<Button variant="primary" disabled={!preview?.block||Boolean(preview?.block?.fitIssues.length)||fontsLoading} onclick={place}>{target?'Update block':'Place block'}</Button>{/if}{/snippet}</DialogFooter>{/snippet}
  {#if chosen && spec}
    <div class="block-detail-head">{#if !target}<Button onclick={()=>{chosen=null;error='';}}><ArrowLeft size={16}/>All blocks</Button>{/if}<span>{spec.description}</span></div>
    {#if edited}<Notice tone="warning" title="This block has manual edits" message="Updating rebuilds its objects from the content below. Check the preview; Undo restores the current objects."/>{/if}
    <div class="block-detail">
      <div class="block-form">
        {#if !target}<label>Scenario<select aria-label="Block scenario" value={preset} onchange={e=>{preset=e.currentTarget.value;options=applyBlockPreset(chosen!,preset,options);error='';}}>{#each blockPresets(chosen) as scenario}<option value={scenario.id}>{scenario.label}</option>{/each}</select></label>{/if}
        <div class="block-options"><label>Layout<select aria-label="Block layout" bind:value={options.layout}>{#each blockLayouts(chosen) as layout}<option value={layout}>{blockLayoutLabel(chosen,layout)}</option>{/each}</select></label><label>Style<select aria-label="Block style" bind:value={options.tone}><option value="plain">Plain</option><option value="surface">Soft fill</option><option value="outline">Outline</option><option value="accent">Accent</option></select></label><label>Density<select aria-label="Block density" bind:value={options.density}><option value="comfortable">Roomy</option><option value="compact">Compact</option></select></label></div>
        <div class="block-displays"><label><input type="checkbox" bind:checked={options.showTitle}/>Title</label><label><input type="checkbox" bind:checked={options.showDetails}/>Details</label>{#if spec.fields[2]&&chosen!=='gantt'}<label><input type="checkbox" bind:checked={options.showMeta}/> {spec.fields[2]}</label>{/if}{#if chosen==='process'}<label><input type="checkbox" bind:checked={options.numbered}/>Numbers</label>{/if}{#if chosen==='process'&&['auto','horizontal'].includes(options.layout)&&options.items.length<=4}<label><input type="checkbox" bind:checked={options.stagger}/>Stagger steps</label>{/if}</div>
        {#if chosen==='gantt'}<label>Periods<input type="number" aria-label="Gantt periods" min="2" max="12" bind:value={options.periods}/></label><label>Period labels<textarea aria-label="Gantt period labels" rows="2" value={options.periodLabels.join('\n')} oninput={e=>options.periodLabels=e.currentTarget.value.split('\n')}></textarea></label><span class="hint">One label per period. Leave blank for W1, W2…</span>{/if}
        <label>Title<input aria-label="Block title" maxlength="160" bind:value={options.title} /></label>
        <div class="block-item-heading"><span>Items · {options.items.length}</span><Button disabled={options.items.length>=spec.max} onclick={addItem} aria-label="Add block item"><Plus size={16}/>Add item</Button></div>
        {#each options.items as entry, index}
          <fieldset class="block-item"><legend>Item {index+1}</legend>
            <div class="block-order-actions"><Button kind="icon" aria-label={`Move item ${index+1} up`} disabled={index===0} onclick={()=>moveItem(index,-1)}><ArrowUp size={14}/></Button><Button kind="icon" aria-label={`Move item ${index+1} down`} disabled={index===options.items.length-1} onclick={()=>moveItem(index,1)}><ArrowDown size={14}/></Button><Button kind="icon" aria-label={`Duplicate item ${index+1}`} disabled={options.items.length>=spec.max} onclick={()=>duplicateItem(index)}><Copy size={14}/></Button></div>
            <div class="block-item-row"><label>{spec.fields[0]}<input aria-label={`Item ${index+1} ${spec.fields[0]}`} maxlength="200" bind:value={entry.label}/></label><Button kind="icon" aria-label={`Remove item ${index+1}`} disabled={options.items.length<=spec.min} onclick={()=>removeItem(index)}><Trash2 size={16}/></Button></div>
            {#if ['architecture','organization'].includes(chosen)}<label>Parent<select aria-label={`Item ${index+1} parent`} value={entry.parent===-1?'':entry.parent??(index>0?(chosen==='architecture'&&index>1?1:0):'')} onchange={e=>{if(e.currentTarget.value==='')entry.parent=-1;else entry.parent=Number(e.currentTarget.value);}}><option value="">No parent</option>{#each options.items as candidate,k}{#if k!==index}<option value={k}>{candidate.label}</option>{/if}{/each}</select></label>{/if}
            {#if spec.fields[2]}<label>{spec.fields[2]}<input aria-label={`Item ${index+1} ${spec.fields[2]}`} maxlength="100" bind:value={entry.meta}/></label>{/if}
            <label>{spec.fields[1]}<textarea aria-label={`Item ${index+1} ${spec.fields[1]}`} maxlength="2000" rows="2" bind:value={entry.detail}></textarea></label>
          </fieldset>
        {/each}
        <details class="block-paste"><summary>Paste items</summary><label>Items<textarea aria-label="Pasted block items" rows="5" bind:value={paste}></textarea></label><p class="hint">One item per row: label, details, then optional date or value, separated with Tab.</p><Button onclick={applyPaste}>Apply items</Button></details>
      </div>
      <div class="block-preview-column"><div class="block-large-preview" style:background={slide.background} style:aspect-ratio={preview?.block?preview.block.w/preview.block.h:1000/520}>{#if preview?.block}<DeckBlockPreview block={preview.block}/>{/if}</div><p class="hint">{target?'Update replaces this group in its current position. Undo restores the previous objects.':'Place on the canvas. Select the group to edit its block settings, or double-click to edit individual objects.'}</p><Button onclick={resetContent}>Reset content</Button></div>
    </div>
    {#if error || preview?.error || preview?.block?.fitIssues.length}<p class="block-error" role="alert">{error || preview?.error || preview?.block?.fitIssues[0]}</p>{/if}
  {:else}
    <div class="block-browse-controls"><label class="block-search"><Search size={16}/><input type="search" aria-label="Search blocks" placeholder="Search blocks…" bind:value={query}/></label><div class="block-categories" role="group" aria-label="Block categories">{#each BLOCK_CATEGORIES as value}<Button aria-pressed={category===value} onclick={()=>category=value}>{value}</Button>{/each}</div></div>
    <p class="hint block-intro">Diagrams, plans and business content for your slide.</p>
    <div class="block-grid">{#each results as result}{@const block=createDeckBlock(result.id,defaultBlockOptions(result.id),page,slide)}<button class="block-tile" onclick={()=>choose(result.id)} aria-label={`Customize ${result.label}`}><div class="block-thumbnail" style:background={slide.background}><DeckBlockPreview {block}/></div><span class="block-tile-label">{result.label}</span><span class="block-tile-description">{result.description}</span></button>{/each}</div>
    {#if !results.length}<EmptyState title="No matching blocks" description="Try architecture, agenda, timeline or another term."><Button onclick={()=>{query='';category='All';}}>Clear filters</Button></EmptyState>{/if}
  {/if}
</Dialog>

<style>
  :global(.deck-blocks-dialog .dialog-workspace-body){display:block;overflow:auto;padding:var(--dialog-gutter)}
  .block-browse-controls,.block-detail-head,.block-item-heading,.block-item-row{display:flex;align-items:center;gap:12px}
  .block-browse-controls{flex-wrap:wrap}.block-search{display:flex;align-items:center;gap:8px;flex:1;min-width:200px}.block-search input{width:100%}.block-categories{display:flex;flex-wrap:wrap;gap:4px}
  .block-intro{margin:12px 0 20px}.block-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 16px}
  .block-tile{display:flex;flex-direction:column;text-align:left;border:0;background:transparent;color:var(--text-primary);padding:8px;border-radius:var(--r-control);min-width:0;gap:8px}
  .block-tile:hover{background:var(--state-hover)}.block-tile:focus-visible{outline:2px solid var(--text-primary);outline-offset:2px}
  .block-thumbnail{width:100%;aspect-ratio:1000/520;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);overflow:hidden}
  .block-tile-label{font-weight:600}.block-tile-description{font-size:var(--ui-meta);line-height:1.5;color:var(--text-secondary)}
  .block-detail-head{margin-bottom:20px;color:var(--text-secondary);flex-wrap:wrap}.block-detail{display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,1.8fr);gap:24px}
  .block-form{display:flex;flex-direction:column;gap:16px;min-width:0}.block-form label{display:flex;flex-direction:column;gap:4px;font-size:var(--ui-label);color:var(--text-secondary)}
  .block-form :is(input:not([type="checkbox"]),textarea,select){width:100%;min-width:0}.block-item-heading{justify-content:space-between;font-size:var(--ui-meta)}
  .block-item{border:0;border-top:1px solid var(--border-subtle);padding:12px 0 0;margin:0;display:flex;flex-direction:column;gap:12px;min-width:0}.block-item legend{font-size:var(--ui-meta);color:var(--text-secondary);padding-right:8px}
  .block-item-row>label{flex:1;min-width:0}.block-item-row>:global(button){align-self:end}.block-preview-column{position:sticky;top:0;align-self:start;min-width:0}.block-large-preview{aspect-ratio:1000/520;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);overflow:hidden}
  .block-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.block-displays{display:flex;flex-wrap:wrap;gap:12px}.block-displays label{flex-direction:row;align-items:center;gap:8px}.block-displays input{width:auto}.block-order-actions{display:flex;justify-content:flex-end;gap:4px}.block-paste{display:flex;flex-direction:column;gap:12px}.block-paste summary{cursor:pointer;min-height:44px}.block-paste[open]>label{margin-top:12px}
  .block-error{color:var(--danger-text);margin-top:16px}
  @media(max-width:760px){.block-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 8px}.block-detail{display:flex;flex-direction:column;gap:20px}.block-preview-column{order:-1;position:static}.block-categories{width:100%}.block-detail-head>span{display:none}.block-tile{padding:4px}.block-tile-description{display:none}.block-categories :global(button){min-height:44px}.block-search input{min-height:44px}}
</style>
