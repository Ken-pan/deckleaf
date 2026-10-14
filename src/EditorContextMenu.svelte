<script lang="ts">
  import {slideLabel} from './core/slide-label';
  import {presentationStartIndex} from './core/slide-visibility';
  import {selectedSlideActions} from './slide-selection-actions';
  import { tick } from 'svelte';
  import { ArrowLeft, ArrowRight, Plus, MousePointer2, Play, Upload, Download, Type, Square, Circle, Minus, Table2, ChartColumn, Settings2, Sparkles, FileText, Copy, Trash2, Scan, X, MoveUp, MoveDown, Layers, BookOpen, Info, SquareDashedMousePointer, ExternalLink, Eye, EyeOff } from '@lucide/svelte';
  import { ResourcesIcon } from './components/icons/workspace-icons';
  import ContextMenu from './components/ui/ContextMenu.svelte';
  import { textContext } from './text-context-menu';
  import { editor } from './core/editor.svelte';
  import { focusCanvasSelection, objectAction } from './editor-focus';
  import {pasteFromClipboard,canvasPastePoint,slideClipboardActions} from './editor-clipboard';
  import type { ContextActions, ContextMenuItem, ContextRequest } from './context-menu';
  import type { LibraryDocument } from './core/document-library-view';
  import type { PrimitiveInsertTool, InsertTool } from './core/insertion';
  type Host = {
    modal:string; library:LibraryDocument[]; presenting:boolean; proposalDeck:boolean; insertTool:InsertTool|null; canvasFocus:boolean; busy:boolean; contextKey:string;
    openModal:(name:string)=>void; cancelPointer:()=>void; finishInlineText:()=>void; cancelInsertion:()=>void;
    openDeck:(id:string)=>Promise<void>; beginRename:(id:string,title:string)=>void; duplicateDocument:(id:string)=>Promise<void>;
    returnCurrentVersion:()=>void; showPanel:(panel:'design'|'ai')=>void; closePresentation:()=>void; presentFrom:(id?:string)=>void;
    toggleSlideHidden:(id:string)=>void; setSelectedSlidesHidden:(hidden:boolean)=>void; addSlideAfter:(id:string)=>void; duplicateSlide:(id:string)=>void; slideOrder:(id:string,step:number)=>void; enterEditable:()=>void; setZoom:(value:number|'fit')=>void;
    openResources:(id?:string)=>Promise<void>; insert:(tool:PrimitiveInsertTool)=>void; historyAction:(direction:'undo'|'redo')=>void;
    setCanvasFocus:(value:boolean)=>Promise<void>; showLayers:()=>void; openLibrary:()=>Promise<void>; openExport:()=>void;
  };
  let {host}:{host:Host}=$props();
  const contextKey=$derived(host.contextKey);
  let menu=$state<{openAt:(request:ContextRequest)=>void}>();
  export function openAt(request:ContextRequest){menu?.openAt(request);}
  let contextAlignment=$state<{openAt:(rect:DOMRect)=>void}>();
  let ContextAlignment=$state<typeof import('./components/AlignmentControls.svelte').default>();
  async function openContextAlignment(rect:DOMRect){ContextAlignment??=(await import('./components/AlignmentControls.svelte')).default;await tick();contextAlignment?.openAt(rect);}
  async function sceneContext({target,x,y}:ContextRequest):Promise<ContextActions|undefined> {
    const {modal,library,presenting,proposalDeck,insertTool,canvasFocus,busy,openModal,cancelPointer,finishInlineText,cancelInsertion,openDeck,beginRename,duplicateDocument,returnCurrentVersion,showPanel,closePresentation,presentFrom,toggleSlideHidden,addSlideAfter,duplicateSlide,slideOrder,enterEditable,setZoom,openResources,insert,historyAction,setCanvasFocus,showLayers,openLibrary,openExport}=host;
    const text=textContext(target,message=>editor.notify(message));if(text)return text;
    const action=(label:string,onselect:()=>void,icon?:ContextMenuItem['icon']):ContextMenuItem=>({label,onselect,icon});
    if(proposalDeck)return{label:'AI preview',items:[action('Return to current version',returnCurrentVersion,ArrowLeft),action('Review changes',()=>showPanel('ai'),Sparkles)]};
    const select=target.closest<HTMLSelectElement>('select');
    if(select)return{label:select.getAttribute('aria-label')||select.labels?.[0]?.textContent?.trim()||'Choose an option',items:Array.from(select.options).map(option=>({
      label:option.textContent?.trim()||'None',checked:option.selected,choice:!select.multiple,disabled:select.disabled||option.disabled||Boolean(option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled),
      onselect:()=>{if(!select.isConnected||!option.isConnected||select.disabled||!select.multiple&&option.selected)return;if(select.multiple)option.selected=!option.selected;else select.selectedIndex=option.index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));},
    }))};
    const toggle=target.closest<HTMLInputElement>('input[type="checkbox"],input[type="radio"]');
    if(toggle)return{label:toggle.getAttribute('aria-label')||toggle.labels?.[0]?.textContent?.trim()||'Option',items:[{label:toggle.type==='radio'?toggle.checked?'Selected':'Select':toggle.checked?'Turn off':'Turn on',checked:toggle.checked,choice:toggle.type==='radio',disabled:toggle.disabled||toggle.type==='radio'&&toggle.checked,onselect:()=>toggle.click()}]};
    const copied=window.getSelection();
    const copyText=async(value:string)=>{try{await navigator.clipboard.writeText(value);editor.notify('Copied');}catch{editor.notify('Clipboard access is unavailable. Use the keyboard shortcut.', 'warning');}};
    const link=target.closest<HTMLAnchorElement>('a[href]');
    if(link)return {label:link.textContent?.trim()||'Link',items:[action('Open link',()=>link.click(),ExternalLink),{label:'Copy link',icon:Copy,onselect:()=>copyText(link.href)}]};
    const documentRow=target.closest<HTMLElement>('.doc-library-file[data-deck-id]');
    if(documentRow){const item=library.find(d=>d.id===documentRow.dataset.deckId);if(item)return{label:item.title,items:[action('Open document',()=>void openDeck(item.id),FileText),action('Rename',()=>beginRename(item.id,item.title)),{label:'Duplicate document',icon:Copy,disabled:Boolean(busy)||Boolean(proposalDeck),onselect:()=>duplicateDocument(item.id)}]};}
    if(presenting)return{label:'Presentation',items:[action('Previous slide',()=>document.querySelector<HTMLButtonElement>('[aria-label="Previous slide or step"]')?.click(),ArrowLeft),action('Next slide',()=>document.querySelector<HTMLButtonElement>('[aria-label="Next slide or step"]')?.click(),ArrowRight),{...action('Exit presentation',closePresentation,X),divider:true}]};
    const thumb=target.closest<HTMLElement>('.slide-thumb[data-slide-id]');
    if(thumb&&editor.deck){
      const returnFocus=document.activeElement instanceof HTMLElement&&document.activeElement.matches('.canvas-stage [contenteditable="true"]')?document.activeElement:undefined;
      const selection=window.getSelection(),range=returnFocus&&selection?.rangeCount?selection.getRangeAt(0).cloneRange():undefined;
      const slide=editor.deck.slides.find(s=>s.id===thumb.dataset.slideId);
      if(slide&&!editor.selectedSlides.includes(slide.id)){cancelPointer();finishInlineText();editor.chooseSlide(slide.id);}
      if(slide&&editor.selectingSlides)return{label:`${editor.selectedSlides.length} slides selected`,items:selectedSlideActions(host.setSelectedSlidesHidden)};
      if(slide){const index=editor.deck.slides.indexOf(slide),start=presentationStartIndex(editor.deck.slides,index);return{label:slideLabel(index),returnFocus,restore:()=>{if(range&&returnFocus?.isConnected){selection?.removeAllRanges();selection?.addRange(range);}},items:[
        {label:slide.hidden?'Unhide slide':'Hide slide',icon:slide.hidden?Eye:EyeOff,shortcut:'⇧⌘H',onselect:()=>toggleSlideHidden(slide.id)},
        ...slideClipboardActions(slide.id),
        action('Add slide after this',()=>addSlideAfter(slide.id),Plus),action('Duplicate slide',()=>duplicateSlide(slide.id),Copy),
        {label:'Move earlier',icon:MoveUp,divider:true,disabled:index<1,onselect:()=>slideOrder(slide.id,-1)},
        {label:'Move later',icon:MoveDown,disabled:index>=editor.deck.slides.length-1,onselect:()=>slideOrder(slide.id,1)},
        {label:slide.hidden&&start!==null?`Present from slide ${start+1}`:'Present from here',icon:Play,disabled:start===null,onselect:()=>presentFrom(slide.id)},
        {label:'Delete slide',icon:Trash2,tone:'danger',divider:true,disabled:editor.deck.slides.length<2,onselect:()=>editor.commit([{op:'delete_slide',slideId:slide.id}])},
      ]};}
    }
    const canvas=target.closest('.canvas-stage'),layer=target.closest<HTMLElement>('[data-layer-row]'),object=target.closest<HTMLElement>('.slide-element[data-element-id],[data-chrome-id]');
    if(editor.sourceMode&&(canvas||layer||target.closest('.object-properties')))return{label:'Source reference',items:[action('Edit slide',enterEditable,MousePointer2),action('Fit to window',()=>setZoom('fit'),Scan),action('Present reference',()=>presentFrom(),Play)]};
    if(editor.slide&&(object||layer||target.closest('.selection-context,.object-properties,.multi-selection-outline')&&editor.selection.length)){
      cancelPointer();finishInlineText();cancelInsertion();
      const id=layer?.dataset.layerRow??object?.dataset.elementId??object?.dataset.chromeId;
      if(id){if(layer?.classList.contains('layer-group')){if(editor.selectedContainer!==id)editor.chooseGroup(id);}else if(!editor.selected.includes(id))editor.choose(id,false,Boolean(layer));}
      editor.hovered='';
      if(editor.selection.length){const key=host.contextKey;const {objectContextActions}=await import('./object-context-actions');if(host.contextKey!==key)return;return objectContextActions({properties:()=>showPanel('design'),replace:id=>void openResources(id),align:()=>void openContextAlignment(new DOMRect(x,y,0,0)),pastePoint:canvas?canvasPastePoint(x,y):undefined});}
    }
    if(canvas||target.closest('.slide-rail,.layer-browser')){
      cancelPointer();finishInlineText();
      const items:ContextMenuItem[]=[
        ...(insertTool?[action('Cancel insertion',cancelInsertion,X)]:[]),
        {label:'Paste',icon:Copy,shortcut:'⌘V',disabled:!editor.slide,onselect:()=>pasteFromClipboard()},
        {label:'Paste as text',disabled:!editor.slide,onselect:()=>pasteFromClipboard({textOnly:true})},
        {label:'Paste in place',shortcut:'⇧⌘V',disabled:!editor.slide,onselect:()=>pasteFromClipboard({inPlace:true})},
        ...(canvas?[{label:'Paste here',disabled:!editor.slide,onselect:()=>pasteFromClipboard({point:canvasPastePoint(x,y)})}]:[]),
        {label:'Insert',icon:Plus,disabled:!editor.slide,children:[action('Text',()=>insert('text'),Type),action('Rectangle',()=>insert('rect'),Square),action('Ellipse',()=>insert('ellipse'),Circle),action('Line',()=>insert('line'),Minus),action('Table',()=>insert('table'),Table2),action('Chart',()=>insert('chart'),ChartColumn),action('Resource library',()=>void openResources(),ResourcesIcon)]},
        {label:'Select all objects',icon:SquareDashedMousePointer,shortcut:'⌘A',disabled:!editor.slide?.elements.length,onselect:()=>{editor.selectAll();void focusCanvasSelection();}},
        {label:'Undo',shortcut:'⌘Z',divider:true,disabled:!editor.past.length,onselect:()=>historyAction('undo')},
        {label:'Redo',shortcut:'⇧⌘Z',disabled:!editor.future.length,onselect:()=>historyAction('redo')},
        {label:'View',icon:Scan,divider:true,children:[action('Fit to window',()=>setZoom('fit'),Scan),action('Actual size',()=>setZoom(1)),{label:'Layout guides',checked:editor.layoutGuides,onselect:()=>{editor.layoutGuides=!editor.layoutGuides;}},{label:'Focus canvas',checked:canvasFocus,onselect:()=>void setCanvasFocus(!canvasFocus)},action('Show layers',()=>{showLayers();},Layers)]},
        ...(editor.editingGroup?[action('Done editing group',()=>{editor.exitGroup();void focusCanvasSelection();},ArrowLeft)]:[]),
        action('Add slide',()=>openModal('layout'),Plus),
      ];return{label:target.closest('.slide-rail')?'Slides':target.closest('.layer-browser')?'Layers':'Canvas',items};
    }
    const button=target.closest<HTMLElement>('button,summary,select');
    if(button){const label=button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent?.trim()||'Control';return{label,items:[{label:label.length>48?'Activate control':label,disabled:button.matches(':disabled,[aria-disabled="true"]'),onselect:()=>button.click()}]};}
    const dialog=target.closest<HTMLDialogElement>('dialog:modal');
    if(dialog){const label=dialog.querySelector('h2')?.textContent||'Dialog';return{label,items:[...(copied?.toString()?[{label:'Copy selected text',icon:Copy,onselect:()=>copyText(copied.toString())}]:[]),action('Close',()=>dialog.querySelector<HTMLButtonElement>('[aria-label^="Close"]')?.click(),X)]};}
    return{label:'Decksprig',items:[...(copied?.toString()?[{label:'Copy selected text',icon:Copy,onselect:()=>copyText(copied.toString())}]:[]),action('Document library',()=>void openLibrary(),BookOpen),action('New document',()=>openModal('templates'),Plus),action('Import document',()=>openModal('import'),Upload),{label:'Export document',icon:Download,disabled:!editor.deck,onselect:openExport},{...action('Settings',()=>openModal('settings'),Settings2),divider:true},action('Keyboard shortcuts',()=>openModal('help'),Info)]};
  }
</script>
<ContextMenu bind:this={menu} resolve={sceneContext} {contextKey} allowRegistered={!host.proposalDeck} onerror={message=>editor.notify(message, 'warning')}/>
{#if ContextAlignment}<ContextAlignment compact hiddenTrigger bind:this={contextAlignment}/>{/if}
