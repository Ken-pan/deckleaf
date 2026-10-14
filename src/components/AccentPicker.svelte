<script lang="ts">
  import { ACCENT_PRESETS, normalizeAccent } from '../../public/resources/accent-engine.js';
  let {value, onchange, disabled = false, label = 'Accent color'}: {value: string; onchange: (color: string) => void; disabled?: boolean; label?: string} = $props();
  let invalid = $state(false);
  function hex(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    try { onchange(normalizeAccent(input.value)); invalid = false; } catch { invalid = true; }
  }
</script>
<div class="accent-picker">
  <div class="accent-swatches" role="group" aria-label={label}>
    {#each ACCENT_PRESETS as preset}<button type="button" class:active={value.toLowerCase() === preset.color} style:--swatch={preset.color} aria-label="{label}: {preset.label}" title={preset.label} aria-pressed={value.toLowerCase() === preset.color} {disabled} onclick={() => { onchange(preset.color); invalid = false; }}></button>{/each}
  </div>
  <div class="accent-custom"><input type="color" aria-label="Custom {label.toLowerCase()}" value={value} {disabled} onchange={event => { onchange(event.currentTarget.value); invalid = false; }} /><input aria-label="{label} HEX" value={value.toUpperCase()} aria-invalid={invalid} maxlength="7" {disabled} onchange={hex} /></div>
  {#if invalid}<span class="accent-invalid" role="alert">Enter a six-digit HEX color.</span>{/if}
</div>
<style>
  .accent-picker{display:grid;gap:12px;min-width:0}.accent-swatches{display:flex;gap:8px;flex-wrap:wrap}.accent-swatches button{width:28px;height:28px;padding:3px;border:1px solid transparent;border-radius:50%;background:transparent}.accent-swatches button::after{content:'';display:block;background:var(--swatch);width:20px;height:20px;border-radius:50%}.accent-swatches button.active{border-color:var(--text-primary)}.accent-custom{display:flex;gap:8px;align-items:center}.accent-custom input[type=color]{width:34px;height:32px;padding:2px;flex-shrink:0}.accent-custom input:not([type=color]){width:100%;min-width:0;height:32px;font:var(--ui-label) ui-monospace,monospace;letter-spacing:0}.accent-invalid{font-size:var(--ui-meta);color:var(--text-secondary)}
  @media(max-width:600px){.accent-swatches button{width:36px;height:36px;padding:8px}.accent-custom input{min-height:40px}}
</style>
