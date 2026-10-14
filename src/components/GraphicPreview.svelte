<script lang="ts">
  import ResourceImage from './ResourceImage.svelte';
  import SlideCanvas from './SlideCanvas.svelte';
  import {editor} from '../core/editor.svelte';
  import type {SlideElement} from '../core/model';
  let {src, detailSrc, title, background, allowSlide = true, replaceId, onload, onerror, mode=$bindable<'slide'|'material'|'detail'>('slide')}: {src:string;detailSrc:string;title:string;background:string;allowSlide?:boolean;replaceId?:string;onload:()=>void;onerror:()=>void;mode?:'slide'|'material'|'detail'} = $props();
  let decodedSrc=$state('');
  $effect(()=>{src;decodedSrc='';});
  function decoded(event:Event){decodedSrc=(event.currentTarget as HTMLImageElement).currentSrc;onload();}
  let actualMode = $derived(allowSlide && editor.deck && editor.slide ? mode : mode==='slide'?'material':mode);
  let candidate = $derived.by(() => {
    if (!editor.deck || !editor.slide) return undefined;
    const image = {id:'graphic-preview-only',type:'image',name:title,x:0,y:0,w:editor.deck.width,h:editor.deck.height,src:decodedSrc,fit:'cover',opacity:1,rotation:0,locked:true} as SlideElement;
    const existing=editor.slide.elements;
    return {...editor.slide,elements:replaceId?existing.map(item=>item.id===replaceId?{...item,src:decodedSrc,sourceRegion:undefined}:item):[image,...existing]};
  });
</script>
<div class="preview-modes" role="group" aria-label="Graphic preview mode">{#each [{id:'slide',label:'This slide'},{id:'material',label:'Material'},{id:'detail',label:'Detail'}] as view}{#if view.id!=='slide'||allowSlide}<button class="text-btn" aria-pressed={actualMode===view.id} onclick={()=>mode=view.id as typeof mode}>{view.label}</button>{/if}{/each}</div>
<div class="graphic-preview" class:dark={background==='dark'} class:checker={background==='checker'}>
  {#if actualMode==='slide' && candidate && editor.deck}<div inert class="slide-preview" aria-hidden="true"><SlideCanvas deck={editor.deck} slide={candidate} /></div><ResourceImage class="decode-probe" {src} alt="" onload={decoded} {onerror} />
  {:else}{#key actualMode==='detail'?detailSrc:src}<ResourceImage src={actualMode==='detail'?detailSrc:src} alt={`${title} · ${actualMode==='detail'?'enlarged detail':'full material'}`} {onload} {onerror} />{/key}{/if}
</div>
<p class="preview-caption">{actualMode==='slide'?'Preview only · Apply with Fill slide or Replace':actualMode==='detail'?'Enlarged detail · Placement uses the full material':'Full material · Transparent SVG'}</p>
<style>
  .preview-modes{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}.preview-modes [aria-pressed=true]{background:var(--state-selected);color:var(--text-link)}
  .graphic-preview{position:relative;width:100%;min-width:0;background:#fff;overflow:hidden;border-radius:var(--r-field)}.graphic-preview.dark{background:#1e1e1e}.graphic-preview.checker{background-color:#fff;background-image:conic-gradient(#e6e6e6 25%,#fff 0 50%,#e6e6e6 0 75%,#fff 0);background-size:16px 16px}
  .graphic-preview > :global(img){display:block;width:100%;aspect-ratio:16/9;object-fit:contain}.graphic-preview :global(img.decode-probe){position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.slide-preview{width:100%;pointer-events:none}
  .preview-caption{font-size:var(--ui-meta);line-height:1.4;color:var(--text-secondary);margin:6px 0 10px}
  @media(pointer:coarse){.preview-modes button{min-height:44px}}
</style>
