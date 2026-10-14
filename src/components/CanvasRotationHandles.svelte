<script module lang="ts">
  export {rotationTools} from '../core/rotation';
  export {default as RotationGuides} from './CanvasRotationGuides.svelte';
</script>
<script lang="ts">
  import {rotationCursor} from '../core/rotation';
  let {scale,label='object',line=false,onstart}:{scale:number;label?:string;line?:boolean;onstart:(event:PointerEvent)=>void}=$props();
</script>
{#each line?['nw','se']:['nw','ne','sw','se'] as corner}
  <button class="rotation-handle {corner}" tabindex="-1" aria-label="Rotate {label} · {corner}" title="Drag to rotate · Shift: 15° · Alt: free" style:cursor={rotationCursor} style:--unit="{1/scale}px" onpointerdown={onstart}></button>
{/each}
<button class="rotation-handle touch-rotation" tabindex="-1" aria-label="Rotate {label}" title="Drag to rotate; nearby angles snap" style:cursor={rotationCursor} style:--unit="{1/scale}px" onpointerdown={onstart}>
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8a6 6 0 1 0-1 6M16 3v5h-5"/></svg>
</button>
<style>
  .rotation-handle{position:absolute;width:calc(32 * var(--unit));height:calc(32 * var(--unit));border:0;padding:0;border-radius:0;background:transparent;pointer-events:auto;touch-action:none;z-index:4}
  .nw,.sw{left:calc(-32 * var(--unit))}.ne,.se{right:calc(-32 * var(--unit))}.nw,.ne{top:calc(-32 * var(--unit))}.sw,.se{bottom:calc(-32 * var(--unit))}
  .rotation-handle:focus-visible{outline:calc(1.5 * var(--unit)) solid var(--canvas-selection)}
  .touch-rotation{display:none;left:50%;top:calc(-64 * var(--unit));transform:translateX(-50%);width:calc(44 * var(--unit));height:calc(44 * var(--unit));border-radius:50%}
  .touch-rotation svg{position:absolute;left:calc(12 * var(--unit));top:calc(12 * var(--unit));width:calc(20 * var(--unit));height:calc(20 * var(--unit));fill:none;background:var(--surface-raised);border-radius:50%;stroke:var(--canvas-selection);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  @media(pointer:coarse){.rotation-handle{display:none}.touch-rotation{display:block}}
</style>
