import {editor} from './core/editor.svelte';
import {tick} from 'svelte';
import {clipboardText,pasteOffset} from './core/clipboard';
import {focusCanvasSelection} from './editor-focus';
import {insertedElement} from './core/insertion';
import {ClipboardQueue} from './core/clipboard-queue';
import {yieldForInput} from './core/text-layout';
import {stamp,unchanged,pasteFailure,type PasteData,type ClipboardPasteOptions} from './clipboard-context';
const pasteQueue=new ClipboardQueue();
async function focusPastedContent(){
  if(editor.clipboardContent?.kind==='objects')return focusCanvasSelection();
  await tick();const current=document.querySelector<HTMLButtonElement>('.slide-thumb.current');current?.focus({preventScroll:true});current?.scrollIntoView({block:'nearest',inline:'nearest'});
}
async function pasteData(data:PasteData,placement:ClipboardPasteOptions,captured=stamp()):Promise<string> {
  unchanged(captured);
  if((data.json?.length??0)+(data.html?.length??0)>262144){editor.notify('Pasting…','info');await yieldForInput();unchanged(captured);}
  const content=!placement.textOnly&&(data.json||data.html)?(await import('./core/clipboard-codec')).readClipboardContent(data.json??'',data.html??''):undefined;
  unchanged(captured);
  if(placement.slidesOnly&&(!content||content.kind==='objects'))throw new Error('Copy slides before pasting into the slide list.');
  if(content){editor.pasteContent(content,placement);const after=stamp();await focusPastedContent();return after;}
  let elements;
  if(!placement.textOnly&&data.files?.length){
    const {localImageElements}=await import('./core/local-images');
    elements=await localImageElements(data.files,editor.deck!);unchanged(captured);
    elements=elements.map((e,i)=>({...e,x:e.x+24*i,y:e.y+24*i}));
  }else if(data.text){
    const text=data.text.replace(/\r\n?/g,'\n');
    if(text.length>50000)throw new Error('Paste fewer than 50,000 characters at a time.');
    const table=!placement.textOnly&&text.includes('\t'),style=editor.selection.length===1&&editor.selection[0].type==='text'?editor.selection[0]:undefined;
    const w=style&&!table?style.w:Math.min(editor.deck!.width*.7,720),h=table?Math.min(editor.deck!.height*.6,360):48;
    const e=insertedElement(table?'table':'text',editor.deck!,{x:0,y:0,w,h,textSizing:'auto-height'});
    if(table){const {parseTableData}=await import('./core/object-data');e.cells=parseTableData(text);e.name='Pasted table';}else{e.text=text;e.name='Pasted text';e.textSizing='auto-height';if(style){for(const key of ['fontFamily','fontSize','fontWeight','italic','underline','align','lineHeight','letterSpacing','fill','verticalAlign'] as const)(e as any)[key]=style[key];delete e.design;}}
    elements=[e];
  }else throw new Error(placement.textOnly?'Copy text, then choose Paste as text.':'Copy objects, text, a cell range, or an image, then paste again.');
  unchanged(captured);
  // External content starts at a selected object's position, or a visible page inset.
  const point=placement.point??{x:editor.selection[0]?.x??Math.min(96,editor.deck!.width*.08),y:editor.selection[0]?.y??Math.min(96,editor.deck!.height*.08)};
  const delta=pasteOffset(elements,[],editor.deck!,0,{point});
  const group=editor.editingGroup,revision=editor.deck!.revision;
  const placed=elements.map(e=>({...e,x:e.x+delta.x,y:e.y+delta.y,...(group?{group}:{})}));
  editor.commit(placed.map(element=>({op:'add_element',slideId:editor.activeId,element})),'','manual',revision);
  const changed=editor.deck!.revision!==revision;
  if(changed){editor.selected=placed.map(e=>e.id);editor.selectedGroup='';editor.notify('Pasted · Undo available');}
  const after=stamp();if(changed)await focusCanvasSelection();return after;
}

export function queuePaste(data:PasteData|Promise<PasteData>,placement:ClipboardPasteOptions,captured=stamp()):Promise<void>{
  // Attach a rejection handler immediately, even while an earlier paste is running.
  const prepared=Promise.resolve(data).then(value=>({value}),error=>({error}));
  return pasteQueue.run(captured,stamp,async current=>{
    unchanged(current);
    const timer=setTimeout(()=>editor.notify('Pasting…','info'),150);
    try{
      const result=await prepared;if('error' in result)throw result.error;unchanged(current);
      const value=result.value!;
      if(value.local){
        if(!editor.clipboardContent)throw new Error('Use the keyboard shortcut to paste from the system clipboard.');
        if(placement.slidesOnly&&editor.clipboardContent.kind==='objects')throw new Error('Copy slides before pasting into the slide list.');
        if(placement.textOnly)return pasteData({text:clipboardText(editor.clipboardContent)},placement,current);
        editor.paste(placement);const after=stamp();editor.notify('Pasted the local copy. System clipboard access is unavailable.','warning');await focusPastedContent();return after;
      }
      return await pasteData(value,placement,current);
    }finally{clearTimeout(timer);}
  }).catch(pasteFailure);
}
