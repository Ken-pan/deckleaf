<script lang="ts">
  import type { Slide } from '../core/model';
  let {slide, floating = false}: {slide?: Slide; floating?: boolean} = $props();
  let credits = $derived.by(() => {
    const seen = new Set<string>();
    return (slide?.elements || []).flatMap(element => {
      const r = element.resource;
      if (element.hidden || !r || !r.id.startsWith('unsplash:') || seen.has(r.id)) return [];
      seen.add(r.id); return [r];
    });
  });
</script>
{#if credits.length}<div class="stock-photo-credits" class:floating aria-label="Photo credits">{#each credits as resource}<span>Photo by <a href={resource.creatorUrl || resource.sourceUrl} target="_blank" rel="noopener noreferrer">{resource.creator}</a> on <a href="https://unsplash.com/?utm_source=deck_studio&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></span>{/each}</div>{/if}
<style>
  .stock-photo-credits{display:flex;gap:8px 16px;flex-wrap:wrap;justify-content:center;font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary);max-width:100%;flex-shrink:0;margin:8px 0;max-height:54px;overflow:auto}.stock-photo-credits a{color:inherit;text-underline-offset:3px}.stock-photo-credits>span{max-width:100%;overflow-wrap:anywhere}
  .stock-photo-credits.floating{position:absolute;bottom:100%;left:0;right:0;background:#161616ed;color:#e3e3e3;padding:3px 8px;margin:0}
</style>
