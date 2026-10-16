<script lang="ts">
 import {onDestroy,tick} from 'svelte';
 import {Button,DialogFooter} from './ui';
 import Notice from './ui/Notice.svelte';
 import PropertyChoice from './ui/PropertyChoice.svelte';
 import SlideCanvas from './SlideCanvas.svelte';
 import SlideThumbnail from './SlideThumbnail.svelte';
 import {ChevronLeft,ChevronRight,Settings2} from '@lucide/svelte';
 import {requestAI} from '../core/ai-client';
 import {CreationBriefSchema,type CreationBrief} from '../core/ai-story';
 import {createAIBase,creationPreview} from '../core/ai-story-builder';
 import {reviewPresentation,slideHeading} from '../core/presentation-review';
 import type {AICreationState} from '../core/ai-creation-state';
 import type {AISettings} from '../../server/ai';
 import type {Deck} from '../core/model';
 import type {Proposal} from '../core/operations';
 let {state:creation=$bindable(),settings,serverConfigured=false,onsettings,oncreate}:{state:AICreationState;settings:AISettings;serverConfigured?:boolean;onsettings:()=>void;oncreate:(base:Deck,proposal:Proposal,request:string)=>Promise<void>}=$props();
 let busy=$state(false),saving=$state(false),editing=$state(false),error=$state(''),status=$state(''),view=$state('slide');
 let controller:AbortController|undefined;
 let ready=$derived(Boolean(settings.model.trim())&&(settings.provider==='compatible'||serverConfigured||Boolean(settings.apiKey?.trim())));
 const briefInput=():CreationBrief=>CreationBriefSchema.parse({brief:creation.brief,audience:creation.audience,goal:creation.goal,delivery:creation.delivery??'presentation',slideCount:Number(creation.slideCount),collection:creation.collection,templateMode:creation.templateMode,materials:creation.materials});
 let preview=$derived.by(()=>creation.base&&creation.proposal?creationPreview(creation.base,creation.proposal,creation.draftBrief??briefInput()):null);
 let report=$derived(preview?reviewPresentation(preview):null);
 let page=$derived(preview?.slides[Math.min(creation.page,preview.slides.length-1)]);
 let heading=$state<HTMLHeadingElement>();
 let briefField=$state<HTMLTextAreaElement>();
 let previewHost=$state<HTMLDivElement>();
 const themes=[{id:'review',name:'Studio'},{id:'portfolio',name:'Editorial'},{id:'proposal',name:'Monograph'},{id:'pitch',name:'Signal'},{id:'report',name:'Ledger'},{id:'minimal',name:'Minimalist'}] as const;
 function cancel(){controller?.abort();controller=undefined;busy=false;status='Stopped. Your brief and previous draft are kept.';}
 onDestroy(()=>controller?.abort());
 async function generate(){
  if(busy||!ready||!creation.brief.trim())return;
  const run=new AbortController();controller=run;busy=true;error='';status='Planning the story…';
  try{
   const brief=briefInput(),base=await createAIBase(brief.collection);
   const result=await requestAI({deck:base,prompt:brief.brief,settings,scope:{slideIds:[base.slides[0].id],elementIds:[]},creation:brief},{signal:run.signal,onprogress:event=>{if(controller===run)status=event.message;}});
   run.signal.throwIfAborted();
   if('kind' in result)throw Error('AI did not return a complete document proposal. Edit the brief and try again.');
   creationPreview(base,result,brief);
   creation.draftBrief=brief;creation.base=base;creation.proposal=result;creation.page=0;editing=false;view='overview';status='';
   await tick();heading?.focus({preventScroll:true});
  }catch(e:any){if(!run.signal.aborted)error=e.message;}
  finally{if(controller===run){controller=undefined;busy=false;}}
 }
 async function accept(){if(!creation.base||!creation.proposal||saving||busy)return;saving=true;error='';try{await oncreate(creation.base,creation.proposal,creation.draftBrief?.brief??creation.brief);}catch(e:any){error=e.message;}finally{saving=false;}}
 async function revise(){editing=true;error='';status='';await tick();briefField?.focus({preventScroll:true});}
 async function returnToDraft(){editing=false;error='';status='';await tick();heading?.focus({preventScroll:true});}
 async function showSlide(index:number){creation.page=index;view='slide';await tick();previewHost?.focus({preventScroll:true});}
 function navigate(event:KeyboardEvent){if(!preview||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();creation.page=event.key==='Home'?0:event.key==='End'?preview.slides.length-1:Math.max(0,Math.min(preview.slides.length-1,creation.page+(event.key==='ArrowRight'?1:-1)));}
</script>
<div class="ai-create">
 {#if preview&&!editing&&page}
  <div class="ai-create-review">
   <div class="ai-create-review-heading"><h3 bind:this={heading} tabindex="-1">{preview.title}</h3><p class="hint">{preview.slides.length} slides · {preview.designSystem?.name??'Native templates'} · {report?.notesCount} with speaker notes</p></div>
   <PropertyChoice label="Draft view" value={view} options={[{value:'overview',label:'Overview'},{value:'slide',label:'Slide preview'}]} onchange={value=>view=value}/>
   {#if view==='overview'}
    <ol class="ai-create-storyboard" aria-label="Draft slides">{#each preview.slides as slide,i}<li><button aria-label={`Preview slide ${i+1}: ${slideHeading(slide)}`} onclick={()=>showSlide(i)}><SlideThumbnail deck={preview} {slide}/><span><span class="ai-create-page-number">{i+1}</span>{slideHeading(slide)}</span></button></li>{/each}</ol>
   {:else}
    <!-- Keyboard carousel navigation is available independently of the page buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="ai-create-preview" bind:this={previewHost} role="region" aria-roledescription="carousel" tabindex="0" onkeydown={navigate} aria-label={`AI draft preview · Slide ${creation.page+1}. Use arrow keys to change slides.`}><SlideCanvas deck={preview} slide={page}/></div>
    <div class="ai-create-navigation"><Button kind="icon" aria-label="Previous draft slide" disabled={!creation.page} onclick={()=>creation.page--}><ChevronLeft size={18}/></Button><span role="status">{creation.page+1} / {preview.slides.length}</span><Button kind="icon" aria-label="Next draft slide" disabled={creation.page===preview.slides.length-1} onclick={()=>creation.page++}><ChevronRight size={18}/></Button></div>
    {#if page.notes}<details class="ai-create-notes" open><summary>Speaker notes</summary><p>{page.notes}</p></details>{/if}
   {/if}
   {#if creation.draftBrief?.delivery!=='reading'&&report?.issues.length}<details class="ai-create-checks"><summary>{report.issues.length} presentation {report.issues.length===1?'suggestion':'suggestions'}</summary><ul>{#each report.issues as issue}<li><button onclick={()=>showSlide(issue.number-1)}>Slide {issue.number}</button><span>{issue.message}</span></li>{/each}</ul><p class="hint">These checks flag copy and structure. Review facts and visual fit before presenting.</p></details>{/if}
   {#if creation.proposal?.reviewWarnings?.length}<details class="ai-create-checks" open><summary>Draft review needs attention · {creation.proposal.reviewWarnings.length}</summary><p class="hint">These are AI review suggestions, not verified findings. Compare them with your material.</p><ul>{#each creation.proposal.reviewWarnings as issue}<li><button onclick={()=>showSlide(issue.slide-1)}>Slide {issue.slide}</button><span>{issue.problem}{#if issue.evidence}<br/><q>{issue.evidence}</q>{/if}</span></li>{/each}</ul></details>{/if}
   <p class="hint">Review the story, sources, and visual fit. All slides remain editable.</p>
  </div>
 {:else}
  <div class="ai-create-brief">
   <label class="field-label">Document brief<textarea bind:this={briefField} aria-label="Document brief" bind:value={creation.brief} maxlength="10000" rows="4" readonly={busy} placeholder="What is the deck about? Describe the story, key points, and tone you want." onkeydown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();void generate();}}}></textarea></label>
   <div class="ai-create-purpose"><label class="field-label">Audience<input aria-label="Audience" bind:value={creation.audience} maxlength="300" disabled={busy} placeholder="Who will see this?"/></label><label class="field-label">Desired outcome<input aria-label="Desired outcome" bind:value={creation.goal} maxlength="500" disabled={busy} placeholder="What should they remember or decide?"/></label></div>
   <div class="ai-create-delivery"><span class="field-label">How will this deck be used?</span><PropertyChoice label="Deck use" value={creation.delivery??'presentation'} disabled={busy} options={[{value:'presentation',label:'Present live'},{value:'reading',label:'Read and share'}]} onchange={value=>creation.delivery=value as 'presentation'|'reading'}/><p class="hint">{creation.delivery==='reading'?'Self-contained pages with more explanation and source detail.':'Concise slides with supporting detail in speaker notes.'}</p></div>
   <div class="ai-create-fields"><label class="field-label">Slides<input aria-label="Slides in the draft" type="number" min="2" max="12" bind:value={creation.slideCount} disabled={busy}/></label><label class="field-label">Visual style<select aria-label="Template family" value={creation.templateMode==='auto'?'auto':creation.collection} disabled={busy} onchange={event=>{const value=event.currentTarget.value;creation.templateMode=value==='auto'?'auto':'fixed';if(value!=='auto')creation.collection=value as typeof creation.collection;}}><option value="auto">Match my brief</option>{#each themes as theme}<option value={theme.id}>{theme.name}</option>{/each}</select></label></div>
   <details class="ai-create-materials"><summary>Source material</summary><label class="field-label"><span class="sr-only">Source material</span><textarea aria-label="Source material" bind:value={creation.materials} rows="5" maxlength="20000" readonly={busy} placeholder="Paste findings, source excerpts, or existing text. Include the facts behind any charts or quotes."></textarea></label><p class="hint">Paste source text alongside links; this step does not open linked pages.</p></details>
   <p class="hint">Your brief and sources go to your model provider.{preview?' Your previous draft is kept until a new one is ready.':''}</p>
   {#if !ready&&settings.model}<Notice tone="info" message="Add an API key in AI settings."/>{/if}
  </div>
 {/if}
 {#if error}<Notice tone="error" title="Draft could not be completed" message={error}/>{/if}
 <DialogFooter>
  {#snippet info()}{#if busy||preview||status}<p class="hint" role="status">{busy?status:preview&&!editing?'Nothing is saved until you create the document.':status}</p>{/if}{/snippet}
  {#snippet actions()}{#if preview&&!editing}<Button disabled={saving} onclick={revise}>Edit brief</Button><Button variant="primary" busy={saving} onclick={accept}>Create document</Button>{:else}{#if preview}<Button disabled={busy} onclick={returnToDraft}>Back to draft</Button>{:else}<Button disabled={busy} onclick={onsettings}><Settings2 size={16}/>{settings.model||'Choose model'}</Button>{/if}{#if busy}<Button onclick={cancel}>Stop</Button>{/if}<Button variant="primary" busy={busy} disabled={!ready||!creation.brief.trim()} onclick={generate}>{error?'Try again':preview?'Regenerate draft':'Generate draft'}</Button>{/if}{/snippet}
 </DialogFooter>
</div>
<style>
 .ai-create,.ai-create-brief,.ai-create-review{display:flex;flex-direction:column;min-width:0;gap:20px}
 .ai-create-purpose{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px}
 .ai-create-fields{display:grid;grid-template-columns:88px minmax(0,1fr);gap:16px}
 .ai-create-delivery{display:flex;flex-direction:column;gap:8px;--property-choice-height:40px}
 .ai-create textarea{resize:vertical;min-height:110px}.ai-create p.hint{margin:0}
 .ai-create summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:var(--ui-text)}
 .ai-create-materials textarea{margin:8px 0}
 .ai-create-preview{aspect-ratio:16/9;border:1px solid var(--border-default);overflow:hidden;background:var(--surface-canvas)}
 .ai-create-preview:focus-visible{outline:2px solid var(--accent-line);outline-offset:2px}
 .ai-create-preview :global(.slide-preview){width:100%;height:100%}
 .ai-create-navigation{display:flex;align-items:center;justify-content:center;gap:20px;font-size:var(--ui-label);margin-top:-12px}
 .ai-create-review-heading h3{font-size:var(--ui-title);margin:0 0 8px}
 .ai-create-storyboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 16px;list-style:none;padding:0;margin:0}
 .ai-create-storyboard button{display:flex;flex-direction:column;gap:8px;width:100%;padding:4px;text-align:left;border-radius:var(--r-control);color:var(--text-primary);font:inherit;font-size:var(--ui-label);line-height:1.5}
 .ai-create-storyboard button :global(>div){width:100%;overflow:hidden;outline:1px solid var(--border-subtle);border-radius:var(--r-sm)}
 .ai-create-storyboard button>span{display:flex;align-items:baseline;gap:8px;overflow-wrap:anywhere}
 .ai-create-page-number{color:var(--text-secondary);font-variant-numeric:tabular-nums;flex:none}
 .ai-create-notes,.ai-create-checks{border-top:1px solid var(--border-subtle)}
 .ai-create-notes p{white-space:pre-wrap;font-size:var(--ui-text);line-height:var(--ui-line-body);margin:0;overflow-wrap:anywhere}
 .ai-create-checks ul{list-style:none;padding:0;margin:0 0 12px;display:grid;gap:8px;font-size:var(--ui-label)}
 .ai-create-checks li{display:flex;gap:12px;align-items:baseline}.ai-create-checks button{flex:none;text-decoration:underline;font:inherit;padding:8px 4px;min-height:44px}
 @media(hover:hover) and (pointer:fine){.ai-create-storyboard button:hover{background:var(--state-hover)}}
 @media(max-width:600px){.ai-create-purpose{grid-template-columns:minmax(0,1fr)}.ai-create-storyboard{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 8px}.ai-create,.ai-create-brief,.ai-create-review{gap:16px}}
</style>
