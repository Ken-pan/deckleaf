<script lang="ts">
  import {onMount,tick,untrack} from 'svelte';
  import {Check,X} from '@lucide/svelte';
  import {Button} from './ui';
  import {editor} from '../core/editor.svelte';
  import {tableCells} from '../core/object-data';
  import {pasteCellRange} from '../core/table-grid';
  import {cellOwner,cellMerge,pastedTableStyle} from '../core/table-structure';
  import {restoreFocus} from '../ui-focus';
  let {elementId,initialRow=0,initialColumn=0,initialValue,anchor,onpreview,onclose,onfull}:{elementId:string;initialRow?:number;initialColumn?:number;initialValue?:string;anchor:(row:number,column:number)=>HTMLElement|undefined;onpreview:(row:number,column:number,value:string|null)=>void;onclose:()=>void;onfull:()=>void}=$props();
  const deckId=editor.deck!.id,slideId=editor.slide!.id,origin=untrack(()=>document.activeElement as HTMLElement|null);
  let row=$state(untrack(()=>initialRow)),column=$state(untrack(()=>initialColumn)),value=$state(''),error=$state(''),status=$state('');
  let popup=$state<HTMLDivElement>(),input=$state<HTMLTextAreaElement>();let revision=$state(editor.deck!.revision),closing=false,frame=0,first=true,tabOrigin:number|undefined;
  const element=$derived(editor.slide?.elements.find(e=>e.id===elementId)),columns=$derived(Math.max(1,...(element?.cells??[]).map(r=>r.length))),rowCount=$derived(element?.cells?.length??0);
  const stale=$derived(editor.deck?.id!==deckId||editor.slide?.id!==slideId||editor.deck?.revision!==revision||!element||element.locked);
  function position(){if(!popup?.matches(':popover-open'))return;const node=anchor(row,column);if(!node)return;const r=node.getBoundingClientRect(),css=getComputedStyle(node),scale=Number(node.closest<HTMLElement>('.slide-render')?.style.getPropertyValue('--canvas-scale'))||1,coarse=matchMedia('(pointer:coarse)').matches;
    const rotated=Math.abs(element?.rotation??0)>.01,w=Math.max(coarse?100:44,rotated?node.offsetWidth*scale:r.width),h=Math.max(36,rotated?node.offsetHeight*scale:r.height);
    popup.style.left=`${rotated?r.left+r.width/2-w/2:Math.max(4,Math.min(innerWidth-w-4,r.left))}px`;popup.style.top=`${rotated?r.top+r.height/2-h/2:Math.max(4,r.top)}px`;popup.style.width=`${w}px`;popup.style.height=`${h}px`;popup.style.transform=rotated?`rotate(${element!.rotation}deg) scale(${element!.flipX?-1:1},${element!.flipY?-1:1})`:'';
    if(input){input.style.fontFamily=css.fontFamily;input.style.fontSize=`${Math.max(coarse?16:14,parseFloat(css.fontSize)*scale)}px`;input.style.fontWeight=css.fontWeight;input.style.fontStyle=css.fontStyle;input.style.textAlign=css.textAlign;input.style.color=css.color;input.style.background=css.backgroundColor;input.style.padding=`${Math.max(4,parseFloat(css.paddingTop)*scale)}px ${Math.max(4,parseFloat(css.paddingLeft)*scale)}px`;}
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  async function activate(){value=first&&initialValue!==undefined?initialValue:element?.cells?.[row]?.[column]??'';const replacing=first&&initialValue!==undefined;first=false;onpreview(row,column,value);await tick();position();input?.focus({preventScroll:true});if(replacing&&input)input.setSelectionRange(value.length,value.length);else input?.select();}
  function commit(){
    if(stale){error='The document changed. Close and reopen this cell.';return false;}
    if(value.length>5000){error='Keep each cell under 5,000 characters.';return false;}
    if(value===(element?.cells?.[row]?.[column]??'')){onpreview(row,column,null);return true;}
    try{const cells=tableCells(element!.cells??[]);while(cells[row].length<columns)cells[row].push('');cells[row][column]=value;const before=editor.deck!.revision;editor.commit([{op:'update_element',slideId,elementId,patch:{cells}}],'','manual',revision);if(editor.deck!.revision===before){error=editor.error;return false;}revision=editor.deck!.revision;onpreview(row,column,null);error='';status='Saved · Undo is available';return true;}catch(e){error=(e as Error).message;return false;}
  }
  function close(cancel=false,focus=true){if(closing)return;if(!cancel&&!commit())return;closing=true;onpreview(row,column,null);popup?.hidePopover();onclose();if(focus)queueMicrotask(()=>restoreFocus(anchor(row,column),origin));}
  async function move(nextRow:number,nextColumn:number){if(!commit())return;row=Math.max(0,Math.min(rowCount-1,nextRow));column=Math.max(0,Math.min(columns-1,nextColumn));({row,column}=cellOwner(element?.tableStyle,{row,column}));await activate();}
  function key(event:KeyboardEvent){
    if(event.isComposing||event.keyCode===229)return;
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();close(true);}
    else if(event.key==='Enter'&&!event.metaKey&&!event.ctrlKey){event.preventDefault();if(event.altKey){const field=event.currentTarget as HTMLTextAreaElement;field.setRangeText('\n',field.selectionStart,field.selectionEnd,'end');value=field.value;onpreview(row,column,value);}else{const next=row+(event.shiftKey?-1:cellMerge(element?.tableStyle,row,column)?.rowSpan??1);if(next<0||next>=rowCount)close();else{const nextColumn=tabOrigin??column;tabOrigin=undefined;void move(next,nextColumn);}}}
    else if(event.key==='Tab'){event.preventDefault();tabOrigin??=column;const visible=Array.from(anchor(row,column)?.closest('table')?.querySelectorAll<HTMLElement>('[data-table-row]')??[]).map(n=>({row:Number(n.dataset.tableRow),column:Number(n.dataset.tableColumn)})),at=visible.findIndex(c=>c.row===row&&c.column===column)+(event.shiftKey?-1:1),next=visible[at];if(!next)close();else void move(next.row,next.column);}
  }
  function paste(event:ClipboardEvent){const text=event.clipboardData?.getData('text/plain')??'';if(!/[\t\r\n]/.test(text))return;event.preventDefault();event.stopPropagation();if(stale){error='The document changed. Close and reopen this cell.';return;}try{const result=pasteCellRange(element!.cells??[],text,{anchor:{row,column},head:{row,column}}),tableStyle=element!.tableStyle?.merges?.length?pastedTableStyle(element!,{anchor:{row,column},head:{row:row+result.rows-1,column:column+result.columns-1}}):element!.tableStyle,before=editor.deck!.revision;editor.commit([{op:'update_element',slideId,elementId,patch:{cells:result.cells,tableStyle}}],'','manual',revision);if(editor.deck!.revision===before){error=editor.error;return;}revision=editor.deck!.revision;value=result.cells[row][column];onpreview(row,column,null);error='';status=`Pasted ${result.rows} × ${result.columns} · Undo is available`;schedule();}catch(e){error=`${(e as Error).message} Current data is unchanged.`;}}
  onMount(()=>{
    const p=popup!;p.showPopover();void activate();const observe=new ResizeObserver(schedule);observe.observe(p);window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
    return()=>{closing=true;onpreview(row,column,null);observe.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);p.hidePopover();};
  });
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={popup} popover="auto" role="dialog" aria-label="Edit table cell" tabindex="-1" class="cell-editor" onbeforetoggle={event=>{if(event.newState==='closed'&&!closing){if(commit()){closing=true;onpreview(row,column,null);onclose();}else queueMicrotask(()=>popup?.showPopover());}}} onkeydown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}}>
  <textarea bind:this={input} aria-label={`Table cell ${String.fromCharCode(65+column)}${row+1}`} rows="1" maxlength="5000" value={value} spellcheck="false" oninput={event=>{value=event.currentTarget.value;error='';onpreview(row,column,value);}} onkeydown={key} onpaste={paste}></textarea>
  <div class="inline-hint"><span>{String.fromCharCode(65+column)}{row+1} · Enter ↓ · Tab →</span><Button variant="quiet" aria-label="Cancel cell edit" onclick={()=>close(true)}><X size={14}/></Button><Button variant="quiet" aria-label="Save cell" onclick={()=>close()}><Check size={14}/></Button></div>
  {#if stale||error}<p class="error" role="alert">{error||'The document changed. Reopen this cell.'}</p>{/if}
</div>
<style>
.cell-editor{position:fixed;inset:auto;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:var(--text-primary);overflow:visible;box-sizing:border-box}.cell-editor textarea{display:block;width:100%;height:100%;resize:none;margin:0;box-sizing:border-box;border:0;border-radius:0;outline:2px solid var(--canvas-selection);outline-offset:-1px;box-shadow:var(--shadow-floating);line-height:1.4;min-width:0;min-height:0}.inline-hint{display:flex;align-items:center;gap:4px;white-space:nowrap;position:absolute;top:calc(100% + 3px);left:0;background:var(--surface-overlay);border:1px solid var(--component-border);border-radius:var(--r-control);padding:2px 4px;box-shadow:var(--shadow-floating);font:var(--ui-meta)/1.4 var(--font-ui);color:var(--text-secondary)}.inline-hint :global(button){min-width:28px;min-height:28px;padding:4px}.error{position:absolute;top:100%;left:0;min-width:180px;max-width:280px;background:var(--surface-overlay);color:var(--danger-text);padding:8px;font-size:var(--ui-meta);box-shadow:var(--shadow-floating);z-index:1}@media(pointer:coarse){.inline-hint :global(button){min-width:44px;min-height:44px}.inline-hint span{max-width:120px;overflow:hidden}}
</style>
