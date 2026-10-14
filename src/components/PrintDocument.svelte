<script lang="ts">
  import type {Deck} from '../core/model';
  import {resourceCredits} from '../core/resource-credits';
  import {visibleDeliveryDeck} from '../core/slide-visibility';
  import SlideCanvas from './SlideCanvas.svelte';
  import '../print.css';
  let {deck,original=false}:{deck:Deck;original?:boolean}=$props();
  const delivery=$derived(visibleDeliveryDeck(deck));
  const credits=$derived(original?'':resourceCredits(delivery));
</script>

<div class="print-pages">
  {#each delivery.slides as slide (slide.id)}
    <div class="print-page"><SlideCanvas {deck} {slide} {original} /></div>
  {/each}
  {#if credits}<section class="resource-print-credits"><h2>Sources and licenses</h2><pre>{credits}</pre></section>{/if}
</div>
