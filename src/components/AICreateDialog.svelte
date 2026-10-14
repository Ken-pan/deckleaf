<script lang="ts">
 import {onDestroy,tick} from 'svelte';
 import {Button,DialogFooter} from './ui';
 import Notice from './ui/Notice.svelte';
 import SlideCanvas from './SlideCanvas.svelte';
 import {ChevronLeft,ChevronRight,Settings2} from '@lucide/svelte';
 import {requestAI} from '../core/ai-client';
 import {CreationBriefSchema} from '../core/ai-story';
 import {createAIBase,creationPreview} from '../core/ai-story-builder';
 import type {AICreationState} from '../core/ai-creation-state';
 import type {AISettings} from '../../server/ai';
 import type {Deck} from '../core/model';
 import type {Proposal} from '../core/operations';
 let {state:creation=$bindable(),settings,serverConfigured=false,onsettings,oncreate}:{state:AICreationState;settings:AISettings;serverConfigured?:boolean;onsettings:()=>void;oncreate:(base:Deck,proposal:Proposal,request:string)=>Promise<void>}=$props();
 let busy=$state(false),saving=$state(false),error=$state(''),status=$state('');let controller:AbortController|undefined;
 let ready=$derived(Boolean(settings.model.trim())&&(settings.provider==='compatible'||serverConfigured||Boolean(settings.apiKey?.trim())));
 let preview=$derived.by(()=>creation.base&&creation.proposal?creationPreview(creation.base,creation.proposal,CreationBriefSchema.parse({brief:creation.brief,audience:creation.audience,slideCount:creation.slideCount,collection:creation.collection,templateMode:creation.templateMode,materials:creation.materials})):null);
 let heading=$state<HTMLHeadingElement>();
 const themes=[{id:'review',name:'Studio'},{id:'portfolio',name:'Editorial'},{id:'proposal',name:'Monograph'},{id:'pitch',name:'Signal'},{id:'report',name:'Ledger'},{id:'minimal',name:'Minimalist'}] as const;
 function cancel(){controller?.abort();controller=undefined;busy=false;status='Stopped. Your brief is kept.';}
 onDestroy(()=>controller?.abort());
 async function generate(){if(busy||!ready||!creation.brief.trim())return;const run=new AbortController();controller=run;busy=true;error='';status='Planning the story…';try{const brief=CreationBriefSchema.parse({brief:creation.brief,audience:creation.audience,slideCount:Number(creation.slideCount),collection:creation.collection,templateMode:creation.templateMode,materials:creation.materials}),base=await createAIBase(brief.collection);const result=await requestAI({deck:base,prompt:brief.brief,settings,scope:{slideIds:[base.slides[0].id],elementIds:[]},creation:brief},{signal:run.signal,onprogress:event=>{if(controller===run)status=event.message;}});run.signal.throwIfAborted();if('kind' in result)throw Error('AI did not return a complete document proposal. Edit the brief and try again.');creationPreview(base,result,brief);creation.base=base;creation.proposal=result;creation.page=0;await tick();heading?.focus({preventScroll:true});}catch(e:any){if(!run.signal.aborted)error=e.message;}finally{if(controller===run){controller=undefined;busy=false;}}}
 async function accept(){if(!creation.base||!creation.proposal||saving)return;saving=true;error='';try{await oncreate(creation.base,creation.proposal,creation.brief);}catch(e:any){error=e.message;}finally{saving=false;}}
 function revise(){creation.base=null;creation.proposal=null;error='';}
</script>
<div class="ai-create">
 {#if preview}
  <div class="ai-create-review">
   <div class="ai-create-review-heading"><h3 bind:this={heading} tabindex="-1">{preview.title}</h3><p class="hint">Review content and sources before creating.</p></div>
   <div class="ai-create-preview" aria-label={`AI draft preview · Slide ${creation.page+1}`}><SlideCanvas deck={preview} slide={preview.slides[creation.page]}/></div>
   <div class="ai-create-navigation"><Button kind="icon" aria-label="Previous draft slide" disabled={!creation.page} onclick={()=>creation.page--}><ChevronLeft size={18}/></Button><span role="status">{creation.page+1} / {preview.slides.length}</span><Button kind="icon" aria-label="Next draft slide" disabled={creation.page===preview.slides.length-1} onclick={()=>creation.page++}><ChevronRight size={18}/></Button></div>
   <details class="ai-create-outline"><summary>Slide outline</summary><ol>{#each preview.slides as slide,i}<li><button class:current={i===creation.page} aria-current={i===creation.page?'step':undefined} onclick={()=>creation.page=i}>{slide.elements.find(e=>e.name==='Slide heading')?.text??`Slide ${i+1}`}</button></li>{/each}</ol></details>
  </div>
 {:else}
  <div class="ai-create-brief">
   <label class="field-label">Document brief<textarea aria-label="Document brief" bind:value={creation.brief} maxlength="10000" rows="5" readonly={busy} placeholder="An onboarding redesign: problem, findings, changes, and next steps…" onkeydown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();void generate();}}}></textarea></label>
   <div class="ai-create-fields"><label class="field-label">Audience<input aria-label="Audience" bind:value={creation.audience} maxlength="300" disabled={busy} placeholder="Who will see this?"/></label><label class="field-label">Slides<input aria-label="Slides in the draft" type="number" min="2" max="12" bind:value={creation.slideCount} disabled={busy}/></label><label class="field-label">Template family<select aria-label="Template family" value={creation.templateMode==='auto'?'auto':creation.collection} disabled={busy} onchange={event=>{const value=event.currentTarget.value;creation.templateMode=value==='auto'?'auto':'fixed';if(value!=='auto')creation.collection=value as typeof creation.collection;}}><option value="auto">Choose for me</option>{#each themes as theme}<option value={theme.id}>{theme.name}</option>{/each}</select></label></div>
   <details class="ai-create-materials"><summary>Source material</summary><label class="field-label"><span class="sr-only">Source material</span><textarea aria-label="Source material" bind:value={creation.materials} rows="5" maxlength="20000" readonly={busy} placeholder="Paste findings, source links, or existing text."></textarea></label></details>
   <p class="hint">Your brief and sources go to your model provider.</p>
   {#if !ready&&settings.model}<Notice tone="info" message="Add an API key in AI settings."/>{/if}
  </div>
 {/if}
 {#if error}<Notice tone="error" title="Draft could not be completed" message={error}/>{/if}
 <DialogFooter>
  {#snippet info()}{#if busy||preview||status}<p class="hint" role="status">{busy?status:preview?'You can undo this later.':status}</p>{/if}{/snippet}
  {#snippet actions()}{#if preview}<Button disabled={saving} onclick={revise}>Edit brief</Button><Button variant="primary" busy={saving} onclick={accept}>Create document</Button>{:else}<Button disabled={busy} onclick={onsettings}><Settings2 size={16}/>{settings.model||'Choose model'}</Button>{#if busy}<Button onclick={cancel}>Stop</Button>{/if}<Button variant="primary" busy={busy} disabled={!ready||!creation.brief.trim()} onclick={generate}>{error?'Try again':'Generate draft'}</Button>{/if}{/snippet}
 </DialogFooter>
</div>
<style>
 .ai-create{display:flex;flex-direction:column;min-width:0;gap:20px}.ai-create-brief,.ai-create-review{display:flex;flex-direction:column;gap:20px}.ai-create-fields{display:grid;grid-template-columns:minmax(0,1fr) 88px minmax(0,160px);gap:16px}.ai-create textarea{resize:vertical;min-height:110px}.ai-create-brief>p{margin:0}.ai-create-materials summary,.ai-create-outline summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:var(--ui-text)}.ai-create-materials textarea{margin-top:8px}.ai-create-preview{aspect-ratio:16/9;border:1px solid var(--border-default);overflow:hidden;background:var(--surface-canvas)}.ai-create-preview :global(.slide-preview){width:100%;height:100%}.ai-create-navigation{display:flex;align-items:center;justify-content:center;gap:20px;font-size:var(--ui-label)}.ai-create-review-heading h3{font-size:var(--ui-title);margin:0 0 8px}.ai-create-outline ol{padding-left:24px;margin:0}.ai-create-outline button{padding:10px 8px;min-height:44px;width:100%;text-align:left;color:var(--text-secondary);font:inherit;border-radius:var(--r-control)}.ai-create-outline button:hover,.ai-create-outline button.current{background:var(--state-hover);color:var(--text-primary)}
 @media(max-width:600px){.ai-create-fields{grid-template-columns:minmax(0,1fr) 90px}.ai-create-fields>label:last-child{grid-column:1/-1}.ai-create{gap:16px}.ai-create-brief,.ai-create-review{gap:16px}}
</style>
