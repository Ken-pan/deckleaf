<script lang="ts">
  import Notice from './ui/Notice.svelte';
  import {editor} from '../core/editor.svelte';
  import {Button, EmptyState} from './ui';
  import {uiDisclosure} from '../ui-motion';
  import {Upload,Type} from '@lucide/svelte';
  let {onimported}:{onimported?:()=>void}=$props();
  let family=$state(''),weight=$state('100 900'),style=$state<'normal'|'italic'>('normal'),busy=$state(false),error=$state('');
  let input:HTMLInputElement;
  async function importFont(file:File){
    if(!editor.deck||busy)return;const deckId=editor.deck.id,revision=editor.deck.revision;busy=true;error='';
    try{
      const ext=file.name.split('.').at(-1)?.toLowerCase();if(!['ttf','otf','woff','woff2'].includes(ext||'')||file.size>15_000_000)throw new Error('Choose a TTF, OTF, WOFF, or WOFF2 file smaller than 15 MB.');
      if(!/^\d{3}( \d{3})?$/.test(weight))throw new Error('Enter a weight such as 400 or a variable range such as 100 900.');
      const name=family.trim()||file.name.replace(/\.[^.]+$/,'');
      const bytes=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.slice(i,i+32768));const data=`data:font/${ext};base64,${btoa(str)}`;
      await new FontFace(name,`url(${data})`,{weight,style}).load();
      if(editor.deck?.id!==deckId||editor.deck.revision!==revision)throw new Error('The document has changed. Import the font again.');
      editor.commit([{op:'register_local_font',font:{family:name,name:file.name,data,weight,style}}],'','manual',revision);
      if(editor.deck.revision===revision)throw new Error(editor.error||'The font was not saved. Try again.');onimported?.();editor.notify(`Added ${name} to this document`);
    }catch(e:any){error=e.message;}finally{busy=false;input.value='';}
  }
</script>
<div class="document-fonts">
  <section class="document-font-section"><h3>Fonts in this document</h3>
  <div class="document-font-list">{#each editor.deck?.fonts||[] as font}<div><strong>{font.family}</strong><small>Embedded file · {font.weight} · {font.style}</small></div>{/each}{#each editor.deck?.onlineFonts||[] as font}<div><strong>{font.family}</strong><small>Online reference · {font.version} · {font.weights.join(' / ')}</small></div>{/each}{#if !editor.deck?.fonts?.length&&!editor.deck?.onlineFonts?.length}<section><EmptyState density="inline" icon={Type} title="No added fonts yet" description="Built-in fonts are ready to use. Add a font file below to keep it with this document." /></section>{/if}</div>
  </section>
  <section class="document-font-section"><h3>Import font file</h3><p class="hint">TTF, OTF, WOFF, or WOFF2 · Up to 15 MB</p>
    <label class="field-label">Font name (optional)<input aria-label="Imported font name" bind:value={family} placeholder="Use the file name" disabled={busy}/></label>
    <details class="font-import-options" use:uiDisclosure><summary>Weight and style</summary><div class="field-grid"><label class="field-label">Weight or range<input aria-label="Font weight" bind:value={weight} disabled={busy} placeholder="400 or 100 900"/></label><label class="field-label">Style<select aria-label="Font style" bind:value={style} disabled={busy}><option value="normal">Normal</option><option value="italic">Italic</option></select></label></div></details>
    <input bind:this={input} class="sr-only" type="file" accept=".ttf,.otf,.woff,.woff2" onchange={event=>{const file=event.currentTarget.files?.[0];if(file)void importFont(file);}}/>
    <Button variant="secondary" busy={busy} onclick={()=>input.click()}><Upload size={15}/>Choose font file</Button>
    {#if busy}<Notice tone="progress" indicator={false} message="Importing font…"/>{/if}
    {#if error}<Notice tone="error" title="Font could not be added" message={error} detail="Check the font file and try again."/>{/if}
    <p class="hint">Font files stay with this document. Install them on the destination device for PowerPoint or Keynote.</p>
  </section>
</div>
<style>
  .document-font-section{display:flex;flex-direction:column;gap:12px}.document-font-section+.document-font-section{margin-top:24px;padding-top:24px;border-top:1px solid var(--border-subtle)}
  .font-import-options summary{cursor:pointer;color:var(--text-secondary);font-size:var(--ui-label);padding-block:8px}.font-import-options[open] summary{margin-bottom:8px}
  .document-font-section :global(.field-label){margin:0}
  @media(pointer:coarse){.font-import-options summary{min-height:44px;padding-block:12px}.document-font-section :global(select),.document-font-section :global(input:not([type=file])),.document-font-section :global(button){min-height:44px}}
</style>
