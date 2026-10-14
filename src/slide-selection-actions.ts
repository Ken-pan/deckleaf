import {tick} from 'svelte';
import {Eye,EyeOff,SquareDashedMousePointer,Copy,ClipboardPaste,Trash2,MoveUp,MoveDown,ChevronsUp,ChevronsDown} from '@lucide/svelte';
import {editor} from './core/editor.svelte';
import {copySelection,pasteFromClipboard} from './editor-clipboard';

export function focusCurrentSlide(){void tick().then(()=>{const current=document.querySelector<HTMLButtonElement>('.slide-thumb.current');current?.focus({preventScroll:true});current?.scrollIntoView({block:'nearest',inline:'nearest'});});}
export function beginSlideSelection(){editor.beginSlideSelection();focusCurrentSlide();}
export function endSlideSelection(){editor.endSlideSelection();focusCurrentSlide();}
export function selectedSlideActions(setHidden:(hidden:boolean)=>void){
  const ids=new Set(editor.selectedSlides),slides=editor.deck?.slides.filter(slide=>ids.has(slide.id))??[];
  const order=editor.deck?.slides??[],first=order.findIndex(slide=>ids.has(slide.id)),last=order.map(slide=>ids.has(slide.id)).lastIndexOf(true);
  const atStart=slides.every((slide,index)=>slide.id===order[index]?.id),atEnd=slides.every((slide,index)=>slide.id===order[order.length-slides.length+index]?.id);
  return [
    {label:'Duplicate slides',icon:Copy,shortcut:'⌘D',disabled:!slides.length||order.length+slides.length>500,onselect:()=>{editor.duplicateSlides();focusCurrentSlide();}},
    {label:'Copy slides',shortcut:'⌘C',disabled:!slides.length,onselect:()=>copySelection({slideIds:editor.selectedSlides})},
    {label:'Paste slides',icon:ClipboardPaste,shortcut:'⌘V',onselect:()=>pasteFromClipboard({slidesOnly:true})},
    {label:'Hide slides',icon:EyeOff,divider:true,shortcut:slides.some(slide=>!slide.hidden)?'⇧⌘H':undefined,disabled:!slides.some(slide=>!slide.hidden),onselect:()=>setHidden(true)},
    {label:'Unhide slides',icon:Eye,shortcut:slides.length&&slides.every(slide=>slide.hidden)?'⇧⌘H':undefined,disabled:!slides.some(slide=>slide.hidden),onselect:()=>setHidden(false)},
    {label:'Move earlier',icon:MoveUp,shortcut:'⌥↑',divider:true,disabled:first<=0,onselect:()=>{editor.moveSlides(editor.selectedSlides,'earlier');focusCurrentSlide();}},
    {label:'Move later',icon:MoveDown,shortcut:'⌥↓',disabled:last<0||last>=order.length-1,onselect:()=>{editor.moveSlides(editor.selectedSlides,'later');focusCurrentSlide();}},
    {label:'Move to start',icon:ChevronsUp,disabled:!slides.length||atStart,onselect:()=>{editor.moveSlides(editor.selectedSlides,'start');focusCurrentSlide();}},
    {label:'Move to end',icon:ChevronsDown,disabled:!slides.length||atEnd,onselect:()=>{editor.moveSlides(editor.selectedSlides,'end');focusCurrentSlide();}},
    {label:'Select all slides',shortcut:'⌘A',icon:SquareDashedMousePointer,divider:true,disabled:slides.length===editor.deck?.slides.length,onselect:()=>editor.selectAllSlides()},
    {label:'Clear selection',disabled:!slides.length,onselect:()=>{editor.slideSelectionMode=true;editor.selectedSlides=[];}},
    {label:'Done selecting',onselect:endSlideSelection},
    ...(slides.length===order.length?[{label:'Keep at least one slide',disabled:true,onselect:()=>{}}]:[]),
    {label:'Delete slides',icon:Trash2,shortcut:'⌫',tone:'danger' as const,divider:true,disabled:!slides.length||slides.length===order.length,onselect:()=>{editor.deleteSlides();focusCurrentSlide();}},
  ];
}
