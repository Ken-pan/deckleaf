<script lang="ts">
  import Notice from './ui/Notice.svelte';
  import {slideLabel} from '../core/slide-label';
  import {tick,onMount} from 'svelte';
  import {templateDeck,createLayout,createTemplatePages,embedTemplateArtwork,COLLECTIONS,templateLayouts,deckTemplateCollection,type LayoutId} from '../core/templates';
  import {templateContract,type TemplateOptions} from '../core/template-contracts';
  import {TEMPLATE_RECIPES,TEMPLATE_TASKS,recipeTemplateDeck,templateTask,matchesTemplateSearch} from '../core/template-recipes';
  import {templateBlockId} from '../core/template-block-map';
  import {resetTemplateContent} from '../core/template-input';
  import TemplateContentEditor from './TemplateContentEditor.svelte';
  import {blankSlide,newDeck,type Deck,type Slide} from '../core/model';
  import {styleTemplate} from '../core/template-styles';
  import {readDeckStyleLibrary,type SavedDeckStyle} from '../core/deck-style-library';
  import {localFontChoices} from '../core/fonts';
  import {TEXT_ROLES} from '../core/design-system-schema';
  import {deckDesignSystem,styleSlide} from '../core/deck-design-system';
  import {countLabel} from '../core/ui-copy';
  import {loadLibraryTypography} from '../core/font-loading';
  import {Plus,ArrowLeft,ArrowRight,Check,Play,Square} from '@lucide/svelte';
  import {Button} from './ui';
  import SlideCanvas from './SlideCanvas.svelte';
  import TemplatePlayback from './TemplatePlayback.svelte';
  let {mode,deck,initialCollection,oncreate,onlayout,onlibrary}:{mode:'document'|'slide';deck:Deck|null;initialCollection?:string;oncreate:(deck:Deck)=>unknown;onlayout:(slide:Slide|Slide[],collection:Deck['templateCollection'])=>unknown;onlibrary?:()=>unknown}=$props();
  // Stable preview documents avoid recreating every object on every selection.
  let templatePreviews=$state(COLLECTIONS.map(c=>({collection:c,deck:templateDeck(c.id)})));
  let optionsByCollection=$state<Record<string,Record<string,TemplateOptions>>>({});
  let recipe=$state(''),layoutQuery=$state(''),taskChoice=$state('all');
  let showLibrary=$state(false);
  let chosenLayout=$state<LayoutId|null>(null),insertOptions=$state<TemplateOptions>({});
  let selected=$state(''),page=$state(0),creating=$state(false),failure=$state('');
  let motion=$state(false);
  // A dialog can reopen while its previous exit is still settling.
  $effect(()=>{selected=initialCollection??'';page=0;motion=false;});
  let savedStyles=$state<SavedDeckStyle[]>([]),styleChoice=$state('template');
  onMount(()=>savedStyles=readDeckStyleLibrary(localStorage));
  const chosenSystem=$derived(styleChoice==='current'&&deck?deckDesignSystem(deck):savedStyles.find(s=>s.id===styleChoice)?.system);
  const previews=$derived(templatePreviews.map(p=>({...p,deck:styleTemplate(p.deck,chosenSystem,deck??undefined)})));
  const availableFonts=$derived(localFontChoices(previews[0].deck).map(f=>f.family.toLowerCase()));
  const unavailable=$derived(chosenSystem?[...new Set(TEXT_ROLES.map(role=>chosenSystem.typography[role].fontFamily))].filter(family=>!availableFonts.includes(family.toLowerCase())&&!deck?.onlineFonts?.some(f=>f.family.toLowerCase()===family.toLowerCase())):[]);
  let previewHeading=$state<HTMLHeadingElement>();
  let galleryScroll=0;
  let active=$derived(previews.find(p=>p.collection.id===selected));
  const prototype=$derived(active?.deck.slides[page]?.template?.prototype as LayoutId|undefined);
  const contract=$derived(prototype?templateContract(prototype):undefined);
  const variant=$derived(prototype?optionsByCollection[selected]?.[prototype]??{}:{});
  const previewDeck=(id:string,library=showLibrary)=>library?templateDeck(id,optionsByCollection[id],true):recipeTemplateDeck(id,recipe,optionsByCollection[id]);
  function changeRecipe(){showLibrary=false;motion=false;page=0;templatePreviews=templatePreviews.map(p=>p.collection.id===selected?{...p,deck:previewDeck(selected)}:p);}
  function changeVariant(patch:TemplateOptions,replace=false){
    if(!active||!prototype)return;motion=false;const id=prototype;
    const options={...optionsByCollection[selected],[id]:Object.fromEntries(Object.entries(replace?patch:{...variant,...patch}).filter(([,value])=>value!==undefined))};
    const next=showLibrary?templateDeck(selected,options,true):recipeTemplateDeck(selected,recipe,options);
    styleTemplate(next,chosenSystem,deck??undefined);
    optionsByCollection={...optionsByCollection,[selected]:options};
    templatePreviews=templatePreviews.map(p=>p.collection.id===selected?{...p,deck:next}:p);
    page=Math.max(0,next.slides.findIndex(s=>s.template?.prototype===id));
  }
  function toggleLibrary(){showLibrary=!showLibrary;motion=false;page=0;templatePreviews=templatePreviews.map(p=>p.collection.id===selected?{...p,deck:previewDeck(selected)}:p);}
  let currentSystem=$derived(deckDesignSystem(deck??{}));
  let currentCollection=$derived(deckTemplateCollection(deck));
  let layouts=$derived(templateLayouts(currentCollection).map(l=>({layout:l,slide:styleSlide(createLayout(l.id,(deck?.slides.length??0)+1,currentCollection),{width:1440,height:810},currentSystem)})));
  const visibleLayouts=$derived(layouts.filter(({layout})=>(taskChoice==='all'||templateTask(layout.id)===taskChoice)&&matchesTemplateSearch(layout,layoutQuery)));
  const insertPreview=$derived(chosenLayout?styleTemplate(newDeck('Layout preview',createTemplatePages(chosenLayout,(deck?.slides.length??0)+1,currentCollection,insertOptions)),currentSystem,deck??undefined):null);
  function applyInsertContent(patch:TemplateOptions,replace=false){if(!chosenLayout)return;const next=Object.fromEntries(Object.entries(replace?patch:{...insertOptions,...patch}).filter(([,value])=>value!==undefined));styleTemplate(newDeck('Layout preview',createTemplatePages(chosenLayout,(deck?.slides.length??0)+1,currentCollection,next)),currentSystem,deck??undefined);insertOptions=next;}
  $effect(()=>{if(mode==='document')void loadLibraryTypography(previews.flatMap(p=>p.deck.slides)).catch(()=>{});});
  async function createDocument(id?:string){
    if(creating)return;
    creating=true;failure='';
    try{
      let d=id?previewDeck(id):newDeck('Untitled document',[blankSlide()]);
      d=styleTemplate(d,chosenSystem,deck??undefined);
      await oncreate(await embedTemplateArtwork(d));
    }catch{failure='The document could not be created. Try again.';}
    finally{creating=false;}
  }
  async function insertLayout(slide:Slide|Slide[]){
    if(creating)return;creating=true;failure='';
    try{const d=await embedTemplateArtwork({...templateDeck(currentCollection),slides:Array.isArray(slide)?slide:[slide]});await onlayout(d.slides.length===1?d.slides[0]:d.slides,currentCollection);}
    catch{failure='The slide could not be added. Try again.';}
    finally{creating=false;}
  }
  async function choose(id:string){
    showLibrary=false;templatePreviews=templatePreviews.map(p=>p.collection.id===id?{...p,deck:previewDeck(id,false)}:p);
    const body=document.getElementById(`template-${id}`)?.closest('.modal-body');
    galleryScroll=body?.scrollTop??0;motion=false;selected=id;page=0;failure='';await tick();
    const previewBody=previewHeading?.closest('.modal-body');if(previewBody)previewBody.scrollTop=0;
    previewHeading?.focus({preventScroll:true});
  }
  async function back(){
    const id=selected;motion=false;selected='';page=0;await tick();
    const card=document.getElementById(`template-${id}`),body=card?.closest('.modal-body');
    if(body)body.scrollTop=galleryScroll;card?.focus({preventScroll:true});
  }
  async function stopMotion(){motion=false;await tick();document.getElementById('template-motion-toggle')?.focus({preventScroll:true});}
  function previewPage(index:number){
    page=index;
    const body=previewHeading?.closest('.modal-body');if(body)body.scrollTop=0;
    previewHeading?.focus({preventScroll:true});
  }
</script>
{#if mode==='document'}
  {#if deck||savedStyles.length}<div class="template-style-choice"><label class="field-label">Style<select aria-label="New document style" bind:value={styleChoice} onchange={()=>motion=false} disabled={creating}><option value="template">Template style</option>{#if deck}<option value="current">Current · {currentSystem.name}</option>{/if}{#if savedStyles.length}<optgroup label="Saved styles">{#each savedStyles as item}<option value={item.id}>{item.system.name}</option>{/each}</optgroup>{/if}</select></label><p class="hint">{chosenSystem?'Applies to the new document.':''}</p>{#if unavailable.length}<p class="hint">{unavailable.join(', ')}: add custom fonts in Document fonts after creating.</p>{/if}</div>{/if}
  {#if active}
    <div class="template-detail-actions">
      <Button variant="quiet" aria-label="Templates: browse all" disabled={creating} onclick={back}><ArrowLeft size={16}/>Templates</Button>
      <Button variant="primary" busy={creating} onclick={()=>createDocument(active!.collection.id)}><Check size={16}/>Use template</Button>
    </div>
    <div class="template-detail-title"><h3 bind:this={previewHeading} tabindex="-1">{active.collection.name}<span>{active.collection.category}</span></h3><p>{active.collection.caption}</p><small>{countLabel(active.deck.slides.length,'slide')} · {active.deck.designSystem!.typography.title.fontFamily}{active.deck.designSystem!.typography.body.fontFamily!==active.deck.designSystem!.typography.title.fontFamily?` + ${active.deck.designSystem!.typography.body.fontFamily}`:''}</small></div>
    <div class="template-recipe"><label class="field-label">Purpose<select aria-label="Template purpose" bind:value={recipe} onchange={changeRecipe}><option value="">Default story · 24 slides</option>{#each TEMPLATE_RECIPES as item}<option value={item.id}>{item.name} · {countLabel(item.layouts.length,'slide')}</option>{/each}</select></label><p class="hint">{showLibrary?'All layouts in this family.':TEMPLATE_RECIPES.find(r=>r.id===recipe)?.hint??'Choose a shorter story if needed.'}</p></div>
    <div class="template-behavior-bar"><span>Includes motion</span><Button variant="quiet" aria-pressed={showLibrary} onclick={toggleLibrary}>{showLibrary?'View story':'All layouts'}</Button><Button id="template-motion-toggle" variant="secondary" aria-pressed={motion} onclick={()=>motion?stopMotion():motion=true}>{#if motion}<Square size={14}/>Stop motion{:else}<Play size={14}/>Play motion{/if}</Button></div>
    {#if prototype&&contract}<div class="template-variants">
      <label>Density<select aria-label="Template density" value={variant.density??'presentation'} onchange={e=>changeVariant({density:e.currentTarget.value as TemplateOptions['density']})}><option value="presentation">Presentation</option><option value="reading">Reading</option></select></label>
      {#if contract.counts.length>1&&!variant.chart&&(!variant.cells||['table','action-plan'].includes(prototype))}<label>{['table','action-plan'].includes(prototype)?'Rows per page':'Items'}<select aria-label={['table','action-plan'].includes(prototype)?'Rows per page in template':'Template item count'} value={variant.count??''} onchange={e=>changeVariant({count:e.currentTarget.value?Number(e.currentTarget.value):undefined})}><option value="">Default</option>{#each contract.counts as count}<option value={count}>{count}</option>{/each}</select></label>{/if}
      {#if ['cover','split','freeform'].includes(prototype)}<label class="variant-check"><input type="checkbox" aria-label="Text only template" checked={variant.noImage??false} onchange={e=>changeVariant({noImage:e.currentTarget.checked})}/>Text only</label>{/if}
      {#if prototype==='split'}<label class="variant-check"><input type="checkbox" aria-label="Image left in template" checked={variant.mirror??false} onchange={e=>changeVariant({mirror:e.currentTarget.checked})}/>Image left</label>{/if}
      {#if prototype==='gallery'}<label>Image fit<select aria-label="Template image fit" value={variant.imageFit??''} onchange={e=>changeVariant({imageFit:e.currentTarget.value as TemplateOptions['imageFit']||undefined})}><option value="">Default</option><option value="cover">Crop</option><option value="contain">Full image</option></select></label><label>Image shape<select aria-label="Template image shape" value={variant.imageShape??'landscape'} onchange={e=>changeVariant({imageShape:e.currentTarget.value as TemplateOptions['imageShape']})}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>{/if}
      {#if templateBlockId(prototype)&&!['architecture','gantt','kanban','swot','funnel'].includes(prototype)}<label>Structure<select aria-label="Template structure" value={variant.structure??'block'} onchange={e=>changeVariant({structure:e.currentTarget.value as TemplateOptions['structure']})}><option value="designed">Designed page</option><option value="block">Editable block</option></select></label>{/if}
      <span class="hint">{contract.capacity}</span>
    </div><TemplateContentEditor collection={selected} layout={prototype} slide={active.deck.slides[page]} options={variant} onapply={changeVariant} onreset={()=>changeVariant(resetTemplateContent(variant),true)}/>{/if}
    {#if motion}<TemplatePlayback deck={active.deck} bind:index={page} onstop={stopMotion}/>{:else}
      <div class="template-preview" aria-label={`Preview: ${slideLabel(page)}`}><SlideCanvas deck={active.deck} slide={active.deck.slides[page]}/></div>
      <div class="template-page-bar"><Button variant="quiet" disabled={page===0} aria-label="Previous preview slide" onclick={()=>page--}><ArrowLeft size={16}/></Button><span aria-live="polite">{page+1} / {active.deck.slides.length}</span><Button variant="quiet" disabled={page===active.deck.slides.length-1} aria-label="Next preview slide" onclick={()=>page++}><ArrowRight size={16}/></Button></div>
    {/if}
    <div class="template-pages" aria-label="Template slides">{#each active.deck.slides as slide,i}<button class:chosen={page===i} aria-pressed={page===i} onclick={()=>previewPage(i)}><span class="sr-only">Preview slide </span><div aria-hidden="true"><SlideCanvas deck={active.deck} {slide}/></div><span>{String(i+1).padStart(2,'0')}</span></button>{/each}</div>
    {#if failure}<Notice tone="error" title="Template could not be prepared" message={failure}/>{/if}
  {:else}
    <p class="dialog-intro">Preview a template to get started.</p>
    {#if !deck}<div class="template-start-actions"><Button variant="secondary" disabled={creating} onclick={()=>createDocument()}><Plus size={16}/>Start blank</Button>{#if onlibrary}<Button variant="quiet" disabled={creating} onclick={onlibrary}>Open document library</Button>{/if}</div>{/if}
    <div class="template-collections">{#each previews as preview}
      <button id={`template-${preview.collection.id}`} class="template-collection" aria-label={`Preview ${preview.collection.name} template`} onclick={()=>choose(preview.collection.id)}>
        <span class="sr-only">Preview template </span><div class="template-cover" aria-hidden="true"><SlideCanvas deck={preview.deck} slide={preview.deck.slides[0]}/></div>
        <div class="template-specimens" aria-hidden="true">{#each preview.deck.slides.slice(1,4) as slide}<SlideCanvas deck={preview.deck} {slide}/>{/each}</div>
        <div class="template-collection-heading"><strong>{preview.collection.name}</strong><span>{preview.collection.category}</span></div>
        <p>{preview.collection.caption}</p><small>{countLabel(preview.deck.slides.length,'slide')} · {preview.deck.designSystem!.typography.title.fontFamily}{preview.deck.designSystem!.typography.body.fontFamily!==preview.deck.designSystem!.typography.title.fontFamily?` + ${preview.deck.designSystem!.typography.body.fontFamily}`:''}</small>
      </button>
    {/each}</div>
    {#if deck}<div class="template-blank"><span>Prefer a clean slate?</span><Button variant="secondary" disabled={creating} onclick={()=>createDocument()}><Plus size={16}/>Start blank</Button></div>{/if}
    {#if failure}<Notice tone="error" title="Template could not be prepared" message={failure}/>{/if}
  {/if}
{:else}
  <p class="dialog-intro">{COLLECTIONS.find(c=>c.id===currentCollection)!.category} · Uses {currentSystem.name} fonts, colors, and pattern.</p>
  {#if chosenLayout&&insertPreview}{@const spec=templateContract(chosenLayout)}<div class="template-detail-actions"><Button variant="quiet" onclick={()=>chosenLayout=null}><ArrowLeft size={16}/>Layouts</Button><Button variant="primary" busy={creating} onclick={()=>insertLayout(insertPreview!.slides)}>Add {countLabel(insertPreview.slides.length,'slide')}</Button></div><div class="template-variants"><label>Density<select aria-label="Layout density" value={insertOptions.density??'presentation'} onchange={e=>insertOptions={...insertOptions,density:e.currentTarget.value as TemplateOptions['density']}}><option value="presentation">Presentation</option><option value="reading">Reading</option></select></label>{#if spec.counts.length>1&&!insertOptions.chart&&(!insertOptions.cells||['table','action-plan'].includes(chosenLayout))}<label>{['table','action-plan'].includes(chosenLayout)?'Rows per page':'Items'}<select aria-label={['table','action-plan'].includes(chosenLayout)?'Rows per page in layout':'Layout item count'} value={insertOptions.count??''} onchange={e=>insertOptions={...insertOptions,count:e.currentTarget.value?Number(e.currentTarget.value):undefined}}><option value="">Default</option>{#each spec.counts as n}<option value={n}>{n}</option>{/each}</select></label>{/if}{#if ['cover','split','freeform'].includes(chosenLayout)}<label class="variant-check"><input type="checkbox" aria-label="Text only layout" checked={insertOptions.noImage??false} onchange={e=>insertOptions={...insertOptions,noImage:e.currentTarget.checked}}/>Text only</label>{/if}{#if chosenLayout==='split'}<label class="variant-check"><input type="checkbox" aria-label="Image left in layout" checked={insertOptions.mirror??false} onchange={e=>insertOptions={...insertOptions,mirror:e.currentTarget.checked}}/>Image left</label>{/if}{#if chosenLayout==='gallery'}<label>Image fit<select aria-label="Layout image fit" value={insertOptions.imageFit??''} onchange={e=>insertOptions={...insertOptions,imageFit:e.currentTarget.value as TemplateOptions['imageFit']||undefined}}><option value="">Default</option><option value="cover">Crop</option><option value="contain">Full image</option></select></label><label>Image shape<select aria-label="Layout image shape" value={insertOptions.imageShape??'landscape'} onchange={e=>insertOptions={...insertOptions,imageShape:e.currentTarget.value as TemplateOptions['imageShape']}}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>{/if}{#if templateBlockId(chosenLayout)&&!['architecture','gantt','kanban','swot','funnel'].includes(chosenLayout)}<label>Structure<select aria-label="Layout structure" value={insertOptions.structure??'block'} onchange={e=>applyInsertContent({structure:e.currentTarget.value as TemplateOptions['structure']})}><option value="designed">Designed page</option><option value="block">Editable block</option></select></label>{/if}<span class="hint">{spec.capacity}</span></div><TemplateContentEditor collection={currentCollection} layout={chosenLayout} slide={insertPreview.slides[0]} options={insertOptions} onapply={applyInsertContent} onreset={()=>applyInsertContent(resetTemplateContent(insertOptions),true)}/>{#each insertPreview.slides as slide}<div class="template-preview"><SlideCanvas deck={insertPreview} {slide}/></div>{/each}{:else}
  <div class="template-finder"><label class="field-label">Task<select aria-label="Filter layout task" bind:value={taskChoice}>{#each TEMPLATE_TASKS as task}<option value={task.id}>{task.name}</option>{/each}</select></label><label class="field-label">Find a layout<input type="search" aria-label="Search layouts" bind:value={layoutQuery} placeholder="Compare, timeline, evidence…"/></label><span class="hint" aria-live="polite">{countLabel(visibleLayouts.length,'layout')}</span></div><div class="layout-grid">{#each visibleLayouts as {layout,slide}}<button class="template-item" aria-label={`Add ${layout.name} slide`} disabled={creating} onclick={()=>{chosenLayout=layout.id;insertOptions={};}}><SlideCanvas deck={{width:1440,height:810,fonts:deck?.fonts,onlineFonts:deck?.onlineFonts}} {slide}/><strong>{layout.name}</strong><span>{layout.description}</span></button>{/each}</div>{#if !visibleLayouts.length}<p class="hint">No layouts match. Try another task or search.</p><Button variant="quiet" onclick={()=>{taskChoice='all';layoutQuery='';}}>Clear filters</Button>{/if}{/if}
  {#if failure}<Notice tone="error" title="Template could not be prepared" message={failure}/>{/if}
{/if}
<style>
  .template-recipe{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:16px}.template-recipe label{min-width:240px;max-width:100%}.template-recipe .hint{flex:1;min-width:180px}.template-finder{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:0 0 20px}.template-finder label{flex:1;min-width:180px}.template-finder select,.template-recipe select,.template-finder input{width:100%;min-width:0}.template-behavior-bar{flex-wrap:wrap}.template-behavior-bar>span{flex:1 1 160px}
  .template-variants{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 16px}.template-variants label{font-size:var(--ui-label);display:flex;align-items:center;gap:8px}.template-variants select{min-height:36px}.template-variants .hint{flex:1;min-width:160px}@media(pointer:coarse){.template-variants select,.variant-check{min-height:44px}}
  .template-style-choice{display:flex;flex-direction:column;gap:6px;margin-bottom:20px}.template-style-choice label{max-width:360px}.template-style-choice select{width:100%;min-width:0}.template-style-choice .hint{font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary)}
  .template-collections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 20px;margin-bottom:28px}
  .template-collection{display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:8px;min-width:0;padding:8px;border-radius:var(--r-control);margin:-8px;background:transparent}
  .template-collection:focus-visible,.template-pages button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .template-cover,.template-preview{overflow:hidden;border-radius:var(--radius-sm);border:1px solid var(--border-default)}
  .template-cover :global(.canvas-wrap),.template-preview :global(.canvas-wrap){width:100%}
  .template-specimens{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 4px}
  .template-specimens :global(.canvas-wrap){border:1px solid var(--border-subtle);overflow:hidden;border-radius:var(--radius-sm)}
  .template-collection-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
  .template-collection-heading strong{font-size:var(--ui-body);font-weight:600}
  .template-collection-heading span,.template-collection small,.template-detail-title small{font-size:var(--ui-meta);color:var(--text-secondary)}
  .template-collection p{font-size:var(--ui-label);color:var(--text-secondary);line-height:var(--ui-line-reading);margin:0}
  .template-blank{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--border-subtle);padding-top:20px;font-size:var(--ui-label);color:var(--text-secondary)}
  .template-start-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 24px}
  .template-detail-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;position:sticky;top:0;z-index:3;background:var(--surface-top);padding-block:8px;border-bottom:1px solid var(--border-subtle)}
  .template-detail-title{margin-bottom:20px}
.template-behavior-bar{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;margin-bottom:12px;font-size:var(--ui-meta);color:var(--text-secondary)}
  .template-detail-title h3{display:flex;gap:12px;align-items:baseline;font-size:var(--ui-title);margin-bottom:6px}
  .template-detail-title h3 span{font-size:var(--ui-label);font-weight:400;color:var(--text-secondary)}
  .template-detail-title p{font-size:var(--ui-label);line-height:var(--ui-line-reading);color:var(--text-secondary);margin:0 0 8px}
  .template-page-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;font-size:var(--ui-label);color:var(--text-secondary)}
  .template-pages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 12px;padding:4px}
  .template-pages button{display:flex;flex-direction:column;gap:8px;min-width:0;text-align:left;border-radius:var(--r-control);padding:4px}
  .template-pages button>div{width:100%;min-width:0}.template-variants .variant-check{white-space:nowrap;flex:none}
  .template-pages :global(.canvas-wrap){width:100%;border:1px solid var(--border-default);border-radius:var(--radius-sm);overflow:hidden}
  .template-pages button.chosen{background:var(--state-selected);outline:1px solid var(--border-strong)}
  .template-pages span{font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary)}
  @media(hover:hover) and (pointer:fine){.template-collection:hover,.template-pages button:hover{background:var(--state-hover)}}
  @media(max-width:760px),(pointer:coarse){.template-style-choice select{min-height:44px}}
  @media(max-width:600px){.template-collections{grid-template-columns:1fr;gap:28px}.template-pages{grid-template-columns:repeat(2,minmax(0,1fr))}.template-collection-heading{flex-wrap:wrap;gap:4px 12px}.template-detail-title h3{flex-wrap:wrap}.template-blank{flex-wrap:wrap}}
</style>
