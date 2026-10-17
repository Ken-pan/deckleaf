<script lang="ts">
  import {Button, SegmentedControl} from './ui';
  import { Upload, ChevronDown } from '@lucide/svelte';
  import {isBrowserEdition} from '../core/runtime';
  let {cloudTab,cloudUrl,cloudToken,busy,documentImportBusy,onTab,onUrl,onToken,onChooseFile,onImport}: {
    cloudTab:string;cloudUrl:string;cloudToken:string;busy:string;documentImportBusy:boolean;
    onTab:(tab:string)=>void;onUrl:(value:string)=>void;onToken:(value:string)=>void;onChooseFile:()=>void;onImport:()=>void;
  }=$props();
</script>
<div class="import-options ui-control-surface ui-property-surface">
      <SegmentedControl class="import-tabs" label="Import source" options={[{value:'file',label:'Local file'},{value:'figma',label:'Figma'},{value:'google',label:'Google Slides'}]} value={cloudTab} disabled={Boolean(busy)} onchange={onTab}/>
      {#if cloudTab === 'file'}
        <button class="import-drop" aria-busy={documentImportBusy || undefined} onclick={onChooseFile} disabled={Boolean(busy)}>{#if documentImportBusy}<span class="spinner" aria-hidden="true"></span>{:else}<Upload size={16} />{/if}<strong>Choose file</strong><span>{isBrowserEdition?'PowerPoint .pptx · PDF · Deck .deck.json':'PowerPoint .pptx · Keynote .key · PDF · Deck .deck.json'}</span></button>
        <details class="import-help ui-control-disclosure"><summary><span>Import help</span><ChevronDown size={14}/></summary>
          <p>PowerPoint imports editable content. PDF keeps page images and extracts text.</p>
          <p>{isBrowserEdition?'Export Keynote to PowerPoint or PDF first.':'Keynote files require Keynote on this Mac.'}</p>
          <p>Figma .deck.json exports and Broadser board JSON are also supported.</p>
          <details class="ui-control-disclosure"><summary><span>Figma export plugin</span><ChevronDown size={14}/></summary><p>Load <code>plugins/figma-export/manifest.json</code> as a development plugin in Figma, then export a .deck.json file.</p></details>
        </details>
      {:else}
        <label class="field-label">File link<input class="ui-property-input" aria-label="File link to import" disabled={Boolean(busy)} value={cloudUrl} oninput={event=>onUrl(event.currentTarget.value)} placeholder={cloudTab === 'figma' ? 'https://www.figma.com/slides/…' : 'https://docs.google.com/presentation/d/…'} /></label>
        <label class="field-label">Access token<input class="ui-property-input" aria-label={cloudTab === 'figma' ? 'Figma access token' : 'Google OAuth access token'} type="password" disabled={Boolean(busy)} value={cloudToken} oninput={event=>onToken(event.currentTarget.value)} autocomplete="off" /></label>
        <p class="hint">Used for this import only. Cleared on success or close.</p>
        <details class="import-help ui-control-disclosure"><summary><span>Token help</span><ChevronDown size={14}/></summary><p>{cloudTab === 'figma' ? 'Use a Figma token with read access to this file.' : 'Use an OAuth token with presentations.readonly access.'}</p></details>
        <Button variant="primary" busy={documentImportBusy} disabled={Boolean(busy) || !cloudUrl.trim() || !cloudToken.trim()} onclick={onImport}><Upload size={16} />Import {cloudTab === 'figma' ? 'Figma' : 'Google Slides'}</Button>
      {/if}
</div>
<style>
  .import-options { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .import-options :global(.import-tabs) { width: 100%; display: flex; margin: 0; }
  .import-options :global(.import-tabs > button) { flex: 1; min-width: 0; white-space: normal; padding-inline: 8px; }
  .import-options > .field-label { margin: 0; }
  .import-help { display: block; padding-top: 0; }
</style>
