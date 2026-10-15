<script lang="ts">
  import {onMount,tick,untrack} from 'svelte';
  import {X,ChevronLeft,ChevronRight} from '@lucide/svelte';
  import {Button} from './ui';
  import {editor} from '../core/editor.svelte';
  import {chartFromElement,type Chart} from '../core/charts';
  import {chartTextValue,chartTextLabel,chartWithText,type ChartTextTarget} from '../core/chart-text';
  import {positionFloating} from '../ui-viewport';
  import {popoverFocus} from '../ui-focus';
  import {focusAfterChartRedraw} from '../ui-chart-focus';
  let {elementId,target,anchor,onpreview,onclose}:{elementId:string;target:ChartTextTarget;anchor:(target:ChartTextTarget)=>HTMLElement|undefined;onpreview:(chart:Chart|null)=>void;onclose:()=>void}=$props();
  const deckId=editor.deck!.id,slideId=editor.slide!.id,origin=document.activeElement as HTMLElement|null;
  let revision=$state(editor.deck!.revision),location=$state(untrack(()=>target)),raw=$state(''),error=$state(''),popup=$state<HTMLDivElement>(),input=$state<HTMLInputElement>();
  let closing=false,frame=0;
  const element=$derived(editor.slide?.elements.find(e=>e.id===elementId)),chart=$derived(element?chartFromElement(element):undefined);
  const stale=$derived(editor.deck?.id!==deckId||editor.slide?.id!==slideId||editor.deck?.revision!==revision||!element||element.locked);
  const analysis=$derived.by(()=>{try{return {chart:chart?chartWithText(chart,location,raw):undefined,error:''};}catch(e){return {chart:undefined,error:(e as Error).message};}});
  const count=$derived(chart?(location.kind==='category'?chart.labels.length:location.kind==='series'?chart.series.length:0):0);
  const maxLength=$derived(location.kind==='title'?200:['subtitle','source'].includes(location.kind)?300:location.kind.endsWith('Title')?80:100);
  $effect(()=>onpreview(stale?null:analysis.chart??null));
  function position(){const node=anchor(location);if(popup?.matches(':popover-open')&&node)positionFloating(popup,node.getBoundingClientRect(),{preferredHeight:popup.scrollHeight,minHeight:150,avoid:node.getBoundingClientRect()});}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  async function activate(){raw=chart?chartTextValue(chart,location)??'':'';error='';await tick();position();input?.focus({preventScroll:true});input?.select();}
  function commit(){if(stale||!analysis.chart){error=stale?'The document changed. Close and reopen this text.':analysis.error;return false;}if(JSON.stringify(chart)!==JSON.stringify(analysis.chart)){const before=editor.deck!.revision;editor.commit([{op:'update_element',slideId,elementId,patch:{chart:analysis.chart,values:undefined}}],'','manual',revision);if(before===editor.deck!.revision){error=editor.error;return false;}revision=editor.deck!.revision;}onpreview(null);return true;}
  function close(cancel=false,focus=true){if(closing||!cancel&&!commit())return;closing=true;onpreview(null);popup?.hidePopover();onclose();if(focus)queueMicrotask(()=>focusAfterChartRedraw(anchor(location),origin));}
  async function move(delta:number){if(!commit())return;location={...location,index:(location.index??0)+delta};await activate();}
  onMount(()=>{popup!.showPopover();void activate();const observer=new ResizeObserver(schedule);observer.observe(popup!);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.addEventListener('deck-studio-chart-rendered',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);return()=>{closing=true;onpreview(null);popup?.hidePopover();observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.removeEventListener('deck-studio-chart-rendered',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};});
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={popup} popover="auto" role="dialog" aria-label="Edit chart text" tabindex="-1" class="chart-text-editor" use:popoverFocus={{close:()=>close(false,false),origin:()=>anchor(location),focus:focusAfterChartRedraw}} onbeforetoggle={e=>{if(e.newState==='closed'&&!closing&&!commit())queueMicrotask(()=>popup?.showPopover());else if(e.newState==='closed'&&!closing)close(true,false);}} onkeydown={e=>{if(e.isComposing||e.keyCode===229)return;e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close(true);}else if(e.key==='Enter'&&!e.altKey&&!e.metaKey&&!e.ctrlKey){e.preventDefault();close();}}}>
  <header><strong>{chartTextLabel(location)}</strong><div>{#if count}<Button variant="quiet" aria-label="Previous chart label" disabled={(location.index??0)===0||stale} onclick={()=>move(-1)}><ChevronLeft size={16}/></Button><Button variant="quiet" aria-label="Next chart label" disabled={(location.index??0)>=count-1||stale} onclick={()=>move(1)}><ChevronRight size={16}/></Button>{/if}<Button variant="quiet" aria-label="Cancel chart text edit" onclick={()=>close(true)}><X size={16}/></Button></div></header>
  <label class="field-label">Text<input bind:this={input} aria-label={chartTextLabel(location)} value={raw} maxlength={maxLength} disabled={stale} aria-invalid={Boolean(error||analysis.error)} oninput={e=>{raw=e.currentTarget.value;error='';}}/></label>
  {#if stale||error||analysis.error}<p class="error" role="alert">{error||(stale?'The document changed. Close and reopen this text.':analysis.error)}</p>{/if}
  <footer><small>Enter saves · Esc cancels</small><Button variant="secondary" disabled={stale||!analysis.chart} onclick={()=>close()}>Done</Button></footer>
</div>
<style>.chart-text-editor{position:fixed;inset:auto;margin:0;width:min(320px,calc(100vw - 24px));padding:12px;box-sizing:border-box;border:1px solid var(--component-border);border-radius:var(--r-popover);background:var(--dialog-surface);color:var(--text-primary);box-shadow:var(--shadow-popover);display:flex;flex-direction:column;gap:12px;overflow:auto}.chart-text-editor header,.chart-text-editor footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.chart-text-editor header>div{display:flex;gap:4px}.chart-text-editor strong{font-size:var(--ui-label)}header :global(button){min-width:32px;min-height:32px;padding:4px}.field-label{margin:0;gap:4px}.field-label input{width:100%;min-height:36px}.chart-text-editor small{font-size:var(--ui-meta);color:var(--text-secondary)}.error{font-size:var(--ui-meta);color:var(--danger-text);margin:0}@media(pointer:coarse),(max-width:760px){header :global(button),footer :global(button),.field-label input{min-width:44px;min-height:44px}.field-label input{font-size:max(16px,var(--ui-body))}}</style>
