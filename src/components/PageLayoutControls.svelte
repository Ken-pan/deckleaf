<script lang="ts">
  import NumberField from './ui/NumberField.svelte';
  import Notice from './ui/Notice.svelte';
  import {popoverFocus,restoreFocus} from '../ui-focus';
  import { onMount,tick } from 'svelte';
  import { Ruler,X,Link,Unlink } from '@lucide/svelte';
  import { editor } from '../core/editor.svelte';
  import { pageLayout,pageLayoutOperations } from '../core/page-layout';
  import type { PageLayout } from '../core/model';
  import {SNAP_INCREMENT} from '../core/numeric-increment';
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
  function numericValue(n:number,key:keyof PageLayout['margins']|'columns'|'gutter'){
    if(!layout)return false;
    const next=structuredClone($state.snapshot(layout));
    if(key==='columns'||key==='gutter')next[key]=n;else if(linked)next.margins={top:n,right:n,bottom:n,left:n};else next.margins[key]=n;
    return commit(next);
  }
  function preset(fraction:number){if(!layout||!editor.deck)return;const n=Math.round(Math.min(editor.deck.width,editor.deck.height)*fraction/SNAP_INCREMENT)*SNAP_INCREMENT;linked=true;commit({...layout,margins:{top:n,right:n,bottom:n,left:n}});}
  function savePreferences(){try{localStorage.setItem('deck-studio-layout-view',JSON.stringify({guides:editor.layoutGuides,snapping:editor.snapping,increment:editor.snapToIncrement}));}catch{/* view preferences are optional */}}
  function key(event:KeyboardEvent){if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();close();}}
  $effect(()=>{const slideId=editor.slide?.id;if(open){error='';if(!slideId)close();}});
  onMount(()=>{try{const stored=JSON.parse(localStorage.getItem('deck-studio-layout-view')??'{}');if(typeof stored.guides==='boolean')editor.layoutGuides=stored.guides;if(typeof stored.snapping==='boolean')editor.snapping=stored.snapping;if(typeof stored.increment==='boolean')editor.snapToIncrement=stored.increment;}catch{/* defaults */}const observer=new ResizeObserver(position);if(popup)observer.observe(popup);window.addEventListener('resize',position);window.addEventListener('scroll',reposition,true);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);return()=>{observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};});
</script>
<button bind:this={trigger} class="text-btn page-layout-trigger" aria-label="Slide layout settings · Margins and columns" title="Slide layout · Margins and columns" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} popovertarget={id} disabled={disabled||!editor.slide}><Ruler size={16}/><span>Margins and columns</span></button>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={popup} {id} use:popoverFocus={{close:()=>popup?.hidePopover(),origin:()=>trigger}} popover="auto" inert={!open} class="page-layout-popover canvas-controls-popover" role="dialog" tabindex="-1" aria-label="Slide layout settings" ontoggle={toggled} onbeforetoggle={event=>open=event.newState==='open'} onkeydown={key}>
  <header><strong>Slide layout</strong><button class="icon-btn small" aria-label="Close layout settings" onclick={close}><X size={16}/></button></header>
  {#if layout}
    <div class="layout-settings-body">
      <div class="setting-heading"><span>Slide margins <small>px</small></span><button class="icon-btn small" aria-label="Link all margins" title={linked?'Margins linked · Select to adjust individually':'Margins independent · Select to link'} aria-pressed={linked} onclick={()=>linked=!linked}>{#if linked}<Link size={16}/>{:else}<Unlink size={16}/>{/if}</button></div>
      <div class="margin-fields">{#each [['top','Top'],['right','Right'],['bottom','Bottom'],['left','Left']] as [key,label]}<NumberField label={`Slide ${label.toLowerCase()} margin`} prefix={label} preset="spacing" unit="px" min={0} max={editor.deck?Math.min(editor.deck.width,editor.deck.height)/2:2000} step="any" increment={4} value={layout.margins[key as keyof PageLayout['margins']]} onchange={value=>numericValue(value,key as keyof PageLayout['margins'])}/>{/each}</div>
      <div class="margin-presets">{#each [[.04,'Compact'],[.08,'Standard'],[.12,'Spacious']] as [fraction,label]}<button class="text-btn" onclick={()=>preset(Number(fraction))}>{label}</button>{/each}</div>
      <div class="grid-fields"><label class="field-label">Columns<select class="ui-property-input" aria-label="Slide columns" value={layout.columns} onchange={event=>numericValue(Number(event.currentTarget.value),'columns')}>{#each Array.from({length:12},(_,i)=>i+1) as n}<option value={n}>{n===1?'Single column':`${n} columns`}</option>{/each}</select></label><NumberField label="Slide column gap" prefix="Gap" preset="spacing" unit="px" min={0} step="any" increment={4} disabled={layout.columns===1} value={layout.gutter} onchange={value=>numericValue(value,'gutter')}/></div>
      <label class="ui-property-check"><input type="checkbox" checked={editor.layoutGuides} onchange={event=>{editor.layoutGuides=event.currentTarget.checked;savePreferences();}}/><span>Show margins and column guides</span></label>
      <label class="ui-property-check"><input type="checkbox" checked={editor.snapping} onchange={event=>{editor.snapping=event.currentTarget.checked;savePreferences();}}/><span>Snap while dragging</span></label>
      <label class="ui-property-check"><input type="checkbox" checked={editor.snapToIncrement} disabled={!editor.snapping} onchange={event=>{editor.snapToIncrement=event.currentTarget.checked;savePreferences();}}/><span>Snap to 4 px increments</span></label>
      <p class="hint">Snap to edges, equal spacing and nearby gaps. Dashed distances show the reference gap. Use 4 px increments for positions, sizes and gaps. Shift + ↑ / ↓ steps fields by 4. Hold Alt to drag freely.</p>
      {#if error}<Notice tone="error" title="Layout could not update" message={error}/>{/if}
      <button class="text-btn full apply-all" onclick={()=>commit(structuredClone($state.snapshot(layout!)),true)}>Apply to all slides</button>
      <p class="layout-save-note">Margins and columns are saved with the document and can be undone. Guides are hidden in presentations and exports.</p>
    </div>
  {/if}
</div>
<style>
  .page-layout-popover{width:min(304px,calc(100vw - 24px))}
  header{position:sticky;top:0;z-index:1;background:var(--surface-overlay);display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--border-subtle)}
  header strong{font-size:var(--ui-text);font-weight:var(--ui-weight-semibold)}.layout-settings-body{--property-control-height:36px;padding:12px;display:flex;flex-direction:column;gap:8px}
  .setting-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:var(--text-secondary)}
  .margin-fields,.grid-fields{display:flex;flex-direction:column;gap:8px}.margin-presets{display:flex;gap:4px;margin:8px 0 16px}
  .margin-presets button{flex:1;background:var(--fill-subtle);font-size:var(--ui-label)}
  .grid-fields .field-label{margin:0;gap:4px}
  
  .hint{margin:12px 0 12px;font-size:var(--ui-meta)}.apply-all{border:1px solid var(--border-default)}
  .layout-save-note{margin-top:8px;color:var(--text-tertiary);font-size:var(--ui-meta);line-height:var(--ui-line-body)}
  @media(max-width:760px),(pointer:coarse){.layout-settings-body{--property-control-height:48px}.page-layout-trigger,.margin-presets button,.apply-all{min-height:44px}.setting-heading .icon-btn,header .icon-btn{min-width:44px;min-height:44px}}
</style>
