<script lang="ts">
  import type {SlideElement} from '../core/model';
  import {imageStyle} from '../core/image-style';
  import ResourceImage from './ResourceImage.svelte';
  let {image, onload, onerror}: {image: SlideElement; onload?: () => void; onerror?: () => void} = $props();
  const ratio = $derived(image.w / image.h);
</script>

<div class="resource-frame-stage" aria-label="Preview in the current image frame">
  <div class="resource-frame-image" style:aspect-ratio={ratio} style:max-width={`min(100%, ${220 * ratio}px)`}>
    <ResourceImage src={image.src} alt={image.name} style={imageStyle(image)} {onload} {onerror}/>
  </div>
</div>

<style>
  .resource-frame-stage{display:grid;place-items:center;min-height:100px;background:var(--surface-base);padding:12px;border-radius:var(--radius-sm)}
  .resource-frame-image{position:relative;overflow:hidden;width:100%;background:var(--surface-top)}
  .resource-frame-image :global(img){display:block}
</style>
