<script lang="ts">
  import {onMount} from 'svelte';
  import {FileText} from '@lucide/svelte';
  import SlideThumbnail from './SlideThumbnail.svelte';
  import {observeThumbnail} from '../core/thumbnail-visibility';
  import {jsonRequest} from '../core/json-request';
  import type {LibraryDocument} from '../core/document-library-view';
  import type {LibraryPreview} from '../core/library-summary';
  import type {LibraryPreviewQueue} from '../core/library-preview-queue';

  let {document, queue}: {document: LibraryDocument; queue: LibraryPreviewQueue} = $props();
  let host: HTMLSpanElement;
  let visible = $state(false);
  let preview = $state.raw<LibraryPreview>();
  let failed = $state(false);
  onMount(() => observeThumbnail(host, value => {visible = value;}));
  $effect(() => {
    const target = document;
    preview = undefined; failed = false;
    if (!visible) return;
    const controller = new AbortController();
    const revision = target.revision === undefined ? '' : `?revision=${target.revision}`;
    void queue.run(() => jsonRequest<LibraryPreview>(`/api/decks/${target.id}/preview${revision}`, 'GET', undefined,
      (input, init) => fetch(input, {...init, signal: controller.signal})), controller.signal).then(result => {
      if (!controller.signal.aborted && result.id === target.id && (target.revision === undefined || result.revision === target.revision)) preview = result;
    }).catch(() => { if (!controller.signal.aborted) failed = true; });
    return () => { controller.abort(); };
  });
</script>

<span class="doc-library-cover" aria-hidden="true" bind:this={host} data-preview-state={preview ? 'ready' : failed ? 'failed' : visible ? 'loading' : 'idle'}>
  {#if preview?.firstSlide}
    <div class="doc-library-preview" style:aspect-ratio={`${preview.width} / ${preview.height}`} style:width={`${Math.min(100, (preview.width / preview.height) / (16 / 9) * 100)}%`}>
      <SlideThumbnail deck={preview} slide={preview.firstSlide} original={Boolean(preview.firstSlide.source?.render)} />
    </div>
  {:else}<FileText size={32} />{/if}
</span>
{#if failed}<span class="sr-only">Preview unavailable. Open the document to view it.</span>{/if}
