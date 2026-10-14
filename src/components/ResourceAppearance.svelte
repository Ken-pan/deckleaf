<script lang="ts">
  import Notice from './ui/Notice.svelte';
  import {onDestroy} from 'svelte';
  import {editor, api} from '../core/editor.svelte';
  import {resourceColorOperations} from '../core/resource-color';
  import {validateResourceImport, type EmbeddedResource} from '../core/resources';
  import ColorField from './ui/ColorField.svelte';
  let busy = $state(false), error = $state(''), disposed = false;
  onDestroy(() => {disposed = true;});
  let items = $derived(editor.selection.filter(e => !e.locked));
  const colorOf = (e: typeof items[number]) => e.design?.fill === 'accent' ? e.fill : e.resource?.color ?? '#26362c';
  let color = $derived(items[0] ? colorOf(items[0]) : '#26362c');
  let mixed = $derived(items.some(e => colorOf(e).toLowerCase() !== color.toLowerCase()));
  async function recolor(value: string) {
    if (!editor.deck || !editor.slide || busy) return;
    const deck = editor.operationDocument(), slideId = editor.slide.id, selection = [...editor.selected];
    busy = true; error = '';
    try {
      const operations = await resourceColorOperations(deck, slideId, selection, value, (resource, color) => api<EmbeddedResource>('/api/resources/import', 'POST', {id: resource.id, color, ...(resource.graphicRecipe ? {graphicRecipe: resource.graphicRecipe} : {})}));
      if (disposed) return;
      if (editor.deck?.id !== deck.id || editor.deck?.revision !== deck.revision || editor.slide?.id !== slideId || selection.join(',') !== editor.selected.join(',')) throw new Error('The selection changed. Choose the color again.');
      validateResourceImport(deck, operations);
      editor.commit(operations, '', 'manual', deck.revision);
      if (operations.length && editor.deck.revision === deck.revision) throw new Error(editor.error || 'The color was not applied. Try again.');
    } catch (e: any) {if (!disposed) error = e.message;} finally {if (!disposed) busy = false;}
  }
</script>
<fieldset class="resource-color-control" disabled={busy} aria-label="Resource color">
  <div class="resource-color-row"><span>Color</span><ColorField label="Resource color" value={color} {mixed} allowClear={false} onchange={value => void recolor(value)} /></div>
  {#if busy}<p role="status">Applying color…</p>{/if}
  {#if error}<Notice tone="error" title="Color could not update" message={error}/>{/if}
</fieldset>
<style>
  .resource-color-control{border:0;padding:0;margin:0;min-width:0}.resource-color-row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px;align-items:start;font-size:var(--ui-label);color:var(--text-secondary)}.resource-color-row>span{padding-block:8px;line-height:20px}p{font-size:var(--ui-meta);color:var(--text-secondary);margin-top:8px}
  @media(max-width:760px),(pointer:coarse){.resource-color-row{grid-template-columns:32px minmax(0,1fr)}}
  @container(max-width:13rem){.resource-color-row{grid-template-columns:1fr;gap:4px}.resource-color-row>span{padding:0}}
</style>
