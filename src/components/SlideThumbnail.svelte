<script lang="ts">
  import { onMount } from 'svelte';
  let SlideCanvas=$state<typeof import('./SlideCanvas.svelte')['default']>();
  $effect(()=>{if((visible||active)&&!SlideCanvas)void import('./SlideCanvas.svelte').then(m=>SlideCanvas=m.default);});
  import type { Deck, Slide } from '../core/model';
  let {deck, slide, active = false, original = false}: {deck: Pick<Deck, 'width' | 'height'>; slide: Slide; active?: boolean; original?: boolean} = $props();
  let host: HTMLDivElement;
  let visible = $state(false);
  onMount(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { visible = true; observer.disconnect(); }
    }, {rootMargin: '200px'});
    observer.observe(host);
    return () => observer.disconnect();
  });
</script>

<div aria-hidden="true" bind:this={host} style:aspect-ratio="{deck.width} / {deck.height}">
  {#if (visible || active)&&SlideCanvas}<SlideCanvas {deck} {slide} {original} />{/if}
</div>
