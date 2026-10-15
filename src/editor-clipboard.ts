import {editor} from './core/editor.svelte';
import {clipboardFormats,CLIPBOARD_MIME,type ClipboardContent} from './core/clipboard';
import {focusCanvasSelection,focusSlideSelection} from './editor-focus';
import {editorCommands} from './core/clipboard-queue';
import {stamp,unchanged,pasteFailure,type PasteData,type ClipboardPasteOptions} from './clipboard-context';
export type {ClipboardPasteOptions} from './clipboard-context';
let pasteModule:Promise<typeof import('./clipboard-paste')>|undefined;
function enqueue(data:PasteData|Promise<PasteData>,placement:ClipboardPasteOptions){
  const captured=stamp();if(data instanceof Promise)void data.catch(()=>{});
  pasteModule??=import('./clipboard-paste').catch(error=>{pasteModule=undefined;throw error;});
  void pasteModule.catch(()=>{});
  return editorCommands.run(captured,stamp,async current=>{
    const module=await pasteModule!;unchanged(current);
    return module.applyPaste(data,placement,current);
  }).catch(pasteFailure);
}
const fields='input,textarea,select,[contenteditable]:not([contenteditable="false"])';
export function clipboardScope(target:EventTarget|null):'objects'|'slide'|undefined {
  if(!(target instanceof Element)||target.closest(fields))return;
  if(target.closest('.slide-rail,.focus-page-controls'))return 'slide';
  if(target.closest('.canvas-stage,.layer-browser,.object-properties,.property-panel[data-panel="design"]'))return 'objects';
}
function removeCopied(content:ClipboardContent){
  if(!editor.deck||editor.deck.id!==content.deckId)return;
  if(content.kind==='slides'){editor.deleteSlides(content.slides!.map(slide=>slide.id));}
  else if(content.kind==='slide'){
    if(editor.deck.slides.length<2){editor.notify('Keep at least one slide. Copy it instead.','warning');return;}
    editor.commit([{op:'delete_slide',slideId:content.slideId}]);
  }else editor.commit(content.members.map(e=>({op:'delete_element',slideId:content.slideId,elementId:e.id})));
}
export async function copySelection(options:{event?:ClipboardEvent;cut?:boolean;slideId?:string;slideIds?:readonly string[]}={}) {
  const {event,cut=false,slideId,slideIds}=options;
  event?.preventDefault();
  if(slideIds&&!slideIds.length)return;
  if(cut&&(slideIds?new Set(slideIds).size===(editor.deck?.slides.length??0):!slideId&&!editor.canCut||slideId&&editor.deck?.slides.length===1)){editor.notify(slideId||slideIds?'Keep at least one slide. Copy it instead.':'Unlock the selection before cutting.','warning');return;}
  const captured=stamp();
  try{
    const content=slideIds?editor.copySlides(slideIds,false):editor.copy(slideId,false);if(!content)return;
    const {json,text,html}=clipboardFormats(content);
    if(event?.clipboardData){
      event.clipboardData.setData('text/plain',text);event.clipboardData.setData('text/html',html);
      try{event.clipboardData.setData(CLIPBOARD_MIME,json);}catch{/* HTML carries the same validated payload. */}
    }else{
      await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);
    }
    const label=content.kind==='slides'?`${content.slides!.length} slides`:content.kind==='slide'?'Slide':'Objects';
    if(!cut)editor.notify(`${label} copied`);
    if(cut){unchanged(captured);const revision=editor.deck?.revision;removeCopied(content);if(editor.deck?.revision===revision)throw Error();editor.notify(`${label} cut · Undo available`);await (content.kind==='objects'?focusCanvasSelection():focusSlideSelection());}
  }catch(error){
    editor.notify(cut?'Could not cut. The originals are unchanged. Use the keyboard shortcut.':error instanceof Error&&/too large|source reference/.test(error.message)?error.message:'Copied locally. Use the keyboard shortcut to copy to other tabs or apps.','warning');
  }
}

export function pasteEvent(event:ClipboardEvent,placement:ClipboardPasteOptions={}) {
  event.preventDefault();const d=event.clipboardData;if(!d)return Promise.resolve();
  // Native clipboard data is protected after dispatch: capture it before entering the queue.
  return enqueue({json:d.getData(CLIPBOARD_MIME),html:d.getData('text/html'),text:d.getData('text/plain'),files:Array.from(d.files).filter(f=>f.type.startsWith('image/'))},placement);
}
async function systemClipboard(textOnly=false):Promise<PasteData>{
  let items:ClipboardItems;
  try{
    if(textOnly||typeof navigator.clipboard?.read!=='function')return{text:await navigator.clipboard.readText()};
    items=await navigator.clipboard.read();
  }catch{return{local:true};}
  const data:PasteData={files:[]};
  const snapshots=await Promise.all(items.map(async item=>{
    const type=item.types.find(t=>t.startsWith('image/'));
    const [html,text,file]=await Promise.all([
      item.types.includes('text/html')?item.getType('text/html').then(b=>b.text()):undefined,
      item.types.includes('text/plain')?item.getType('text/plain').then(b=>b.text()):undefined,
      type?item.getType(type).then(b=>new File([b],'Pasted image',{type})):undefined,
    ]);return{html,text,file};
  }));
  for(const snapshot of snapshots){if(snapshot.html)data.html=snapshot.html;if(snapshot.text)data.text=snapshot.text;if(snapshot.file)data.files!.push(snapshot.file);}
  return data;
}
export function pasteFromClipboard(placement:ClipboardPasteOptions={}):Promise<void> {
  if(!editor.deck||!editor.slide||editor.sourceMode&&!placement.slidesOnly)return Promise.resolve();
  // Start browser reads in the trusted click/keyboard event, before awaiting the queue.
  return enqueue(systemClipboard(placement.textOnly),placement);
}

export function canvasPastePoint(clientX:number,clientY:number){
  const page=document.querySelector<HTMLElement>('.canvas-stage .slide-render');
  const rect=page?.getBoundingClientRect();
  return rect&&rect.width&&rect.height&&editor.deck?{x:(clientX-rect.left)*editor.deck.width/rect.width,y:(clientY-rect.top)*editor.deck.height/rect.height}:undefined;
}

export function slideClipboardActions(slideId:string){
  return [
    {label:'Cut slide',shortcut:'⌘X',disabled:(editor.deck?.slides.length??0)<2,onselect:()=>copySelection({cut:true,slideId})},
    {label:'Copy slide',shortcut:'⌘C',onselect:()=>copySelection({slideId})},
    {label:'Paste',shortcut:'⌘V',onselect:()=>{editor.chooseSlide(slideId);return pasteFromClipboard({slidesOnly:editor.sourceMode});}},
  ];
}
