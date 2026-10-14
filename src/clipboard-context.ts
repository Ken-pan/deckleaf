import {editor} from './core/editor.svelte';
import type {PastePlacement} from './core/clipboard';
export type ClipboardPasteOptions=PastePlacement&{textOnly?:boolean;slidesOnly?:boolean};
export type PasteData={json?:string;html?:string;text?:string;files?:File[];local?:boolean};
export function stamp(){return `${editor.deck?.id}:${editor.activeId}:${editor.deck?.revision}:${editor.editingGroup}:${editor.selected.join(',')}:${editor.sourceMode}:${editor.editingId}:${editor.selectedContainer}:${editor.selectedSlides.join(',')}:${editor.slideSelectionMode}`;}
export function unchanged(value:string){if(value!==stamp()||document.querySelector<HTMLElement>('.canvas-stage')?.dataset.clipboardBlocked==='true')throw new Error('The document changed. Paste again at the intended location.');}
export function pasteFailure(error:unknown){const message=(error as Error).message;editor.notify(/clipboard data has changed/i.test(message)?'The clipboard changed. Copy the content again, then paste.':message,'warning');}
