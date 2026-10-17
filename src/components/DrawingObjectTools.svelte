<script lang="ts">
  import {Blend, Check} from '@lucide/svelte';
  import {Button, PopoverPanel} from './ui';
  import ColorField from './ui/ColorField.svelte';
  import NumberField from './ui/NumberField.svelte';
  import {editor} from '../core/editor.svelte';
  import type {SlideElement} from '../core/model';
  import {drawingColorPatch, type DrawingStyle} from '../core/drawing-properties';
  import {DRAWING_COLORS} from '../core/drawing-settings';
  import {drawingState} from '../drawing-state.svelte';
  let {element, drawing, ondraw}: {element: SlideElement; drawing: DrawingStyle; ondraw: () => void} = $props();
  let colorPanel = $state<PopoverPanel>(), opacityPanel = $state<PopoverPanel>();
  let colorEdit = 0, opacityEdit = 0;
  const opacity = $derived(Number((element.opacity * 100).toFixed(1)));
  function patch(value: Partial<SlideElement>, merge: string) {
    if (!editor.deck || !editor.slide || !editor.selected.includes(element.id) || element.locked) return;
    editor.commit([{op: 'update_element', slideId: editor.slide.id, elementId: element.id, patch: value}], merge, 'manual', editor.deck.revision);
  }
  function color(value: string) {
    const change = drawingColorPatch(element, value);
    if (change) patch(change, `drawing-color:${element.id}:${colorEdit}`);
  }
  function setOpacity(value: number) {
    if (Number.isFinite(value) && value >= 0 && value <= 100 && value !== opacity) patch({opacity: value / 100}, `drawing-opacity:${element.id}:${opacityEdit}`);
  }
  function draw() {
    colorPanel?.close(); opacityPanel?.close();
    drawingState.settings = {...drawing, mode: 'draw'};
    ondraw();
  }
</script>

<div class="drawing-object-tools" aria-label="Drawing controls">
  <PopoverPanel bind:this={colorPanel} title="Drawing color" width={256} height={300} minHeight={160} autoHeight viewportOnly onopen={() => colorEdit++}>
    {#snippet trigger()}<span class="stroke-swatch" style:background={drawing.color}></span><span>Color</span>{/snippet}
    <div class="drawing-color-controls">
      <div class="stroke-colors" role="group" aria-label="Stroke colors">
        {#each DRAWING_COLORS as preset}<button type="button" aria-label={preset.name} title={preset.name} aria-pressed={drawing.color.toLowerCase() === preset.value} style:--swatch={preset.value} onclick={() => color(preset.value)}><span></span>{#if drawing.color.toLowerCase() === preset.value}<Check size={12}/>{/if}</button>{/each}
      </div>
      <ColorField label="Stroke color" value={drawing.color} opaque allowClear={false} onchange={color}/>
    </div>
  </PopoverPanel>
  <PopoverPanel bind:this={opacityPanel} title="Drawing opacity" triggerLabel={`Drawing opacity · ${opacity}%`} width={248} height={220} minHeight={140} autoHeight viewportOnly onopen={() => opacityEdit++}>
    {#snippet trigger()}<Blend size={16}/><span>{opacity}%</span>{/snippet}
    <div class="drawing-opacity-controls">
      <NumberField label="Drawing opacity" prefix="Opacity" value={opacity} min={0} max={100} unit="%" preset="percent" step="any" onchange={setOpacity}/>
      <div class="opacity-choices" role="group" aria-label="Opacity presets">{#each [25, 50, 75, 100] as amount}<Button aria-pressed={opacity === amount} onclick={() => setOpacity(amount)}>{amount}%</Button>{/each}</div>
    </div>
  </PopoverPanel>
  <Button aria-label="Continue drawing" title="Continue drawing" onclick={draw}><span>Draw</span></Button>
</div>

<style>
  .drawing-object-tools {display: flex; align-items: center; gap: 4px; min-width: 0;}
  .stroke-swatch {width: 16px; height: 16px; border: 1px solid var(--border-default); border-radius: 50%; flex: none;}
  .drawing-color-controls, .drawing-opacity-controls {display: grid; gap: 12px;}
  .stroke-colors {display: grid; grid-template-columns: repeat(8, minmax(0, 1fr));}
  .stroke-colors button {position: relative; display: grid; place-items: center; min-width: 0; min-height: 32px; padding: 2px; border: 0; background: transparent; border-radius: var(--r-control);}
  .stroke-colors button span {width: 20px; height: 20px; background: var(--swatch); border: 1px solid var(--border-default); border-radius: 50%;}
  .stroke-colors button[aria-pressed="true"] {background: var(--state-selected);}
  .stroke-colors button :global(svg) {position: absolute; background: var(--surface-overlay); color: var(--text-primary); border-radius: 50%;}
  .opacity-choices {display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px;}
  .opacity-choices :global(button) {padding-inline: 4px; font-size: var(--ui-meta);}
  @media (max-width: 760px), (pointer: coarse) {
    .stroke-colors {grid-template-columns: repeat(4, minmax(44px, 1fr));}
    .stroke-colors button {min-height: 44px;}
    .drawing-object-tools {gap: 2px;}
  }
</style>
