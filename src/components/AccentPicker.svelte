<script lang="ts">
  import ColorField from './ui/ColorField.svelte';
  import { ACCENT_PRESETS } from '../../public/resources/accent-engine.js';
  let {value, onchange, disabled = false, label = 'Accent color'}: {value: string; onchange: (color: string) => void; disabled?: boolean; label?: string} = $props();
</script>
<div class="accent-picker">
  <div class="accent-swatches" role="group" aria-label={label}>
    {#each ACCENT_PRESETS as preset}<button type="button" class:active={value.toLowerCase() === preset.color} style:--swatch={preset.color} aria-label="{label}: {preset.label}" title={preset.label} aria-pressed={value.toLowerCase() === preset.color} {disabled} onclick={() => { onchange(preset.color); }}></button>{/each}
  </div>
  <ColorField {label} {value} {disabled} opaque allowClear={false} {onchange}/>
</div>
<style>
  .accent-picker{display:grid;gap:12px;min-width:0}.accent-swatches{display:flex;gap:8px;flex-wrap:wrap}.accent-swatches button{width:36px;height:36px;padding:7px;border:1px solid transparent;border-radius:50%;background:transparent}.accent-swatches button::after{content:'';display:block;background:var(--swatch);width:20px;height:20px;border-radius:50%}.accent-swatches button.active{border-color:var(--text-primary)}
  @media(max-width:760px),(pointer:coarse){.accent-swatches button{width:44px;height:44px;padding:11px}}
</style>
