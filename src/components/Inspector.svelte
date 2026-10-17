<script lang="ts">
  import {rememberPanelScroll} from '../panel-scroll.svelte';
  import {slideLabel} from '../core/slide-label';
  import { editor } from '../core/editor.svelte';
  import type {TextRole} from '../core/design-system-schema';
  import type { SlideElement } from '../core/model';
  import AsyncFeature from './AsyncFeature.svelte';
  import LayerBrowser from './LayerBrowser.svelte';
  import SlideStyles from './SlideStyles.svelte';
  import PageLayoutControls from './PageLayoutControls.svelte';
  import { deckDesignSystem } from '../core/deck-design-system';
  import { Button, SegmentedControl } from './ui';
  import { BookOpen, PanelTop, LayoutTemplate, Palette, ChevronRight } from '@lucide/svelte';
  let {active=true,view=$bindable<'properties'|'layers'>('properties'),onfonts,onresources,onprototype,ondraw,onreference,onlayout,ondeckstyles,onpageelements,onviewchange,layoutDisabled=false}: {active?:boolean;view?: 'properties'|'layers';onfonts:()=>void;ondraw?:()=>void;onresources?:(replaceId?:string)=>void;onprototype?:(element:SlideElement)=>void;onreference?:()=>void;onlayout?:()=>void;onpageelements?:()=>void;ondeckstyles?:(role?:TextRole)=>void;onviewchange?:(value:'properties'|'layers')=>void;layoutDisabled?:boolean}=$props();
  let properties=$state<HTMLDivElement>();
  rememberPanelScroll(()=>active&&view==='properties',()=>`${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}`,()=>[properties]);
  let e=$derived(editor.selection.find(e=>!e.locked)??editor.selection[0]);
  let currentStyle=$derived(editor.deck ? deckDesignSystem(editor.deck) : undefined);
  function changeView(value:string){view=value as typeof view;onviewchange?.(view);}
</script>
<div class="inspector-content">
  {#if !editor.sourceMode}<div class="inspector-view-tabs"><SegmentedControl label="Design panel content" options={[{value:'properties',label:'Properties'},{value:'layers',label:`Layers · ${editor.slide?.elements.filter(e=>!e.designPattern).length||0}`}]} value={view} onchange={changeView}/><select class="inspector-view-select" aria-label="Design panel content" value={view} onchange={event=>changeView(event.currentTarget.value)}><option value="properties">Edit</option><option value="layers">Layers</option></select></div>{/if}
  {#if view==='layers'&&!editor.sourceMode}<LayerBrowser {active} disabled={layoutDisabled}/>{:else}<div bind:this={properties} class="inspector-properties">
  {#if editor.sourceMode && editor.slide?.source?.render}
    <div class="panel-section reference-summary"><BookOpen size={20} /><h3>Source reference</h3><p class="hint">{editor.slide.source.provider} · {slideLabel(editor.deck?.slides.findIndex(s=>s.id===editor.slide?.id)??0)}</p><p class="hint">Switch to Editable version to make changes.</p><Button variant="secondary" onclick={onreference}>View import report</Button></div>
  {:else if e}
    {#if e.pageElement}<div class="page-element-entry"><Button variant="secondary" disabled={layoutDisabled} onclick={onpageelements}><PanelTop size={16} />Slide details</Button></div>{/if}
    <AsyncFeature feature="object-inspector" props={{active,onfonts,onresources,onprototype,ondraw,onstyles:ondeckstyles}} />
  {:else if editor.slide}
    <div class="panel-section slide-properties"><div class="section-label"><h3><PanelTop size={16} aria-hidden="true" />Slide</h3><span>{editor.deck?.width} × {editor.deck?.height}</span></div><SlideStyles/><Button variant="secondary" disabled={layoutDisabled} onclick={onpageelements}><PanelTop size={16} />Slide details</Button></div><div class="panel-section slide-layout-section"><h3><LayoutTemplate size={16} aria-hidden="true"/>Layout</h3><PageLayoutControls disabled={layoutDisabled} /><Button variant="secondary" disabled={layoutDisabled} onclick={onlayout}><LayoutTemplate size={16} />Layout suggestions</Button></div>
    {#if currentStyle}
      <div class="panel-section document-style-section">
        <div class="section-label"><h3><Palette size={16} aria-hidden="true" />Style</h3><span>All slides</span></div>
        <Button variant="secondary" class="current-style" aria-label={`Document styles · ${currentStyle.name}`} title="Change document styles" disabled={layoutDisabled} onclick={()=>ondeckstyles?.()}>
          <span class="current-style-name">{currentStyle.name}</span>
          <span class="current-style-colors" aria-hidden="true">{#each [currentStyle.colors.background,currentStyle.colors.ink,currentStyle.colors.accent] as color}<span style:background={color}></span>{/each}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    {/if}
  {/if}

  </div>{/if}
</div>
<style>
  .inspector-content{container-type:inline-size}.page-element-entry{padding:12px}.page-element-entry :global(button){width:100%;justify-content:flex-start}
  .inspector-properties{overscroll-behavior:contain;scroll-padding:12px}
  .inspector-properties:has(:global(.object-summary)){scroll-padding-top:calc(3rem + 24px)}
  .slide-properties,.reference-summary,.document-style-section{padding:12px;gap:8px}
  .slide-properties h3,.document-style-section h3{display:flex;align-items:center;gap:8px;font-size:var(--ui-label)}
  .slide-properties h3 :global(svg),.document-style-section h3 :global(svg){flex:none;color:var(--text-secondary)}
  .document-style-section :global(.current-style){width:100%;height:auto;min-height:44px;justify-content:flex-start;gap:8px;padding:8px 12px;white-space:normal;text-align:left}
  .current-style-name{flex:1;min-width:0;overflow-wrap:anywhere}
  .current-style-colors{display:flex;gap:4px;flex:none}
  .current-style-colors span{width:16px;height:16px;border:1px solid var(--border-default);border-radius:var(--radius-sm)}
  .document-style-section :global(.current-style > svg){flex:none;color:var(--text-secondary)}
  .slide-layout-section h3{display:flex;align-items:center;gap:8px;margin:0}.slide-layout-section h3 :global(svg){flex:none;color:var(--text-secondary)}
  .slide-layout-section > :global(button){width:100%;justify-content:flex-start}
  .slide-layout-section{padding:12px;gap:8px}
  .inspector-view-tabs{padding:4px 12px;display:flex;gap:4px;align-items:center}
  .inspector-view-select{display:none;flex:1;min-width:0;width:100%;font-size:var(--ui-text)}
  .inspector-view-tabs :global(.ui-segmented){flex:1;min-width:0;flex-wrap:wrap}
  .inspector-view-tabs :global(.ui-segmented button){height:auto;min-height:32px;flex:1 1 5rem;min-width:0;padding:6px 8px;font-size:var(--ui-text)}
  @container(max-width:14rem){.inspector-view-tabs{gap:8px}.inspector-view-tabs :global(.ui-segmented){display:none}.inspector-view-select{display:block}}
  @media(max-height:520px){.inspector-properties:has(:global(.object-summary)){scroll-padding-top:12px}}
  @media(max-width:760px),(pointer:coarse){
    .inspector-view-tabs :global(.ui-segmented button),.inspector-view-select{min-height:44px}
    .inspector-properties :global(select),.inspector-properties :global(.font-trigger){min-height:var(--property-control-height)}
    .inspector-properties :global(.ui-button){min-height:44px}
  }
</style>
