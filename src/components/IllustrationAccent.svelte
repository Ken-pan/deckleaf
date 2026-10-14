<script lang="ts">
  import {defaultIllustrationColor,isThemedIllustration} from '../core/illustration-defaults';
  import Notice from './ui/Notice.svelte';
  import ResourceImage from "./ResourceImage.svelte";
  import { untrack } from 'svelte';
  import { Palette } from '@lucide/svelte';
  import { editor, api } from '../core/editor.svelte';
  import { illustrationTargets, illustrationAccentOperations, type AccentScope } from '../core/illustration-accent';
  import { validateResourceImport, type EmbeddedResource } from '../core/resources';
  import { ORIGINAL_ACCENT } from '../../public/resources/accent-engine.js';
  import AccentPicker from './AccentPicker.svelte';
  let color = $state(untrack(() => editor.selection.find(e => isThemedIllustration(e.resource))?.resource?.color || (editor.deck ? defaultIllustrationColor(editor.deck) : ORIGINAL_ACCENT)));
  let scope = $state<AccentScope>(untrack(() => editor.selection.some(e => isThemedIllustration(e.resource)) ? 'selection' : 'slide'));
  let busy = $state(false), error = $state('');
  let targets = $derived(editor.deck && editor.slide ? illustrationTargets(editor.deck, editor.slide.id, editor.selected, scope) : []);
  let available = $derived(targets.filter(t => !t.element.locked));
  let changes = $derived(available.filter(t => (t.element.design?.fill==='accent'?t.element.fill:t.element.resource?.color)?.toLowerCase() !== color));
  let preview = $derived(targets[0]?.element.resource?.id);
  async function apply() {
    if (!editor.deck || !editor.slide || busy) return;
    const deck = editor.operationDocument(), slideId = editor.slide.id, selection = [...editor.selected], count = changes.length;
    busy = true; error = '';
    try {
      const operations = await illustrationAccentOperations(deck, slideId, selection, scope, color, (id, accent, recipe) => api<EmbeddedResource>('/api/resources/import', 'POST', {id, color: accent, ...(recipe?{graphicRecipe:recipe}:{})}));
      if (editor.deck?.id !== deck.id || editor.deck?.revision !== deck.revision) throw new Error('The document has changed. Apply the accent color again.');
      validateResourceImport(deck, operations); editor.commit(operations, '', 'manual', deck.revision);
      if (operations.length && editor.deck.revision === deck.revision) throw new Error(editor.error || 'The accent color was not applied. Try again.');
      editor.notify(`Updated ${count} illustration accent colors. You can undo this change.`);
    } catch (e: any) { error = e.message; } finally { busy = false; }
  }
</script>
<div class="panel-section illustration-accent">
  <h3><Palette size={13} />Recolor illustrations</h3>
  <AccentPicker value={color} onchange={value => color = value} disabled={busy} />
  <label class="field-label">Scope<select aria-label="Scope of illustrations to recolor" bind:value={scope} disabled={busy}><option value="selection">Selection</option><option value="slide">This slide</option><option value="deck">All slides</option></select></label>
  {#if preview}<div class="accent-preview"><ResourceImage src={'/api/resources/preview?'+new URLSearchParams({id:preview,color,...(targets[0]?.element.resource?.graphicRecipe?{recipe:JSON.stringify(targets[0].element.resource.graphicRecipe)}:{})})} alt="Accent color preview" /></div>{/if}
  <p class="hint">{available.length} available{targets.length > available.length ? ` · ${targets.length - available.length} locked` : ''}</p>
  {#if error}<Notice tone="error" title="Illustration color could not update" message={error}/>{/if}
  <button class="text-btn primary full" disabled={busy || (!changes.length && !(scope === 'deck' && editor.deck?.illustrationAccent !== color))} onclick={apply}><Palette size={14} />{busy ? 'Recoloring…' : scope === 'deck' ? 'Apply to all slides' : 'Apply accent'}</button>
</div>
<style>.illustration-accent h3{display:flex;align-items:center;gap:8px}.accent-preview{height:116px;margin-top:12px;background:repeating-conic-gradient(var(--surface-base) 0 25%,color-mix(in srgb,var(--surface-base),var(--text-primary) 7%) 0 50%) 0 0/16px 16px;border:1px solid var(--border);border-radius:4px;display:flex;justify-content:center}.accent-preview :global(img){width:100%;height:100%;object-fit:contain}</style>
