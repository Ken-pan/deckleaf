<script lang="ts">
  import Notice from './ui/Notice.svelte';
  import {popoverFocus,restoreFocus} from '../ui-focus';
  import { onMount,tick } from 'svelte';
  import { Ruler,X,Link,Unlink } from '@lucide/svelte';
  import { editor } from '../core/editor.svelte';
  import { pageLayout,pageLayoutOperations } from '../core/page-layout';
  import type { PageLayout } from '../core/model';
  import {nextIncrement,SNAP_INCREMENT} from '../core/numeric-increment';
  import {positionFloating} from '../ui-viewport';
  let {disabled=false}:{disabled?:boolean}=$props();
  const id=$props.id();
  let trigger=$state<HTMLButtonElement>(),popup=$state<HTMLDivElement>(),open=$state(false),linked=$state(true),error=$state('');
  const layout=$derived(editor.deck&&editor.slide?pageLayout(editor.deck,editor.slide):null);
  function position(){
    if(!popup||!trigger||!open)return;
    positionFloating(popup,trigger.getBoundingClientRect(),{preferredHeight:popup.scrollHeight,minHeight:160});
  }
  function reposition(event:Event){if(event.target instanceof Node&&popup?.contains(event.target))return;position();}
  async function toggled(event:ToggleEvent){open=event.newState==='open';if(open){error='';const m=layout?.margins;linked=Boolean(m&&m.top===m.right&&m.top===m.bottom&&m.top===m.left);await tick();if(!popup?.matches(':popover-open'))return;position();(matchMedia('(pointer:coarse)').matches?popup:popup.querySelector<HTMLInputElement>('input[type=number]')??popup)?.focus({preventScroll:true});}}
  function close(){popup?.hidePopover();restoreFocus(trigger);}
  function commit(next:PageLayout,all=false){if(!editor.deck||!editor.slide)return;error='';try{editor.commit(pageLayoutOperations(editor.operationDocument(),editor.slide.id,next,all));return true;}catch(e:any){error=e.message;return false;}}
  function numeric(event:Event,key:keyof PageLayout['margins']|'columns'|'gutter'){
    const field=event.currentTarget as HTMLInputElement|HTMLSelectElement,value=field.value.trim();if(!layout)return;const n=value?Number(value):NaN;
    const next=structuredClone($state.snapshot(layout));
    if(key==='columns'||key==='gutter')next[key]=n;else if(linked)next.margins={top:n,right:n,bottom:n,left:n};else next.margins[key]=n;
    if(!commit(next))field.value=String(key==='columns'||key==='gutter'?layout[key]:layout.margins[key]);
  }
  function preset(fraction:number){if(!layout||!editor.deck)return;const n=Math.round(Math.min(editor.deck.width,editor.deck.height)*fraction/SNAP_INCREMENT)*SNAP_INCREMENT;linked=true;commit({...layout,margins:{top:n,right:n,bottom:n,left:n}});}
  function incrementNumeric(event:KeyboardEvent){
    if(!event.shiftKey||event.metaKey||event.ctrlKey||event.altKey||event.isComposing||event.keyCode===229||!['ArrowUp','ArrowDown'].includes(event.key))return;
    const input=event.currentTarget as HTMLInputElement;if(!input.value.trim()||!Number.isFinite(input.valueAsNumber))return;
    event.preventDefault();event.stopPropagation();input.value=String(Math.max(0,nextIncrement(input.valueAsNumber,event.key==='ArrowUp'?1:-1)));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function savePreferences(){try{localStorage.setItem('deck-studio-layout-view',JSON.stringify({guides:editor.layoutGuides,snapping:editor.snapping,increment:editor.snapToIncrement}));}catch{/* view preferences are optional */}}
  function key(event:KeyboardEvent){if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();close();}}
  $effect(()=>{const slideId=editor.slide?.id;if(open){error='';if(!slideId)close();}});
  onMount(()=>{try{const stored=JSON.parse(localStorage.getItem('deck-studio-layout-view')??'{}');if(typeof stored.guides==='boolean')editor.layoutGuides=stored.guides;if(typeof stored.snapping==='boolean')editor.snapping=stored.snapping;if(typeof stored.increment==='boolean')editor.snapToIncrement=stored.increment;}catch{/* defaults */}const observer=new ResizeObserver(position);if(popup)observer.observe(popup);window.addEventListener('resize',position);window.addEventListener('scroll',reposition,true);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);return()=>{observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};});
</script>
<button bind:this={trigger} class="text-btn page-layout-trigger" aria-label="Slide layout settings · Margins and columns" title="Slide layout · Margins and columns" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} popovertarget={id} disabled={disabled||!editor.slide}><Ruler size={15}/><span>Margins and columns</span></button>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={popup} {id} use:popoverFocus={{close:()=>popup?.hidePopover(),origin:()=>trigger}} popover="auto" inert={!open} class="page-layout-popover canvas-controls-popover" role="dialog" tabindex="-1" aria-label="Slide layout settings" ontoggle={toggled} onbeforetoggle={event=>open=event.newState==='open'} onkeydown={key}>
  <header><strong>Slide layout</strong><button class="icon-btn small" aria-label="Close layout settings" onclick={close}><X size={16}/></button></header>
  {#if layout}
    <div class="layout-settings-body">
      <div class="setting-heading"><span>Slide margins <small>px</small></span><button class="icon-btn small" aria-label="Link all margins" title={linked?'Margins linked · Select to adjust individually':'Margins independent · Select to link'} aria-pressed={linked} onclick={()=>linked=!linked}>{#if linked}<Link size={15}/>{:else}<Unlink size={15}/>{/if}</button></div>
      <div class="margin-fields">{#each [['top','Top'],['right','Right'],['bottom','Bottom'],['left','Left']] as [key,label]}<label class="field-inline"><span>{label}</span><input type="number" min="0" step="any" onkeydown={incrementNumeric} aria-label={`Slide ${label.toLowerCase()} margin`} value={layout.margins[key as keyof PageLayout['margins']]} onchange={event=>numeric(event,key as keyof PageLayout['margins'])}/></label>{/each}</div>
      <div class="margin-presets">{#each [[.04,'Compact'],[.08,'Standard'],[.12,'Spacious']] as [fraction,label]}<button class="text-btn" onclick={()=>preset(Number(fraction))}>{label}</button>{/each}</div>
      <div class="grid-fields"><label class="field-label">Columns<select aria-label="Slide columns" value={layout.columns} onchange={event=>numeric(event,'columns')}>{#each Array.from({length:12},(_,i)=>i+1) as n}<option value={n}>{n===1?'Single column':`${n} columns`}</option>{/each}</select></label><label class="field-label"><span>Column gap <small>px</small></span><input aria-label="Slide column gap" type="number" min="0" step="any" onkeydown={incrementNumeric} disabled={layout.columns===1} value={layout.gutter} onchange={event=>numeric(event,'gutter')}/></label></div>
      <label class="layout-switch"><input type="checkbox" checked={editor.layoutGuides} onchange={event=>{editor.layoutGuides=event.currentTarget.checked;savePreferences();}}/><span>Show margins and column guides</span></label>
      <label class="layout-switch"><input type="checkbox" checked={editor.snapping} onchange={event=>{editor.snapping=event.currentTarget.checked;savePreferences();}}/><span>Snap while dragging</span></label>
      <label class="layout-switch"><input type="checkbox" checked={editor.snapToIncrement} disabled={!editor.snapping} onchange={event=>{editor.snapToIncrement=event.currentTarget.checked;savePreferences();}}/><span>Snap to 4 px increments</span></label>
      <p class="hint">Snap to edges, equal spacing and nearby gaps. Dashed distances show the reference gap. Use 4 px increments for positions, sizes and gaps. Shift + ↑ / ↓ steps fields by 4. Hold Alt to drag freely.</p>
      {#if error}<Notice tone="error" title="Layout could not update" message={error}/>{/if}
      <button class="text-btn full apply-all" onclick={()=>commit(structuredClone($state.snapshot(layout!)),true)}>Apply to all slides</button>
      <p class="layout-save-note">Margins and columns are saved with the document and can be undone. Guides are hidden in presentations and exports.</p>
    </div>
  {/if}
</div>
<style>
  .page-layout-popover{width:min(304px,calc(100vw - 24px))}
  header{position:sticky;top:0;z-index:1;background:var(--surface-overlay);display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border-subtle)}
  header strong{font-size:var(--ui-text);font-weight:var(--ui-weight-semibold)}.layout-settings-body{padding:12px 16px 16px}
  .setting-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:var(--text-secondary)}
  .margin-fields,.grid-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.margin-presets{display:flex;gap:4px;margin:8px 0 16px}
  .margin-presets button{flex:1;background:var(--fill-subtle);font-size:var(--ui-label)}
  .grid-fields .field-label{margin-bottom:12px;gap:4px}.grid-fields small{display:inline}
  .layout-switch{display:flex;align-items:center;gap:8px;min-height:34px;cursor:pointer}.layout-switch input{width:15px;height:15px;accent-color:var(--accent)}
  .hint{margin:12px 0 12px;font-size:var(--ui-meta)}.apply-all{border:1px solid var(--border-default)}
  .layout-save-note{margin-top:8px;color:var(--text-tertiary);font-size:var(--ui-meta);line-height:var(--ui-line-body)}
  @media(max-width:760px),(pointer:coarse){.page-layout-trigger,.layout-switch,.margin-presets button,.apply-all{min-height:44px}.setting-heading .icon-btn{min-width:44px;min-height:44px}}
</style>
