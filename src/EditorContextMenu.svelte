<script lang="ts">
  import {slideLabel} from './core/slide-label';
  import {presentationStartIndex} from './core/slide-visibility';
  import {selectedSlideActions} from './slide-selection-actions';
  import { ArrowLeft, ArrowRight, ClipboardPaste, Scissors, Pencil, Plus, MousePointer2, Play, Type, Square, Circle, Minus, Table2, ChartColumn, Sparkles, FileText, Copy, Trash2, Scan, X, MoveUp, MoveDown, SquareDashedMousePointer, ExternalLink, Eye, EyeOff } from '@lucide/svelte';
  import { ResourcesIcon } from './components/icons/workspace-icons';
  import ContextMenu from './components/ui/ContextMenu.svelte';
  import { textContext } from './text-context-menu';
  import { editor } from './core/editor.svelte';
  import { focusCanvasSelection } from './editor-focus';
  import {pasteFromClipboard,canvasPastePoint,copySelection} from './editor-clipboard';
  import type { ContextActions, ContextMenuItem, ContextRequest } from './context-menu';
  import type { LibraryDocument } from './core/document-library-view';
  import type { PrimitiveInsertTool, CanvasTool } from './core/insertion';
  type Host = {
    modal:string; library:LibraryDocument[]; presenting:boolean; proposalDeck:boolean; insertTool:CanvasTool|null; canvasFocus:boolean; busy:boolean; contextKey:string;
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
  async function sceneContext({target,x,y,keyboard}:ContextRequest):Promise<ContextActions|undefined> {
    const {library,presenting,proposalDeck,insertTool,busy,openModal,cancelPointer,finishInlineText,cancelInsertion,openDeck,beginRename,duplicateDocument,returnCurrentVersion,showPanel,closePresentation,presentFrom,toggleSlideHidden,addSlideAfter,duplicateSlide,slideOrder,enterEditable,setZoom,openResources,insert}=host;
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
    if(documentRow){const item=library.find(d=>d.id===documentRow.dataset.deckId);if(item)return{label:item.title,items:[action('Open document',()=>void openDeck(item.id),FileText),action('Rename',()=>beginRename(item.id,item.title),Pencil),{label:'Duplicate document',icon:Copy,disabled:Boolean(busy)||Boolean(proposalDeck),onselect:()=>duplicateDocument(item.id)}]};}
    if(presenting)return{label:'Presentation',items:[action('Previous slide',()=>document.querySelector<HTMLButtonElement>('[aria-label="Previous slide or step"]')?.click(),ArrowLeft),action('Next slide',()=>document.querySelector<HTMLButtonElement>('[aria-label="Next slide or step"]')?.click(),ArrowRight),{...action('Exit presentation',closePresentation,X),divider:true}]};
    const thumb=target.closest<HTMLElement>('.slide-thumb[data-slide-id]');
    if(thumb&&editor.deck){
      const returnFocus=document.activeElement instanceof HTMLElement&&document.activeElement.matches('.canvas-stage [contenteditable="true"]')?document.activeElement:undefined;
      const selection=window.getSelection(),range=returnFocus&&selection?.rangeCount?selection.getRangeAt(0).cloneRange():undefined;
      const slide=editor.deck.slides.find(s=>s.id===thumb.dataset.slideId);
      if(slide&&!editor.selectedSlides.includes(slide.id)){cancelPointer();finishInlineText();editor.chooseSlide(slide.id);}
      if(slide&&editor.selectingSlides){
        const actions=selectedSlideActions(host.setSelectedSlidesHidden);
        const move=actions.filter(item=>item.label.startsWith('Move ')&&!item.disabled).map(item=>({...item,divider:false}));
        const items:ContextMenuItem[]=actions.filter(item=>['Duplicate slides','Copy slides','Paste slides','Hide slides','Unhide slides'].includes(item.label)&&!item.disabled);
        if(move.length)items.push({label:'Move slides',icon:MoveUp,divider:true,children:move});
        items.push(...actions.filter(item=>['Done selecting','Delete slides'].includes(item.label)));
        return{label:`${editor.selectedSlides.length} slides selected`,items};
      }
      if(slide){const index=editor.deck.slides.indexOf(slide),start=presentationStartIndex(editor.deck.slides,index);return{label:slideLabel(index),returnFocus,restore:()=>{if(range&&returnFocus?.isConnected){selection?.removeAllRanges();selection?.addRange(range);}},items:[
        {label:slide.hidden?'Unhide slide':'Hide slide',icon:slide.hidden?Eye:EyeOff,shortcut:'⇧⌘H',onselect:()=>toggleSlideHidden(slide.id)},
        {label:'Cut slide',icon:Scissors,shortcut:'⌘X',disabled:editor.deck.slides.length<2,onselect:()=>copySelection({cut:true,slideId:slide.id})},
        {label:'Copy slide',icon:Copy,shortcut:'⌘C',onselect:()=>copySelection({slideId:slide.id})},
        {label:'Paste slides',icon:ClipboardPaste,shortcut:'⌘V',onselect:()=>pasteFromClipboard({slidesOnly:true})},
        action('Add slide after this',()=>addSlideAfter(slide.id),Plus),action('Duplicate slide',()=>duplicateSlide(slide.id),Copy),
        ...(editor.deck.slides.length>1?[{label:'Move slide',icon:MoveUp,divider:true,children:[
          ...(index>0?[action('Move earlier',()=>slideOrder(slide.id,-1),MoveUp)]:[]),
          ...(index<editor.deck.slides.length-1?[action('Move later',()=>slideOrder(slide.id,1),MoveDown)]:[]),
        ]}]:[]),
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
      if(editor.selection.length){const key=host.contextKey;const {objectContextActions}=await import('./object-context-actions');if(host.contextKey!==key)return;return objectContextActions({fromLayer:Boolean(layer),properties:()=>showPanel('design'),replace:id=>void openResources(id)});}
    }
    if(target.closest('.slide-rail'))return{label:'Slides',items:[
      action('Add slide',()=>openModal('layout'),Plus),
      {label:'Paste slides',icon:ClipboardPaste,shortcut:'⌘V',onselect:()=>pasteFromClipboard({slidesOnly:true})},
      {label:'Select all slides',icon:SquareDashedMousePointer,shortcut:'⌘A',onselect:()=>editor.selectAllSlides()},
    ]};
    if(canvas||target.closest('.layer-browser')){
      cancelPointer();finishInlineText();
      const items:ContextMenuItem[]=[
        ...(insertTool?[action('Cancel insertion',cancelInsertion,X)]:[]),
        {label:canvas&&!keyboard?'Paste here':'Paste',icon:ClipboardPaste,shortcut:'⌘V',disabled:!editor.slide,onselect:()=>pasteFromClipboard(canvas&&!keyboard?{point:canvasPastePoint(x,y)}:{})},
        ...(canvas?[{label:'Insert',icon:Plus,disabled:!editor.slide,children:[action('Text',()=>insert('text'),Type),action('Rectangle',()=>insert('rect'),Square),action('Ellipse',()=>insert('ellipse'),Circle),action('Line',()=>insert('line'),Minus),action('Table',()=>insert('table'),Table2),action('Chart',()=>insert('chart'),ChartColumn),action('Resource library',()=>void openResources(),ResourcesIcon)]}]:[]),
        ...(editor.slide?.elements.length?[{label:editor.editingGroup?'Select all group members':'Select all objects',icon:SquareDashedMousePointer,shortcut:'⌘A',onselect:()=>{editor.selectAll();void focusCanvasSelection();}}]:[]),
        ...(canvas?[{...action('Fit to window',()=>setZoom('fit'),Scan),divider:true}]:[]),
        ...(editor.editingGroup?[action('Done editing group',()=>{editor.exitGroup();void focusCanvasSelection();},ArrowLeft)]:[]),
      ];return{label:canvas?'Canvas':'Layers',items};
    }
    // Ordinary controls already expose their own actions. Do not turn empty
    // chrome into another document/settings menu.
    if(copied?.toString())return{label:'Text',items:[{label:'Copy selected text',icon:Copy,onselect:()=>copyText(copied.toString())}]};
    return;
  }
</script>
<ContextMenu bind:this={menu} resolve={sceneContext} {contextKey} allowRegistered={!host.proposalDeck} onerror={message=>editor.notify(message, 'warning')}/>
