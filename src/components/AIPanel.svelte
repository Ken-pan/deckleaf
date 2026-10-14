<script lang="ts">
  import {slideLabel} from '../core/slide-label';
  import {tick,onDestroy,untrack} from 'svelte';
  import { countLabel } from "../core/ui-copy";
  import { uiPresence, uiDisclosure } from '../ui-motion';
  import { Button, ActionMenu} from './ui';
  import Notice from './ui/Notice.svelte';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  import { CornerDownLeft, Check, X, Settings2, Ellipsis, ChevronLeft, ChevronRight, ChevronDown, Sparkles } from '@lucide/svelte';
  import { editor } from '../core/editor.svelte';
  import WorkflowReview from './WorkflowReview.svelte';
  import type {WorkflowOutcome,WorkflowRequest,AIInformation} from '../core/workflows';
  import {readAISession,saveAISession,appendAIHistory,type AIHistory} from '../core/ai-session';
  import {requestAI} from '../core/ai-client';
  import { applyOperations, ProposalSchema } from '../core/operations';
  import {proposalReviewRange,proposalReviewChanges} from '../core/proposal-review';
  import ProposalChange from './ProposalChange.svelte';
  import type { AISettings } from '../../server/ai';
  let {workflow,onworkflow,onrunworkflow,ondismissworkflow,settings, sessionVersion=0,onsettings, onpreview, preview = false, serverConfigured=false,active=true}: {workflow?:WorkflowRequest|null;onworkflow?:(outcome:WorkflowOutcome)=>void;onrunworkflow?:()=>void;ondismissworkflow?:()=>void;settings: AISettings;sessionVersion?:number;serverConfigured?:boolean;active?:boolean; onsettings: () => void; onpreview: () => void; preview?: boolean} = $props();
  let modelReady=$derived(Boolean(settings.model.trim())&&(settings.provider==='compatible'||Boolean(settings.apiKey?.trim())||serverConfigured));
  let root=$state<HTMLDivElement>();
  let prompt = $state(''); let scope = $state('slide'); let busy = $state(false); let error = $state('');
  let information=$state<AIInformation>();
  let status=$state('');let controller:AbortController|undefined;let requestDeckId=$state('');
  function cancel(){controller?.abort();controller=undefined;busy=false;requestDeckId='';status='Stopped. Your request is kept.';}
  onDestroy(()=>controller?.abort());
  $effect(()=>{if(busy&&requestDeckId&&editor.deck?.id!==requestDeckId)cancel();});
  const selection=$derived(editor.selection.filter(item=>!item.locked));
  let history=$state<AIHistory>([]),submittedPrompt='';let documentId='',loadedVersion=0;
  $effect(()=>{const id=editor.deck?.id??'',version=sessionVersion;untrack(()=>{if(id===documentId&&version===loadedVersion)return;loadedVersion=version;if(controller)cancel();const draft=readAISession(id);prompt=draft.prompt;scope=draft.scope;history=draft.history;submittedPrompt='';status='';error='';information=undefined;documentId=id;});});
  $effect(()=>{const id=editor.deck?.id??'';if(id&&id===documentId)saveAISession(id,{prompt,scope,history});});
  function remember(summary:string,result:AIHistory[number]['status']){history=appendAIHistory(history,submittedPrompt||prompt||summary,summary,result,editor.deck?.revision??0);}
  let requestInput = $state<HTMLTextAreaElement>();
  let context = $derived(scope === 'selection' ? countLabel(selection.length, 'editable object') : scope === 'deck' ? countLabel(editor.deck?.slides.length ?? 0, 'slide') : slideLabel(editor.deck?.slides.findIndex(s=>s.id===editor.slide?.id)??0));
  const suggestions: {label:string;prompt:string;scope?:string}[] = [
    {label:'Shorten the copy', prompt:'Shorten this slide while keeping the key insight and evidence'},
    {label:'Clarify the narrative', prompt:'Clarify the narrative and connect each point to its evidence'},
    {label:'Add speaker notes', prompt:'Add concise speaker notes to this slide'},
    {label:'Improve the layout',prompt:'Improve the spacing and alignment while preserving all content, sources and local styles'},
    {label:'Replace artwork',scope:'slide',prompt:'Read the existing icons and illustrations on this slide, choose suitable replacements from our resource library in a matching visual style, and replace them while preserving their frames, groups, colors and attribution'},
    {label:'Export HTML',scope:'deck',prompt:'Export the accepted document as a standalone HTML presentation'},
    {label:'Start presenting',prompt:'Start the presentation from the current slide'},
    {label:'Prepare a website',scope:'deck',prompt:'Prepare a standalone presentation website, excluding speaker notes'},
    {label:'Style the document',scope:'deck',prompt:'Refine the document design system for a clear professional hierarchy, preserving source content and local overrides'},
  ];
  $effect(() => { if (scope === 'selection' && !selection.length && !busy) scope = 'slide'; });
  function useSuggestion(value: string, targetScope?:string) { if(busy)return;prompt = value;if(targetScope)scope=targetScope;requestInput?.focus(); }
  let acting = $state<'apply' | 'dismiss' | ''>('');
  let reviewPage=$state(0),reviewBody=$state<HTMLDivElement>();
  const reviewRange=$derived(proposalReviewRange(editor.pending?.operations.length??0,reviewPage));
  let changes = $derived(active&&editor.pending&&editor.deck?proposalReviewChanges(editor.deck,editor.pending,reviewRange.page):[]);
  $effect(()=>{editor.pending;reviewPage=0;});
  function showChanges(page:number){reviewPage=page;reviewBody?.scrollTo({top:0});}
  let stale = $derived(Boolean(editor.pending && editor.pending.baseRevision !== editor.deck?.revision));
  let validationError = $derived.by(() => {
    if (!active || !editor.pending || !editor.deck || stale) return '';
    try { applyOperations(editor.operationDocument(), editor.pending.operations, editor.pending.baseRevision, 'ai'); return ''; }
    catch { return 'This proposal contains changes that cannot be applied. Generate a new proposal.'; }
  });
  let needsRegeneration = $derived(stale || Boolean(validationError));
  async function proposalAction(action: 'apply' | 'dismiss') {
    if (acting || !editor.pending) return;
    const focusOrigin=document.activeElement;
    const focusHere=root?.contains(focusOrigin);
    const proposal=editor.pending;acting = action; error = '';
    try { if (action === 'apply') await editor.acceptProposal(); else await editor.dismissProposal();
      if(action==='apply'&&editor.pending===proposal)throw new Error(editor.error||'The changes could not be applied. Generate a new proposal.');
      remember(proposal.summary,action==='apply'?'applied':'discarded');if(action==='apply'){prompt='';submittedPrompt='';status='Changes applied. Continue with a follow-up request.';}
      await tick();
      if (!editor.pending && focusHere && (document.activeElement === document.body || document.activeElement === focusOrigin)) requestInput?.focus({preventScroll:true});
    }
    catch (failure: any) { error = failure.message; }
    finally { acting = ''; }
  }
  async function generate() {
    if (!editor.deck || busy || editor.pending || !prompt.trim() || (scope === 'selection' && !selection.length)) return;
    if(!modelReady){error='Choose a model and configure any required credentials first.';return;}
    busy = true; error = '';status='Reading the selected context…';
    const run=new AbortController();controller=run;requestDeckId=editor.deck.id;
    const requestedDocument=editor.deck.id,requestedRevision=editor.deck.revision;
    const requestScope={slideIds:scope==='deck'?editor.deck.slides.map(slide=>slide.id):[editor.slide!.id],elementIds:scope==='selection'?selection.map(item=>item.id):[]};
    try {
      await editor.flush();
      if(run.signal.aborted||controller!==run||editor.deck?.id!==requestedDocument)return;
      if(editor.dirty)throw new Error('Save the document before requesting AI actions.');
      if(editor.deck.revision!==requestedRevision)throw new Error('The document changed while saving. Generate the proposal again.');
      const deck = editor.snapshot();submittedPrompt=prompt;
      const p = await requestAI({deck, prompt, settings, scope:requestScope,history},{signal:run.signal,onprogress:event=>{if(controller===run&&!run.signal.aborted&&editor.deck?.id===deck.id){status=event.message;}}});
      if(run.signal.aborted||editor.deck?.id!==deck.id)return;
      const focusHere = root?.contains(document.activeElement);
      if('kind' in p){if(p.kind==='information'){information=p;remember(p.message,'information');}else{remember(p.request.action.kind+' action requested','queued');onworkflow?.(p);}prompt='';return;}
      editor.pending = ProposalSchema.parse(p); editor.pendingId = '';
      await tick();
      if (focusHere && (document.activeElement === document.body || root?.contains(document.activeElement))) root?.querySelector<HTMLElement>('.ai-preview')?.focus({preventScroll:true});
    } catch (e: any) { if(!run.signal.aborted)error=e.name==='TimeoutError'?'The model took too long. Reduce the scope and try again.':e.message; }
    finally { if(controller===run){controller=undefined;busy=false;requestDeckId='';} }
  }
</script>
<div bind:this={root} class="ai-panel" data-review={Boolean(editor.pending)}>
  {#if information}<section class="ai-information" aria-label="AI response"><p>{information.message}</p>{#if information.receipt?.result}<Notice tone="info" title={information.receipt.status==='completed'?'Completed action':'Action status'} message={information.receipt.result.message}/>{/if}<Button onclick={()=>information=undefined}>Done</Button></section>
  {:else if workflow}<WorkflowReview request={workflow} onrun={()=>onrunworkflow?.()} ondismiss={()=>ondismissworkflow?.()}/>
  {:else if editor.pending}
    <!-- Scrollable proposal text needs a keyboard stop before the fixed actions. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="ai-preview" bind:this={reviewBody} in:uiPresence role="region" tabindex="0" aria-label="AI change details">
      <div class="ai-review-heading"><div class="section-label"><span>Change preview</span><span>{countLabel(editor.pending.operations.length, "change")}</span></div>{#if reviewRange.pages>1}<nav class="ai-review-pages" aria-label="Proposal changes"><Button variant="quiet" aria-label="Previous changes" disabled={reviewRange.page===0} onclick={()=>showChanges(reviewRange.page-1)}><ChevronLeft size={16}/></Button><span role="status">{reviewRange.start+1}–{reviewRange.end} of {editor.pending.operations.length}</span><Button variant="quiet" aria-label="Next changes" disabled={reviewRange.page===reviewRange.pages-1} onclick={()=>showChanges(reviewRange.page+1)}><ChevronRight size={16}/></Button></nav>{/if}</div>
      <p class="ai-summary">{editor.pending.summary}</p>
      {#each changes as change,index (reviewRange.start+index)}<ProposalChange {change}/>{/each}
      {#if stale}<Notice tone="warning" title="Proposal needs an update" message="The document has changed. Edit the request and generate a new proposal."/>{/if}
      {#if validationError}<Notice tone="error" message={validationError}/>{/if}
    </div>
    <div class="ai-review-actions">
      {#if error}<Notice tone="error" title="Proposal action failed" message={error}/>{/if}
      {#if needsRegeneration}<Button variant="primary" busy={acting === 'dismiss'} onclick={() => proposalAction('dismiss')}>Edit request</Button>
      {:else}<div class="ai-review-buttons"><Button variant={preview ? 'secondary' : 'primary'} disabled={Boolean(acting)} aria-label={preview ? "Exit preview and return to the current version" : "Preview changes"} onclick={onpreview}>{preview ? 'Exit preview' : 'Preview'}</Button><Button variant={preview ? 'primary' : 'secondary'} busy={acting === 'apply'} disabled={acting === 'dismiss'} onclick={() => proposalAction('apply')}><Check size={15} />Apply changes</Button></div>{/if}
      <div class="ai-review-secondary">{#if !needsRegeneration}<Button variant="quiet" size="sm" disabled={Boolean(acting)} onclick={()=>proposalAction('dismiss')}>Refine request</Button>{/if}<ActionMenu label="Proposal actions" iconOnly disabled={Boolean(acting)} items={[{label:'Discard proposal',icon:X,tone:'danger',onselect:()=>proposalAction('dismiss') }]}><Ellipsis size={16}/></ActionMenu></div>
      <p class="hint">Check content and sources. ⌘Z to undo.</p>
    </div>
  {:else}
    <div class="ai-request-body">
      <div class="ai-request-heading"><h3><Sparkles size={16} aria-hidden="true"/>Ask AI</h3></div>
      <div class="ai-compose">
        <div class="field-label"><span>Apply to</span><PropertyChoice label="AI edit scope" value={scope} disabled={busy} options={[{value:'selection',label:'Selection',disabled:!selection.length},{value:'slide',label:'This slide'},{value:'deck',label:'All slides'}]} onchange={value=>scope=value}/>
        <p class="hint ai-scope-context" aria-live="polite">{context}</p></div>
        <label class="field-label">Request<textarea bind:this={requestInput} aria-label="AI edit request" placeholder="Shorten this slide, adjust the layout, or add notes…" bind:value={prompt} readonly={busy} aria-disabled={busy} maxlength="10000" rows="5" onkeydown={(e) => { if(busy&&e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();} if (!e.isComposing && e.keyCode !== 229 && !e.repeat && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void generate(); } }}></textarea></label>
      </div>
      {#if history.length}<details class="ai-request-help" use:uiDisclosure><summary><span>Recent requests · {history.length}</span><ChevronDown size={14} aria-hidden="true"/></summary><ol class="ai-history">{#each history.slice().reverse() as turn}<li><span class="hint">{turn.status==='applied'?'Applied':turn.status==='queued'?'Action requested':turn.status==='discarded'?'Discarded':'Answered'}</span><p>{turn.summary}</p><button class="text-btn" disabled={busy} onclick={()=>useSuggestion(turn.prompt)}>Use request</button></li>{/each}</ol><Button disabled={busy} onclick={()=>history=[]}>Clear AI history</Button><p class="hint">Saved in this browser.</p></details>{/if}
      {#if !modelReady&&settings.model}<p class="hint">Add an API key in AI settings.</p>{/if}
      <details class="ai-request-help" use:uiDisclosure><summary><span>Examples</span><ChevronDown size={14} aria-hidden="true"/></summary>
        <div class="ai-suggestions">{#each suggestions as suggestion}<button disabled={busy} title={suggestion.prompt} onclick={() => useSuggestion(suggestion.prompt,suggestion.scope)}>{suggestion.label}<CornerDownLeft size={14} /></button>{/each}</div>
        
      </details>
      <details class="ai-request-help" use:uiDisclosure><summary><span>Privacy</span><ChevronDown size={14} aria-hidden="true"/></summary><p class="hint">Text, notes, layout, and resource details in this scope go to your model provider. Image and font files stay local.</p></details>
    </div>
    <div class="ai-request-actions">
    {#if error}<Notice tone="error" title="AI request failed" message={error}/>{/if}
    <button class="text-btn ai-model-action" disabled={busy} onclick={onsettings} aria-label={settings.model ? `${settings.model} · AI model settings` : "Choose model in AI settings"} title={settings.model || 'Choose model'}><Settings2 size={14} /><span>{settings.model || 'Choose model'}</span></button>
    <Button variant="primary" busy={busy} onclick={generate} disabled={!modelReady || Boolean(acting) || !prompt.trim() || (scope === 'selection' && !selection.length)} aria-label={error?'Retry request':'Run request with AI'}>{error?'Retry request':'Run request'}</Button>
    {#if busy}<Button onclick={cancel}>Stop</Button>{/if}
    <p class="hint ai-progress" role="status" aria-live="polite">{busy ? status : status.startsWith('Stopped') ? status : '⌘Enter to run'}</p>
    </div>
  {/if}
</div>
<style>
  .ai-panel{overflow:hidden}
  .ai-history{list-style:none;padding:0;margin:8px 0}.ai-history li{padding:12px 0;border-bottom:1px solid var(--border-subtle)}.ai-history p{font-size:var(--ui-label);margin:6px 0;overflow-wrap:anywhere}
  .ai-information{padding:16px 12px;display:flex;flex-direction:column;gap:16px;overflow:auto}.ai-information p{white-space:pre-wrap;overflow-wrap:anywhere}
  .ai-request-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px;scrollbar-width:thin}
  .ai-request-heading h3{display:flex;align-items:center;gap:8px;font-size:var(--ui-label);font-weight:var(--ui-weight-semibold);margin:0 0 4px}.ai-request-heading h3 :global(svg){flex:none;color:var(--text-secondary)}
  .ai-request-heading{margin-bottom:16px}
  .ai-compose{display:flex;flex-direction:column;gap:16px;padding:0;border:0;margin:0}
  .ai-compose .field-label{margin:0;gap:4px}
  .ai-compose textarea{min-height:140px;resize:vertical;max-height:360px}
  .ai-scope-context{overflow-wrap:anywhere;margin:0;font-size:var(--ui-meta)}
  .ai-request-help{margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:8px}
  .ai-request-help summary{display:flex;align-items:center;gap:8px;min-height:32px;list-style:none;cursor:pointer;color:var(--text-secondary);font-size:var(--ui-label);border-radius:var(--r-sm)}.ai-request-help summary::-webkit-details-marker{display:none}.ai-request-help summary span{flex:1;min-width:0}.ai-request-help summary :global(svg){flex:none}.ai-request-help[open]>summary :global(svg){rotate:180deg}.ai-request-help summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}.ai-request-help .hint{margin-top:8px}
  .ai-suggestions{padding:0;gap:4px;margin-block:8px 12px}
  .ai-suggestions button{padding:8px 0;border:0;border-radius:var(--r-sm);background:none;gap:8px;min-height:36px;font-size:var(--ui-text)}
  @media(hover:hover) and (pointer:fine){.ai-suggestions button:not(:disabled):hover{background:var(--state-hover)}}
  .ai-suggestions button:not(:disabled):active{background:var(--state-active)}
  .ai-request-actions{flex:none;padding:12px;border-top:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:8px;background:var(--surface-chrome)}
  .ai-request-actions>.hint{text-align:center;font-size:var(--ui-meta)}
  .ai-model-action{justify-content:flex-start;min-width:0;color:var(--text-secondary)}
  .ai-model-action span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ai-review-buttons{grid-template-columns:1fr}
  .ai-review-heading{position:sticky;top:0;z-index:1;background:var(--surface-chrome);padding-bottom:8px;border-bottom:1px solid var(--border-subtle)}
  .ai-review-pages{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;font-size:var(--ui-meta);color:var(--text-secondary);font-variant-numeric:tabular-nums}
  .ai-review-pages :global(button){flex:none;min-width:36px;padding:8px}
  .ai-review-heading .section-label{flex-wrap:wrap;gap:4px 8px;align-items:baseline}
  .ai-review-pages span{flex:1;min-width:0;text-align:center;overflow-wrap:anywhere}
  .ai-review-secondary{display:flex;justify-content:space-between;gap:8px;align-items:center}
  .ai-review-actions{padding:12px;gap:8px}
  .ai-preview{padding:12px}
  @media(max-width:760px),(pointer:coarse){.ai-request-help summary,.ai-suggestions button,.ai-request-actions :global(button),.ai-review-actions :global(button),.ai-review-pages :global(button){min-height:44px}.ai-review-pages :global(button){min-width:44px}}
</style>
