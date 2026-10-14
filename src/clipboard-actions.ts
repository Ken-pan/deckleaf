import {Copy,Scissors,ClipboardPaste} from '@lucide/svelte';
import {editor} from './core/editor.svelte';
import {copySelection,pasteFromClipboard} from './editor-clipboard';

export function objectClipboardActions(){return[
  {label:'Cut',icon:Scissors,shortcut:'⌘X',disabled:!editor.canCut,onselect:()=>copySelection({cut:true})},
  {label:'Copy',icon:Copy,shortcut:'⌘C',disabled:!editor.selected.length,onselect:()=>copySelection()},
  {label:'Paste',icon:ClipboardPaste,shortcut:'⌘V',onselect:()=>pasteFromClipboard()},
  {label:'Paste as text',onselect:()=>pasteFromClipboard({textOnly:true})},
  {label:'Paste in place',shortcut:'⇧⌘V',onselect:()=>pasteFromClipboard({inPlace:true})},
];}
