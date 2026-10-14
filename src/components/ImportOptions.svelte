<script lang="ts">
  import {Button} from './ui';
  import { Upload } from '@lucide/svelte';
  import {uiIndicator} from '../ui-motion';
  import {isBrowserEdition} from '../core/runtime';
  let {cloudTab,cloudUrl,cloudToken,busy,documentImportBusy,onTab,onUrl,onToken,onChooseFile,onImport}: {
    cloudTab:string;cloudUrl:string;cloudToken:string;busy:string;documentImportBusy:boolean;
    onTab:(tab:string)=>void;onUrl:(value:string)=>void;onToken:(value:string)=>void;onChooseFile:()=>void;onImport:()=>void;
  }=$props();
</script>
      <div use:uiIndicator class="seg import-tabs">{#each [{id: 'file', label: 'Local file'}, {id: 'figma', label: 'Figma'}, {id: 'google', label: 'Google Slides'}] as tab}<button aria-pressed={cloudTab === tab.id} disabled={Boolean(busy)} onclick={()=>onTab(tab.id)}>{tab.label}</button>{/each}</div>
      {#if cloudTab === 'file'}
        <button class="import-drop" aria-busy={documentImportBusy || undefined} onclick={onChooseFile} disabled={Boolean(busy)}>{#if documentImportBusy}<span class="spinner" aria-hidden="true"></span>{:else}<Upload size={28} />{/if}<strong>Choose file</strong><span>{isBrowserEdition?'PowerPoint .pptx · PDF · Deck .deck.json':'PowerPoint .pptx · Keynote .key · PDF · Deck .deck.json'}</span></button>
        <details class="import-help"><summary>Import help</summary>
          <p>PowerPoint imports editable content. PDF keeps page images and extracts text.</p>
          <p>{isBrowserEdition?'Export Keynote to PowerPoint or PDF first.':'Keynote files require Keynote on this Mac.'}</p>
          <p>Figma .deck.json exports and Broadser board JSON are also supported.</p>
          <details><summary>Figma export plugin</summary><p>Load <code>plugins/figma-export/manifest.json</code> as a development plugin in Figma, then export a .deck.json file.</p></details>
        </details>
      {:else}
        <label class="field-label">File link<input aria-label="File link to import" disabled={Boolean(busy)} value={cloudUrl} oninput={event=>onUrl(event.currentTarget.value)} placeholder={cloudTab === 'figma' ? 'https://www.figma.com/slides/…' : 'https://docs.google.com/presentation/d/…'} /></label>
        <label class="field-label">Access token<input aria-label={cloudTab === 'figma' ? 'Figma access token' : 'Google OAuth access token'} type="password" disabled={Boolean(busy)} value={cloudToken} oninput={event=>onToken(event.currentTarget.value)} autocomplete="off" /></label>
        <p class="hint">Used for this import only. Cleared on success or close.</p>
        <details class="import-help"><summary>Token help</summary><p>{cloudTab === 'figma' ? 'Use a Figma token with read access to this file.' : 'Use an OAuth token with presentations.readonly access.'}</p></details>
        <Button variant="primary" busy={documentImportBusy} disabled={Boolean(busy) || !cloudUrl.trim() || !cloudToken.trim()} onclick={onImport}><Upload />Import {cloudTab === 'figma' ? 'Figma' : 'Google Slides'}</Button>
      {/if}
<style>
  .import-help { display: block; padding-top: 0; }
  .import-help summary { min-height: 36px; padding-block: 8px; cursor: pointer; }
  @media (max-width: 760px), (pointer: coarse) { .import-help summary { min-height: 44px; padding-block: 12px; } }
</style>
