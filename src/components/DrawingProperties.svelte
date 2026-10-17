<script lang="ts">
  import {PenLine} from '@lucide/svelte';
  import {Button, PropertyRow} from './ui';
  import ColorField from './ui/ColorField.svelte';
  import NumberField from './ui/NumberField.svelte';
  import type {SlideElement} from '../core/model';
  import {editor} from '../core/editor.svelte';
  import {drawingColorOperations, drawingSelection} from '../core/drawing-properties';
  import {DRAWING_BRUSHES} from '../core/drawing-settings';
  import {drawingState} from '../drawing-state.svelte';
  let {items, ondraw}: {items: SlideElement[]; ondraw?: () => void} = $props();
  const selection = $derived(drawingSelection(items));
  const first = $derived(items[0]);
  const brushLabel = $derived(DRAWING_BRUSHES.find(brush => brush.id === selection.brush)?.label ?? 'Mixed');
  const opacityMixed = $derived(items.some(item => item.opacity !== first?.opacity));
  function color(value: string) {
    if (!editor.slide || !editor.deck || !selection.all) return;
    editor.commit(drawingColorOperations(editor.slide, items.map(item => item.id), value), 'drawing-inspector-color', 'manual', editor.deck.revision);
  }
  function draw() {
    if (!selection.first || items.length !== 1 || first.locked) return;
    drawingState.settings = {...selection.first, mode: 'draw'};
    ondraw?.();
  }
</script>

{#if first && selection.all}
  <PropertyRow label="Brush"><span class="drawing-brush-name">{brushLabel}</span></PropertyRow>
  <PropertyRow label="Color"><ColorField label="Drawing color" value={selection.color} mixed={selection.mixedColor} opaque allowClear={false} onchange={color}/></PropertyRow>
  <NumberField label="Drawing opacity" prefix="Opacity" value={Math.round(first.opacity * 1000) / 10} mixed={opacityMixed} min={0} max={100} presets={[0, 25, 50, 75, 100]} unit="%" step="any" onchange={value => editor.patch({opacity: value / 100})}/>
  {#if items.length === 1 && ondraw}<Button variant="quiet" class="full" onclick={draw}><PenLine size={16}/>Continue drawing</Button>{/if}
{/if}

<style>
  .drawing-brush-name {display: flex; align-items: center; min-height: var(--property-control-height, 36px); font-size: var(--ui-label); color: var(--text-secondary);}
</style>
