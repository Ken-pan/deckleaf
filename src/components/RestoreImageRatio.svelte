<script lang="ts">
  import {Ratio} from '@lucide/svelte';
  import type {SlideElement} from '../core/model';
  import ResourceImage from './ResourceImage.svelte';
  import {IconButton} from './ui';
  let {value,disabled=false,onchange}:{value:SlideElement;disabled?:boolean;onchange:(patch:Partial<SlideElement>)=>void}=$props();
  let measured=$state<{src:string;w:number;h:number}>(),failed=$state(false);
  const size=$derived(value.imageSize??(measured?.src===value.src?measured:undefined));
  const dimensions=$derived.by(()=>{
    if(!size)return;
    const minScale=Math.max(1/size.w,1/size.h),maxScale=Math.min(20000/size.w,20000/size.h);
    if(minScale>maxScale)return;
    const scale=Math.max(minScale,Math.min(maxScale,value.w/size.w));
    return {w:size.w*scale,h:size.h*scale};
  });
  $effect(()=>{value.src;failed=false;});
  function load(event:Event){const image=event.currentTarget as HTMLImageElement;measured={src:value.src??'',w:image.naturalWidth,h:image.naturalHeight};}
  function restore(){if(disabled||!dimensions)return;onchange({...dimensions});}
</script>
{#if !value.imageSize}{#key value.src}<ResourceImage src={value.src} alt="" hidden onload={load} onerror={()=>failed=true}/>{/key}{/if}
<IconButton label="Restore original aspect ratio" size="sm" disabled={disabled||!dimensions} title={failed?'The original image could not load.':'Restore original aspect ratio'} onclick={restore}><Ratio size={16} aria-hidden="true"/></IconButton>
