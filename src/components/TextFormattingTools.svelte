<script lang="ts">
  import {onMount, tick, untrack} from 'svelte';
  import {Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown, Check, X} from '@lucide/svelte';
  import {Button} from './ui';
  import {deckDesignSystem,COLOR_LABELS,TEXT_LABELS} from '../core/deck-design-system';
  import {documentTextChoices} from '../core/document-style-choices';
  import {objectTextStyleOperations,objectColorStyleOperations} from '../core/object-style-operations';
  import {COLOR_ROLES,type ColorRole,type TextRole} from '../core/design-system-schema';
  import DocumentColorChoices from './DocumentColorChoices.svelte';
  import {swatchInk} from '../selection-color';
  import {positionFloating} from '../ui-viewport';
  import '../selection-tools.css';
  import {editor} from '../core/editor.svelte';
  import {textPropertyState, textToggleState} from '../core/text-properties';
  import {textRangeStylePatch, textRangeTarget, type TextFormatPatch, type TextFormatState, type TextRange} from '../core/text-range-format';
  let {inline=false, readInline, onformat}: {inline?: boolean; readInline: () => TextFormatState | null; onformat: (patch: TextFormatPatch, range?: TextRange) => Promise<void> | void} = $props();
  let context=$state<TextFormatState|null>(null), menu=$state<'size'|'color'|'style'|''>(''), opened=$state(false);
  let popup=$state<HTMLDivElement>(), sizeButton=$state<HTMLButtonElement>(), colorButton=$state<HTMLButtonElement>(), styleButton=$state<HTMLButtonElement>();
  let numeric=$state<number|string|undefined>(''), hex=$state(''), popupFrame=0;
  const id=$props.id();
  const elements=$derived(inline&&context ? [textRangeTarget(context.element,context.range)] : editor.selection.filter(e=>e.type==='text'));
  const size=$derived(textPropertyState(elements,'fontSize')), color=$derived(textPropertyState(elements,'fill'));
  const alignment=$derived(textPropertyState(elements,'align'));
  const bold=$derived(textToggleState(elements,'bold')), italic=$derived(textToggleState(elements,'italic')), underline=$derived(textToggleState(elements,'underline'));
  const disabled=$derived(!elements.some(e=>!e.locked)||(inline&&(!context||context.range.start===context.range.end)));
  const system=$derived(deckDesignSystem(editor.deck??{}));
  const styleElements=$derived(elements.filter(e=>!e.locked&&!e.resource&&!e.sourceRegion));
  const choices=$derived(editor.deck?documentTextChoices(editor.deck,elements):[]);
  const linkedRole=$derived(!inline&&elements.length&&elements.every(e=>e.design?.text===elements[0].design?.text)?elements[0].design?.text:undefined);
  const typeOverrides=$derived(elements.some(e=>e.design?.overrides?.length||e.design?.font));
  const colorRole=$derived(inline?!color.mixed?COLOR_ROLES.find(r=>system.colors[r].toLowerCase()===color.value?.toLowerCase()):undefined:elements.length&&elements.every(e=>e.design?.fill===elements[0].design?.fill)?elements[0].design?.fill:'mixed');
  const sizes=[12,16,20,24,28,32,40,48,56,64,72,92,120,144];
  const colors=$derived([...new Set((editor.slide?.elements.map(e=>e.fill)||[]).filter(c=>/^#[\da-f]{6}$/i.test(c)&&!Object.values(system.colors).some(v=>v.toLowerCase()===c.toLowerCase())))].slice(0,14));
  function refresh() { context=inline ? readInline() : null; }
  $effect(()=>{inline; editor.editingId; untrack(refresh);});
  function origin() { return menu==='size'?sizeButton:menu==='color'?colorButton:styleButton; }
  function position() {
    if(!popup?.matches(':popover-open'))return;
    const button=origin();if(!button)return;
    const body=popup.querySelector<HTMLElement>('.selection-format-body');
    const header=popup.querySelector<HTMLElement>('header');
    positionFloating(popup,button.getBoundingClientRect(),{preferredHeight:(body?.scrollHeight??0)+(header?.offsetHeight??0)+2,minHeight:160});
  }
  function schedule() { cancelAnimationFrame(popupFrame);popupFrame=requestAnimationFrame(position); }
  async function open(next:typeof menu) {
    refresh();if(disabled)return;
    if(menu===next&&popup?.matches(':popover-open')){close();return;}
    popup?.hidePopover();menu=next; numeric=size.mixed?'':String(size.value??32);hex=color.mixed?'':String(color.value??'#111827');
    await tick();popup?.showPopover();position();popup?.focus({preventScroll:true});
  }
  function close() { popup?.hidePopover();restoreFocus(origin()); }
  async function apply(patch:TextFormatPatch) {
    const focused = document.activeElement as HTMLElement | null, fromPopup = popup?.matches(':popover-open');
    const captured=inline?(readInline()??context):null;
    if(inline){if(!captured||captured.range.start===captured.range.end)return;await onformat(patch,captured.range);}
    else if(editor.slide)editor.commit(editor.selection.filter(e=>e.type==='text'&&!e.locked).map(e=>({op:'update_element',slideId:editor.slide!.id,elementId:e.id,patch:textRangeStylePatch(e,patch)})));
    refresh();popup?.hidePopover();if(!inline)(fromPopup ? origin() : focused)?.focus({preventScroll:true});
  }
  async function chooseTextStyle(role:TextRole){
    if(!editor.deck)return;
    if(inline){const captured=readInline()??context;if(!captured)return;const style=system.typography[role],size=documentTextChoices(editor.deck,[captured.element]).find(c=>c.role===role)!.size!;await apply({fontFamily:style.fontFamily,fontSize:size,fontWeight:style.fontWeight});}
    else if(editor.slide){const deck=editor.operationDocument();editor.commit(styleElements.flatMap(e=>objectTextStyleOperations(deck,editor.slide!.id,[e.id],role,e.design?.text===role)));close();}
  }
  function chooseColor(role:ColorRole){
    if(inline){void apply({fill:system.colors[role]});return;}
    if(editor.slide&&editor.deck){editor.commit(objectColorStyleOperations(editor.operationDocument(),editor.slide.id,styleElements.map(e=>e.id),'fill',role));close();}
  }
  function customSize(event:SubmitEvent) {event.preventDefault();const value=Number(numeric);if(String(numeric??'').trim()&&Number.isFinite(value)&&value>=4&&value<=500)void apply({fontSize:value});}
  function customColor(event:SubmitEvent) {event.preventDefault();if(/^#[\da-f]{6}$/i.test(hex))void apply({fill:hex});}
  function key(event:KeyboardEvent) {if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();close();}}
  function formatKey(event: KeyboardEvent) {
    const key = event.key.toLowerCase(), target = event.target;
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) || !['b','i','u'].includes(key)) return;
    if (!(target instanceof HTMLElement) || !target.closest('.canvas-stage,.layer-browser,.object-properties') || target.closest('input,textarea,select') || target.closest('[contenteditable="true"]') && !inline || document.querySelector('dialog:modal,[popover]:popover-open:not([role="tooltip"])')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    refresh();
    if (event.repeat || disabled) return;
    void apply(key === 'b' ? {fontWeight: bold === true ? 400 : 700} : key === 'i' ? {italic: italic !== true} : {underline: underline !== true});
  }
  onMount(()=>{
    const observer=new ResizeObserver(schedule);if(popup)observer.observe(popup);
    document.addEventListener('selectionchange',refresh);document.addEventListener('input',refresh);
    window.addEventListener('deck-studio-text-format',refresh);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);document.addEventListener('scroll',schedule,true);
    window.addEventListener('keydown',formatKey,true);
    return()=>{observer.disconnect();cancelAnimationFrame(popupFrame);document.removeEventListener('selectionchange',refresh);document.removeEventListener('input',refresh);window.removeEventListener('keydown',formatKey,true);window.removeEventListener('deck-studio-text-format',refresh);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);document.removeEventListener('scroll',schedule,true);};
  });
  import {popoverFocus,restoreFocus} from '../ui-focus';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="text-quick-tools" data-text-formatting onpointerdowncapture={refresh}>
  <span id={`${id}-size-description`} hidden>{disabled?'Select text to format':size.mixed?'Mixed font sizes':`Current size ${size.value}`}</span>
  <span id={`${id}-color-description`} hidden>{disabled?'Select text to format':color.mixed?'Mixed text colors':`Current color ${color.value}`}</span>
  <button bind:this={sizeButton} class="text-btn quick-size" aria-label={`Text style and size · ${size.mixed?'Mixed':Math.round((size.value??32)*10)/10}`} aria-describedby={`${id}-size-description`} title={disabled?'Select text to format':'Text style and size'} aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='size'} disabled={disabled} onclick={()=>open('size')}><span>{size.mixed?'—':Math.round((size.value??32)*10)/10}</span><ChevronDown size={12}/></button>
  <button class="icon-btn" aria-label="Bold" title={disabled?'Select text to format':'Bold'} aria-pressed={bold} disabled={disabled} onpointerdown={event=>event.preventDefault()} onclick={()=>apply({fontWeight:bold===true?400:700})}><Bold size={16}/></button>
  <button bind:this={colorButton} class="text-btn quick-color" aria-label="Text color" aria-describedby={`${id}-color-description`} title={disabled?'Select text to format':'Text color'} aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='color'} disabled={disabled} onclick={()=>open('color')}><span class="selection-color-glyph text-color-glyph" aria-hidden="true">A<span class="selection-color-mark" class:mixed={color.mixed} style:background={color.mixed?undefined:color.value}></span></span></button>
  <button bind:this={styleButton} class="text-btn quick-style" aria-label="More text formatting" title="More text formatting" aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='style'} disabled={disabled} onclick={()=>open('style')}><span aria-hidden="true">Aa</span><ChevronDown size={12}/></button>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div bind:this={popup} id={id} use:popoverFocus={{close:()=>popup?.hidePopover(), origin:()=>origin()}} popover="auto" data-text-formatting class="text-format-popover selection-tools-popover canvas-controls-popover" role="dialog" tabindex="-1" aria-label={menu==='size'?'Text style and size options':menu==='color'?'Text color options':'Text formatting options'} onbeforetoggle={event=>opened=event.newState==='open'} onkeydown={key}>
    <header><strong>{menu==='size'?'Text style and size':menu==='color'?'Text color':'Text style'}</strong><button class="icon-btn" aria-label="Close text formatting" onclick={close}><X size={16}/></button></header>
    <div class="selection-format-body">
      {#if menu==='size'}
        <span class="text-format-label">Document styles</span>
        <div class="document-text-choices" role="group" aria-label="Document text styles">{#each choices as choice}<button class="text-btn" aria-pressed={linkedRole===choice.role} disabled={!inline&&!styleElements.length} onclick={()=>chooseTextStyle(choice.role)}><span><strong>{choice.label}</strong><small>{choice.fontFamily}</small></span><span class="style-size">{choice.size===undefined?'Mixed':Math.round(choice.size*10)/10}</span></button>{/each}</div>
        <p class="hint">{inline?'Selected text only':linkedRole?`${TEXT_LABELS[linkedRole]} · ${typeOverrides?'Custom formatting':'Follows document styles'}`:'Choose a style to follow the document.'}</p>
        <details class="format-custom-options"><summary>Other sizes</summary><div class="size-presets">{#each sizes as value}<button class="text-btn" aria-pressed={!size.mixed&&size.value===value} onclick={()=>apply({fontSize:value})}>{value}</button>{/each}</div></details>
        <form class="text-custom-value" onsubmit={customSize}><label>Custom size<input aria-label="Custom font size" type="number" min="4" max="500" step="any" bind:value={numeric}/></label><Button variant="secondary" type="submit">Apply</Button></form>
      {:else if menu==='color'}
        <DocumentColorChoices value={colorRole} disabled={!inline&&!styleElements.length} onchoose={chooseColor}/>
        <p class="hint">{inline?'Selected text only':colorRole&&colorRole!=='mixed'?`${COLOR_LABELS[colorRole]} · Follows document colors`:colorRole==='mixed'?'Mixed color links':'Custom color'}</p>
        <details class="format-custom-options"><summary>Custom color</summary>{#if colors.length}<div class="color-presets">{#each colors as value}<button class="color-swatch" style:background={value} style:color={swatchInk(value)} aria-label={`Text color ${value}`} aria-pressed={!color.mixed&&color.value?.toLowerCase()===value.toLowerCase()} onclick={()=>apply({fill:value})}>{#if !color.mixed&&color.value?.toLowerCase()===value.toLowerCase()}<Check size={16}/>{/if}</button>{/each}</div>{/if}<form class="text-custom-value" onsubmit={customColor}><label>Hex color<input aria-label="Hex text color" type="text" maxlength="7" pattern={'#[0-9a-fA-F]{6}'} bind:value={hex}/></label><Button variant="secondary" type="submit">Apply</Button></form></details>
      {:else if menu==='style'}
        <div class="text-style-buttons"><button class="text-btn" aria-label="Italic" aria-pressed={italic} onclick={()=>apply({italic:italic!==true})}><Italic size={16}/>Italic</button><button class="text-btn" aria-label="Underline" aria-pressed={underline} onclick={()=>apply({underline:underline!==true})}><Underline size={16}/>Underline</button></div>
        <span class="text-format-label">Paragraph alignment</span>
        <div class="text-align-buttons">{#each [{value:'left',icon:AlignLeft,label:'Text align left'},{value:'center',icon:AlignCenter,label:'Text align center'},{value:'right',icon:AlignRight,label:'Text align right'}] as item}<button class="icon-btn" aria-label={item.label} aria-pressed={!alignment.mixed&&alignment.value===item.value} onclick={()=>apply({align:item.value as 'left'|'center'|'right'})}><item.icon size={16}/></button>{/each}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .text-quick-tools{display:flex;align-items:center;gap:4px;flex:none}.quick-size{min-width:60px;font-variant-numeric:tabular-nums;gap:4px}.quick-style{gap:4px}.text-color-glyph{font-size:16px;font-weight:var(--ui-weight-semibold);line-height:1}.size-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(4.5em,1fr));gap:4px}.size-presets>button{padding-inline:4px}
  .text-format-popover .text-custom-value{flex-direction:row;align-items:end;padding:0;gap:8px}.text-custom-value label{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.text-custom-value input{width:100%;min-width:0}.text-style-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(8em,1fr));gap:8px}.text-align-buttons{display:flex;justify-content:space-between;gap:8px}.text-align-buttons>button{flex:1}.text-format-label{color:var(--text-secondary)}
  @media(max-width:760px),(pointer:coarse){.quick-size{min-width:56px}.text-quick-tools{gap:2px}.text-quick-tools>button{padding-inline:8px}.quick-style :global(svg){display:none}}
</style>
