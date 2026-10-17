<script lang="ts">
  import {PenLine, Paintbrush, Highlighter, Eraser, Check, ChevronUp} from '@lucide/svelte';
  import {Button, PopoverPanel} from './ui';
  import ColorField from './ui/ColorField.svelte';
  import {DRAWING_BRUSHES, DRAWING_COLORS, drawingMarkup, type DrawingSettings, type DrawingBrush} from '../core/drawing';
  let {settings, onchange, active = false, ondone, disabled = false}: {settings: DrawingSettings; onchange: (settings: DrawingSettings) => void; active?: boolean; ondone: () => void; disabled?: boolean} = $props();
  let open = $state(false);
  let panel = $state<PopoverPanel>();
  const icons = {pen: PenLine, brush: Paintbrush, highlighter: Highlighter};
  const previewPaper = $derived.by(() => {
    const rgb = parseInt(settings.color.slice(1), 16);
    return (rgb >> 16) * .2126 + ((rgb >> 8) & 255) * .7152 + (rgb & 255) * .0722 > 145 ? '#303532' : '#f4f3ee';
  });
  function choose(brush: DrawingBrush) {onchange({...settings, mode:'draw', brush, size: DRAWING_BRUSHES.find(item => item.id === brush)!.size});}
</script>

<PopoverPanel bind:this={panel} iconOnly {disabled} title="Brush settings" class="drawing-popover" bind:open width={288} height={420} autoHeight minHeight={240} viewportOnly>
    {#snippet trigger()}<ChevronUp size={13}/>{/snippet}
    <div class="drawing-settings">
      <div class="brushes" role="group" aria-label="Brush">
        {#each DRAWING_BRUSHES as brush}
          {@const Icon = icons[brush.id]}
          <Button aria-label={brush.label} aria-pressed={settings.mode !== 'erase' && settings.brush === brush.id} onclick={() => choose(brush.id)}><Icon size={18}/><span>{brush.id === 'highlighter' ? 'Highlight' : brush.label}</span></Button>
        {/each}
        <Button aria-pressed={settings.mode === 'erase'} onclick={() => onchange({...settings,mode:'erase'})}><Eraser size={18}/><span>Eraser</span></Button>
      </div>
      {#if settings.mode === 'erase'}<p class="hint">Drag to erase whole strokes.</p>{:else}
      <svg class="brush-preview" style:background={previewPaper} viewBox="0 0 260 40" aria-label="Brush preview" role="img">{@html drawingMarkup(Array.from({length: 45}, (_, i) => ({x: 18 + i * 5, y: 20 + Math.sin(i / 7) * 6, pressure: .3 + i / 65})), settings)}</svg>
      <div class="size-row">
        <label for="drawing-size">Size</label>
        <input id="drawing-size" aria-label="Brush size" type="range" min="1" max="64" step="1" value={settings.size} oninput={event => onchange({...settings, size: +event.currentTarget.value})}/>
        <output for="drawing-size">{settings.size} px</output>
      </div>
      <div class="color-presets" role="group" aria-label="Drawing colors">
        {#each DRAWING_COLORS as color}<button type="button" aria-label={color.name} title={color.name} aria-pressed={settings.color === color.value} style:--swatch={color.value} onclick={() => onchange({...settings, color: color.value})}><span></span></button>{/each}
      </div>
      {/if}
      <div class="drawing-color-row">
        {#if settings.mode !== 'erase'}<ColorField label="Drawing color" value={settings.color} opaque allowClear={false} onchange={color => onchange({...settings, color})}/>{/if}
        {#if active}<Button aria-label="Done drawing" onclick={() => {panel?.close();ondone();}}><Check size={14}/><span>Done</span></Button>{/if}
      </div>
    </div>
  </PopoverPanel>


<style>
  .drawing-settings {display: grid; gap: 8px;}
  .brushes {display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px;}
  .brushes :global(button) {min-width: 0; min-height: 48px; height: auto; flex-direction: column; gap: 4px; padding: 6px 0; font-size: var(--ui-meta); line-height: var(--ui-line-control);}
  .brush-preview {display: block; width: 100%; height: 36px; border: 1px solid var(--border-subtle); border-radius: var(--r-control);}
  .size-row {display: grid; grid-template-columns: auto minmax(0, 1fr) 36px; gap: 12px; align-items: center; font-size: var(--ui-label);}
  output {text-align: right; color: var(--text-secondary); font-size: var(--ui-meta); font-variant-numeric: tabular-nums; white-space: nowrap;}
  input[type="range"] {width: 100%; margin: 0; padding: 0; min-height: 28px; accent-color: var(--text-primary);}
  .color-presets {display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0;}
  .color-presets button {position: relative; display: grid; place-items: center; min-width: 0; min-height: 32px; padding: 4px; border: 1px solid transparent; background: transparent; border-radius: var(--r-control); -webkit-tap-highlight-color: transparent;}
  .color-presets button span {width: 20px; height: 20px; border: 1px solid color-mix(in srgb, var(--text-primary) 20%, transparent); border-radius: 50%; background: var(--swatch);}
  .color-presets button[aria-pressed="true"] span {outline: 1.5px solid var(--text-primary); outline-offset: 3px;}
  .drawing-color-row {display: flex; align-items: center; gap: 8px; min-width: 0;}
  .drawing-color-row :global(.color-property) {flex: 1; min-width: 0;}
  .drawing-color-row > :global(button) {padding-inline: 8px; gap: 4px;}
  .hint {margin: 0; padding-block: 4px; font-size: var(--ui-label); line-height: var(--ui-line-reading); color: var(--text-secondary);}
  @media (forced-colors: active) {
    .color-presets button[aria-pressed="true"] span {outline-color: Highlight;}
    .color-presets button span {forced-color-adjust: none;}
  }
  @media (pointer: coarse), (max-width: 760px) {
    .brushes :global(button) {min-height: 52px;}
    .color-presets {grid-template-columns: repeat(4, minmax(44px, 1fr));}
    .color-presets button, input[type="range"], .drawing-color-row > :global(button) {min-height: 44px;}
    .color-presets button span {width: 24px; height: 24px;}
  }
</style>
