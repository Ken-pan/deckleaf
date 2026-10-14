import {editor} from './core/editor.svelte';

/** Match surrounding text and keep the browser's caret, input and undo lifecycle. */
export function pasteInlineText(event:ClipboardEvent){
  const field=event.currentTarget as HTMLElement,data=event.clipboardData;
  if(!data||!field.isContentEditable)return;
  event.preventDefault();event.stopPropagation();
  const text=data.getData('text/plain').replace(/\r\n?/g,'\n');
  if(!text){if(data.files.length)editor.notify('Finish editing text, then paste the image onto the canvas.','info');return;}
  const selected=window.getSelection()?.toString().length??0;
  if(field.innerText.length-selected+text.length>50000){editor.notify('Keep each text object under 50,000 characters.','warning');return;}
  if(!document.execCommand('insertText',false,text))editor.notify('Text could not be inserted. Place the cursor and paste again.','warning');
}
