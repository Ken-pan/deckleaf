<script lang="ts">
  import {rememberPanelScroll} from '../panel-scroll.svelte';
  import {slideLabel} from '../core/slide-label';
  import { editor } from '../core/editor.svelte';
  import type {TextRole} from '../core/design-system-schema';
  import type { SlideElement } from '../core/model';
  import { uiDisclosure } from '../ui-motion';
  import AsyncFeature from './AsyncFeature.svelte';
  import LayerBrowser from './LayerBrowser.svelte';
  import SlideStyles from './SlideStyles.svelte';
  import PageLayoutControls from './PageLayoutControls.svelte';
  import { deckDesignSystem } from '../core/deck-design-system';
  import { Button, SegmentedControl , EmptyState} from './ui';
  import { BookOpen, PanelTop, MousePointer2, LayoutTemplate, Layers, ChevronRight } from '@lucide/svelte';
  import {DocumentStylesIcon} from './icons/workspace-icons';
  let {active=true,view=$bindable<'properties'|'layers'>('properties'),onfonts,onresources,onprototype,onreference,onlayout,ondeckstyles,onpageelements,onviewchange,layoutDisabled=false}: {active?:boolean;view?: 'properties'|'layers';onfonts:()=>void;onresources?:(replaceId?:string)=>void;onprototype?:(element:SlideElement)=>void;onreference?:()=>void;onlayout?:()=>void;onpageelements?:()=>void;ondeckstyles?:(role?:TextRole)=>void;onviewchange?:(value:'properties'|'layers')=>void;layoutDisabled?:boolean}=$props();
  let properties=$state<HTMLDivElement>();
  rememberPanelScroll(()=>active&&view==='properties',()=>`${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}`,()=>[properties]);
  let e=$derived(editor.selection.find(e=>!e.locked)??editor.selection[0]);
</script>
<div class="inspector-content">
  {#if editor.deck&&!e&&view!=='layers'}<div class="deck-styles-entry"><Button variant="secondary" disabled={layoutDisabled} onclick={()=>ondeckstyles?.()}><DocumentStylesIcon size={16} aria-hidden="true"/><span>Document styles<small>{deckDesignSystem(editor.deck).name} · All slides</small></span><ChevronRight size={14}/></Button></div>{/if}
  {#if !editor.sourceMode}<div class="inspector-view-tabs"><SegmentedControl label="Design panel content" options={[{value:'properties',label:'Properties'},{value:'layers',label:`Layers · ${editor.slide?.elements.filter(e=>!e.designPattern).length||0}`}]} value={view} onchange={value=>{view=value as typeof view;onviewchange?.(view);}}/>{#if editor.deck&&(e||view==='layers')}<Button class="inspector-style-entry" aria-label="Document styles" title={`Document styles · ${deckDesignSystem(editor.deck).name}`} disabled={layoutDisabled} onclick={()=>ondeckstyles?.()}>Styles</Button>{/if}</div>{/if}
  {#if view==='layers'&&!editor.sourceMode}<LayerBrowser {active} disabled={layoutDisabled}/>{:else}<div bind:this={properties} class="inspector-properties">
  {#if editor.sourceMode && editor.slide?.source?.render}
    <div class="panel-section reference-summary"><BookOpen size={20} /><h3>Source reference</h3><p class="hint">{editor.slide.source.provider} · {slideLabel(editor.deck?.slides.findIndex(s=>s.id===editor.slide?.id)??0)}</p><p class="hint">Switch to Editable version to make changes.</p><Button variant="secondary" onclick={onreference}>View import report</Button></div>
  {:else if e}
    {#if e.pageElement}<div class="page-element-entry"><Button variant="secondary" disabled={layoutDisabled} onclick={onpageelements}><PanelTop size={16} />Slide details</Button></div>{/if}
    <AsyncFeature feature="object-inspector" props={{active,onfonts,onresources,onprototype,onstyles:ondeckstyles}} />
  {:else if editor.slide}
    <div class="panel-section slide-properties"><div class="section-label"><h3><PanelTop size={16} aria-hidden="true" />Slide</h3><span>{editor.deck?.width} × {editor.deck?.height}</span></div><SlideStyles/><Button variant="secondary" disabled={layoutDisabled} onclick={onpageelements}><PanelTop size={16} />Slide details</Button></div><div class="panel-section slide-layout-section"><h3><LayoutTemplate size={16} aria-hidden="true"/>Layout</h3><PageLayoutControls disabled={layoutDisabled} /><Button variant="secondary" disabled={layoutDisabled} onclick={onlayout}><LayoutTemplate size={16} />Layout suggestions</Button></div>
    <div class="panel-section inspector-guidance"><EmptyState density="inline" icon={MousePointer2} title={editor.slide.elements.length ? 'Select an object' : 'Add your first object'} description={editor.slide.elements.length ? '' : 'Use the canvas toolbar.'} /><details use:uiDisclosure class="inspector-help"><summary>Editing tips</summary><p>Drag on empty space to select touched objects. Hold Alt to select only fully enclosed objects, Shift to add, or ⌘/Ctrl to select group members directly.</p><p>Double-click a group to enter it. Enter selects its contents; Shift + Enter or Esc selects its parent. Use the group path to return to the slide. Done finishes group editing; Move out of group changes membership.</p><p>Drag to move; use handles to resize. Double-click text to edit. Press ⌘D to duplicate or use arrow keys to nudge.</p></details></div>
  {/if}

  </div>{/if}
</div>
<style>
  .inspector-content{container-type:inline-size}.page-element-entry{padding:12px}.page-element-entry :global(button){width:100%;justify-content:flex-start}
  .inspector-properties{overscroll-behavior:contain;scroll-padding:12px}
  .inspector-properties:has(:global(.object-summary)){scroll-padding-top:calc(3rem + 24px)}
  .deck-styles-entry{padding:12px}.deck-styles-entry :global(button){width:100%;min-width:0;text-align:left;justify-content:flex-start;gap:8px;padding:8px 12px;height:auto}.deck-styles-entry span{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.deck-styles-entry small{font-size:var(--ui-meta);color:var(--text-secondary);overflow-wrap:anywhere}
  .slide-properties,.reference-summary,.inspector-guidance{padding:12px;gap:8px}
  .slide-properties h3{display:flex;align-items:center;gap:8px;font-size:var(--ui-label)}
  .slide-properties h3 :global(svg){flex:none;color:var(--text-secondary)}
  .slide-layout-section h3{display:flex;align-items:center;gap:8px;margin:0}.slide-layout-section h3 :global(svg){flex:none;color:var(--text-secondary)}
  .slide-layout-section > :global(button){width:100%;justify-content:flex-start}
  .slide-layout-section{padding:12px;gap:8px}
  .inspector-view-tabs{padding:4px 12px;display:flex;gap:4px;align-items:center}
  .inspector-view-tabs :global(.ui-segmented){flex:1;min-width:0;flex-wrap:wrap}
  .inspector-view-tabs :global(.ui-segmented button){height:auto;min-height:32px;flex:1 1 5rem;min-width:0;padding:6px 8px;font-size:var(--ui-text)}
  .inspector-view-tabs :global(.inspector-style-entry){flex:none;padding-inline:8px;font-size:var(--ui-label)}
  @container(max-width:14rem){.inspector-view-tabs{flex-wrap:wrap}.inspector-view-tabs :global(.ui-segmented){flex-basis:100%}}
  @media(max-width:760px),(pointer:coarse){
    .inspector-help summary{min-height:44px;display:flex;align-items:center}
    .inspector-view-tabs :global(.ui-segmented button),.inspector-view-tabs :global(.inspector-style-entry){min-height:44px}
    .inspector-properties :global(select),.inspector-properties :global(.font-trigger),.inspector-properties :global(.ui-button){min-height:44px}
  }
</style>
