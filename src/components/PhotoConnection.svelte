<script lang="ts">
  import {ExternalLink, X} from '@lucide/svelte';
  import type {StockPhotoProvider, PhotoProviderStatus} from '../core/resources';
  let {provider, status, onclose}: {provider: StockPhotoProvider; status?: PhotoProviderStatus; onconfigured?: (statuses: PhotoProviderStatus[]) => void; onclose: () => void} = $props();
  let label = $derived(provider === 'unsplash' ? 'Unsplash' : 'Pexels');
</script>
<section class="photo-connection" aria-label="{label} photo options">
  <header><h3>{label}</h3><button class="icon-btn small" aria-label="Close photo options" onclick={onclose}><X size={15}/></button></header>
  <p>{status?.configured ? 'Photo search is available.' : 'Search is unavailable. Browse the website and upload a licensed photo, or use Open collections.'}</p>
  <a href={provider === 'unsplash' ? 'https://unsplash.com/' : 'https://www.pexels.com/'} target="_blank" rel="noopener noreferrer">Browse {label}<ExternalLink size={13}/></a>
  {#if provider === 'unsplash'}<p>Unsplash images need an internet connection.</p>{/if}
</section>
<style>
  .photo-connection{background:var(--surface-base);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:16px;margin:12px 0;font-size:var(--ui-label)}.photo-connection header{display:flex;align-items:center;justify-content:space-between;gap:12px}.photo-connection h3{font-size:var(--ui-body)}.photo-connection p{font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary);margin:8px 0}.photo-connection a{display:inline-flex;align-items:center;gap:6px;min-height:44px}.photo-connection header button{min-width:44px;min-height:44px}@media(max-width:600px){.photo-connection{padding:12px}}
</style>
