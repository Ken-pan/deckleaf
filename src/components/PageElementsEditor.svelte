<script lang="ts">
  import {Trash2} from '@lucide/svelte';
  import NumberField from './ui/NumberField.svelte';
  import {onMount} from 'svelte';
  import Notice from './ui/Notice.svelte';
  import {editor} from '../core/editor.svelte';
  import {cloneDocumentData} from '../core/document-data';
  import {PageElementsSchema, element, type PageElements} from '../core/model';
  import {DEFAULT_PAGE_ELEMENTS, hidePageElements, pageElementsSettings, setSlidePageElements} from '../core/page-elements';
  import {pageElementFitIssues} from '../core/page-element-fit';
  import {slideLabel} from '../core/slide-label';
  import Dialog from './Dialog.svelte';
  import SlideCanvas from './SlideCanvas.svelte';
  import {Button, DialogFooter, SegmentedControl} from './ui';
  let {onclose}: {onclose: () => void} = $props();
  const capturedId = editor.deck!.id;
  let settings = $state<PageElements>(cloneDocumentData(pageElementsSettings(editor.deck!, editor.slide!)));
  let scope = $state('all'), error = $state('');
  let fontEpoch = $state(0), fontsLoading = $state(false);
  onMount(() => {
    const changed = () => {fontEpoch++; fontsLoading = document.fonts.status === 'loading';};
    changed();
    for (const event of ['loading','loadingdone','loadingerror']) document.fonts.addEventListener(event, changed);
    return () => {for (const event of ['loading','loadingdone','loadingerror']) document.fonts.removeEventListener(event, changed);};
  });
  let logoFile: HTMLInputElement;
  let preview = $derived.by(() => {
    try {
      const deck = editor.deck!, slide = editor.slide!;
      const parsed = PageElementsSchema.safeParse(settings);
      if (!parsed.success) return {slide, error: 'Enter a whole first number from 0 to 10,000.'};
      return {slide: setSlidePageElements(deck, slide, parsed.data, deck.slides.findIndex(s => s.id === slide.id)), error: ''};
    } catch (e) {return {slide: editor.slide!, error: e instanceof Error ? e.message : 'Check the page element settings.'};}
  });
  let lockedSlides = $derived(editor.deck!.slides.filter(s => (scope === 'all' || s.id === editor.activeId) && s.elements.some(e => e.pageElement && e.locked)).length);
  let fitIssues = $derived.by(() => {
    fontEpoch;
    if (preview.error) return [];
    const deck = editor.deck!;
    if (scope === 'slide') return pageElementFitIssues(deck, preview.slide);
    return deck.slides.flatMap((slide, index) => slide.elements.some(e => e.pageElement && e.locked) ? [] : pageElementFitIssues(deck, setSlidePageElements(deck, slide, settings, index)));
  });
  let numberValid=$state(true);
  function apply() {
    if(!numberValid)return;
    if (fontsLoading || fitIssues.length) return;
    if (editor.deck?.id !== capturedId) {error = 'The document changed. Reopen Slide details.'; return;}
    const result = PageElementsSchema.safeParse(settings);
    if (!result.success) {error = 'Check the settings. The first number must be a whole number from 0 to 10,000.'; return;}
    editor.error = '';
    editor.commit([{op: 'set_page_elements', settings: result.data, ...(scope === 'slide' ? {slideIds: [editor.activeId]} : {})}]);
    if (editor.error) {error = editor.error; return;}
    onclose();
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2_000_000) throw new Error('Choose a PNG, JPEG or WebP logo under 2 MB.');
      const src = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);});
      settings.logo = element('image', {name: file.name.slice(0,200), src, w: 152, h: 42, fit: 'contain'}); error = '';
    } catch (e) {error = e instanceof Error ? e.message : 'The logo could not be read. Try another image.';}
    if (logoFile) logoFile.value = '';
  }
</script>

<Dialog title="Slide details" wide onclose={onclose}>
  <div class="page-elements-workspace">
    <div class="page-elements-form">
      <label class="check-label"><input type="checkbox" bind:checked={settings.pageNumbers} />Page numbers</label>
      <label class="field-label">Slide label<input aria-label="Slide label" bind:value={settings.header} maxlength="300" placeholder="Project or section" /></label>
      <details>
        <summary>More details</summary>
        <div class="extra-settings">
          <div class="visibility-settings">
            <label class="check-label"><input type="checkbox" bind:checked={settings.hideOnCover} />Hide on cover</label>
            <label class="check-label"><input type="checkbox" bind:checked={settings.hideOnBreaks} />Hide on section slides</label>
            
          </div>
          {#if settings.pageNumbers}<div class="number-fields">
            <label class="field-label">Format<select aria-label="Page number format" bind:value={settings.numberFormat}><option value="padded">01, 02, 03</option><option value="number">1, 2, 3</option><option value="total">1 / Total</option></select></label>
            <NumberField label="First page number" prefix="Start at" preset="page" min={0} max={10000} value={settings.startAt} onvaliditychange={valid=>numberValid=valid} onchange={value=>settings.startAt=value}/>
          </div>{/if}
          <label class="field-label">Footer note<input aria-label="Footer note" bind:value={settings.footer} maxlength="300" placeholder="Confidential · Optional" /></label>
          <label class="field-label">Date<input aria-label="Date text" bind:value={settings.date} maxlength="100" placeholder="Optional" /></label>
          <div class="logo-settings">
            <span class="field-label">Logo</span>
            {#if settings.logo}<div class="chosen-logo"><img src={settings.logo.src} alt="Selected logo" /><span>{settings.logo.name}</span><Button tone="danger" aria-label="Remove logo" onclick={() => settings.logo = undefined}><Trash2 size={16}/>Remove</Button></div>{/if}
            <input bind:this={logoFile} class="logo-file" tabindex="-1" type="file" aria-label="Upload logo image" accept="image/png,image/jpeg,image/webp" onchange={e => void uploadLogo(e.currentTarget.files?.[0])} />
            <Button variant="secondary" onclick={() => logoFile.click()}>{settings.logo ? 'Replace image' : 'Add image'}</Button>
          </div>
          <p class="hint">Use <code>{'{section}'}</code> for the section or <code>{'{title}'}</code> for the document title. Numbers follow slide order, including hidden slides and covers.</p>
          <Button variant="secondary" onclick={() => settings = cloneDocumentData(DEFAULT_PAGE_ELEMENTS)}>Reset details</Button>
        </div>
      </details>
    </div>
    <div class="page-elements-preview">
      <div class="preview-caption"><span>{slideLabel(editor.deck!.slides.findIndex(s => s.id === editor.activeId))}</span><span>{hidePageElements(editor.slide!, editor.deck!.slides.findIndex(s => s.id === editor.activeId), settings) ? 'Details hidden on this slide' : 'Preview'}</span></div>
      <div class="preview-page"><SlideCanvas deck={editor.deck!} slide={preview.slide} interactive={false} /></div>
      <div class="field-label"><span>Apply to</span><SegmentedControl label="Slide details scope" options={[{value:'all',label:'All slides'},{value:'slide',label:'This slide'}]} value={scope} onchange={value => scope = value} /></div>
      {#if scope === 'all'}<p class="hint">Includes new slides. ⌘Z to undo.</p>{:else}<p class="hint">⌘Z to undo.</p>{/if}
      {#if fontsLoading}<p class="hint" role="status">Loading document fonts…</p>{/if}
      {#if lockedSlides}<Notice tone="warning" title="Slide details are locked" message={`Unlock the details on ${lockedSlides === 1 ? 'the affected slide' : `${lockedSlides} affected slides`} before applying.`}/>{/if}
      {#if fitIssues.length}{@const issue = fitIssues[0]}<Notice tone="error" title="Text does not fit" message={`Shorten the ${issue.kind === 'header' ? 'label' : issue.kind === 'footer' ? 'footer note' : issue.kind.replace('-', ' ')} on ${slideLabel(editor.deck!.slides.findIndex(s => s.id === issue.slideId))}.`}/>{/if}
      {#if error || preview.error}<Notice tone="error" title="Slide details could not update" message={error || preview.error}/>{/if}
    </div>
  </div>
  {#snippet footer()}<DialogFooter>
    {#snippet actions()}<Button variant="secondary" onclick={onclose}>Cancel</Button><Button variant="primary" disabled={Boolean(!numberValid || fontsLoading || preview.error || lockedSlides || fitIssues.length)} onclick={apply}>Apply details</Button>{/snippet}
  </DialogFooter>{/snippet}
</Dialog>

<style>
  .page-elements-workspace{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:24px}
  .page-elements-form,.page-elements-preview,.extra-settings{display:flex;flex-direction:column;gap:16px;min-width:0}
  .page-elements-form .field-label{margin:0}
  .page-elements-form input:not([type=checkbox]),.page-elements-form select{width:100%;min-width:0}
  .visibility-settings{display:flex;flex-direction:column;gap:4px}
  .number-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.7fr);gap:12px}
  .logo-settings{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0}
  .chosen-logo{display:flex;align-items:center;gap:8px;width:100%;min-width:0}.chosen-logo img{width:48px;height:28px;object-fit:contain}.chosen-logo span{flex:1;min-width:0;overflow-wrap:anywhere;font-size:var(--ui-label)}
  .logo-settings .logo-file{display:none}
  .check-label{display:flex;align-items:center;gap:8px;min-height:32px;font-size:var(--ui-text)}
  .check-label input[type=checkbox]{width:18px;height:18px;min-width:18px;flex:none;padding:0}
  .preview-caption{display:flex;justify-content:space-between;gap:8px;color:var(--text-secondary);font-size:var(--ui-label)}
  .preview-page{overflow:hidden;border:1px solid var(--border-default);border-radius:var(--r-item)}
  p{margin:0}
  details summary{cursor:pointer;font-size:var(--ui-text);min-height:32px;align-content:center}
  .extra-settings{padding-top:16px}code{font-size:inherit;overflow-wrap:anywhere}
  @media(max-width:760px){.page-elements-workspace{grid-template-columns:minmax(0,1fr);gap:24px}.page-elements-preview{order:-1}.check-label,details summary{min-height:44px}.number-fields select{min-height:44px}}
</style>
