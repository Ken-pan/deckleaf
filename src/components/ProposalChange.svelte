<script lang="ts">
  import {Button} from './ui';
  let {change}: {change:{slide:string;target:string;before:string;after:string}}=$props();
  let expanded=$state(false);
  const lengthy=$derived(change.before.length>800||change.after.length>800);
  const display=(value:string)=>expanded||value.length<=800?value:`${value.slice(0,800)}…`;
</script>
<article class="change-row" aria-label={`${change.slide} · ${change.target}`}>
  <small>{change.slide} · {change.target}</small>
  {#if change.before}<div class="diff-before"><span class="diff-label">Current</span><div class="diff-content">{display(change.before)}</div></div>{/if}
  <div class="diff-after"><span class="diff-label">Proposed</span><div class="diff-content">{display(change.after)}</div></div>
  {#if lengthy}<Button variant="quiet" size="sm" aria-expanded={expanded} onclick={()=>expanded=!expanded}>{expanded?'Show less':'Show full change'}</Button>{/if}
</article>
<style>
  article{min-width:0;overflow-wrap:anywhere;white-space:normal}
  .diff-content{white-space:pre-wrap}
  article :global(button){margin-top:8px}
  @media(max-width:760px),(pointer:coarse){article :global(button){min-height:44px}}
</style>
