<script lang="ts">
  import type {SlideElement} from '../core/model';
  import {imageLayout} from '../core/image-style';
  import ResourceImage from './ResourceImage.svelte';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  let {value,onchange,disabled=false}:{value:SlideElement;onchange:(patch:Partial<SlideElement>,merge?:string)=>void;disabled?:boolean}=$props();
  let measured=$state<{src:string;w:number;h:number}>();
  const size=$derived(value.imageSize??(measured?.src===value.src?measured:undefined));
  const axis=$derived.by(()=>{
    if(!size||value.fit!=='cover'||value.sourceRegion||value.crop&&!value.imageSize)return;
    const r=imageLayout(value,size),c=value.crop;
    if(r.w*(1-(c?.left??0)-(c?.right??0))-value.w>.01)return 'x';
    if(r.h*(1-(c?.top??0)-(c?.bottom??0))-value.h>.01)return 'y';
  });
  const flipped=$derived(axis==='x'?value.flipX:value.flipY);
  const position=$derived(axis?(value.imagePosition?.[axis]??.5):.5);
  const visualPosition=$derived(flipped?1-position:position);
  const options=$derived(axis==='x'?[{value:'0',label:'Left'},{value:'0.5',label:'Center'},{value:'1',label:'Right'}]:[{value:'0',label:'Top'},{value:'0.5',label:'Center'},{value:'1',label:'Bottom'}]);
  function choose(next:string){
    if(!axis)return;
    const n=Number(next);
    onchange({imagePosition:{x:.5,y:.5,[axis]:flipped?1-n:n}});
  }
  function load(event:Event){const image=event.currentTarget as HTMLImageElement;measured={src:value.src??'',w:image.naturalWidth,h:image.naturalHeight};}
</script>
{#if !value.imageSize}{#key value.src}<ResourceImage src={value.src} alt="" hidden onload={load}/>{/key}{/if}
{#if axis}
  <div class="image-position-controls">
    <span>Position</span>
    <PropertyChoice label="Image position" {options} value={options.find(p=>Math.abs(visualPosition-Number(p.value))<.001)?.value??''} {disabled} onchange={choose}/>
  </div>
{/if}
<style>
  .image-position-controls{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-width:0;font-size:var(--ui-label);color:var(--text-secondary)}
</style>
