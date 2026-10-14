<script lang="ts">
  import {onMount,tick,untrack} from 'svelte';
  import {X,ChevronLeft,ChevronRight,Table2} from '@lucide/svelte';
  import {Button} from './ui';
  import {editor} from '../core/editor.svelte';
  import {tableCells,pasteTableCells} from '../core/object-data';
  import {positionFloating} from '../ui-viewport';
  import {restoreFocus} from '../ui-focus';
  let {elementId,initialRow=0,initialColumn=0,anchor,onpreview,onclose,onfull}:{elementId:string;initialRow?:number;initialColumn?:number;anchor:(row:number,column:number)=>HTMLElement|undefined;onpreview:(row:number,column:number,value:string|null)=>void;onclose:()=>void;onfull:()=>void}=$props();
  const deckId=editor.deck!.id,slideId=editor.slide!.id,origin=untrack(()=>document.activeElement as HTMLElement|null);
  let row=$state(untrack(()=>initialRow)),column=$state(untrack(()=>initialColumn)),value=$state(''),error=$state(''),status=$state('');
  let popup=$state<HTMLDivElement>(),input=$state<HTMLTextAreaElement>();let revision=$state(editor.deck!.revision),closing=false,frame=0;
  const element=$derived(editor.slide?.elements.find(e=>e.id===elementId)),columns=$derived(Math.max(1,...(element?.cells??[]).map(r=>r.length))),rowCount=$derived(element?.cells?.length??0);
  const stale=$derived(editor.deck?.id!==deckId||editor.slide?.id!==slideId||editor.deck?.revision!==revision||!element||element.locked);
  function position(){if(popup?.matches(':popover-open')){const node=anchor(row,column);if(node)positionFloating(popup,node.getBoundingClientRect(),{preferredHeight:popup.scrollHeight,minHeight:180,avoid:node.closest('[data-element-id]')?.getBoundingClientRect()});}}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  async function activate(){value=element?.cells?.[row]?.[column]??'';onpreview(row,column,value);await tick();position();input?.focus({preventScroll:true});input?.select();}
  function commit(){
    if(stale){error='The document changed. Close and reopen this cell.';return false;}
    if(value.length>5000){error='Keep each cell under 5,000 characters.';return false;}
    if(value===(element?.cells?.[row]?.[column]??'')){onpreview(row,column,null);return true;}
    try{const cells=tableCells(element!.cells??[]);while(cells[row].length<columns)cells[row].push('');cells[row][column]=value;const before=editor.deck!.revision;editor.commit([{op:'update_element',slideId,elementId,patch:{cells}}],'','manual',revision);if(editor.deck!.revision===before){error=editor.error;return false;}revision=editor.deck!.revision;onpreview(row,column,null);error='';status='Saved · Undo is available';return true;}catch(e){error=(e as Error).message;return false;}
  }
  function close(cancel=false,focus=true){if(closing)return;if(!cancel&&!commit())return;closing=true;onpreview(row,column,null);popup?.hidePopover();onclose();if(focus)queueMicrotask(()=>restoreFocus(anchor(row,column),origin));}
  async function move(nextRow:number,nextColumn:number){if(!commit())return;row=Math.max(0,Math.min(rowCount-1,nextRow));column=Math.max(0,Math.min(columns-1,nextColumn));await activate();}
  function key(event:KeyboardEvent){
    if(event.isComposing||event.keyCode===229)return;
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();close(true);}
    else if(event.key==='Enter'&&!event.metaKey&&!event.ctrlKey){event.preventDefault();if(event.altKey){const field=event.currentTarget as HTMLTextAreaElement;field.setRangeText('\n',field.selectionStart,field.selectionEnd,'end');value=field.value;onpreview(row,column,value);}else if(row+(event.shiftKey?-1:1)<0||row+(event.shiftKey?-1:1)>=rowCount)close();else void move(row+(event.shiftKey?-1:1),column);}
    else if(event.key==='Tab'){event.preventDefault();const index=row*columns+column+(event.shiftKey?-1:1);if(index<0||index>=rowCount*columns)close();else void move(Math.floor(index/columns),index%columns);}
  }
  function paste(event:ClipboardEvent){const text=event.clipboardData?.getData('text/plain')??'';if(!/[\t\r\n]/.test(text))return;event.preventDefault();event.stopPropagation();if(stale){error='The document changed. Close and reopen this cell.';return;}try{const result=pasteTableCells(element!.cells??[],text,row,column),before=editor.deck!.revision;editor.commit([{op:'update_element',slideId,elementId,patch:{cells:result.cells}}],'','manual',revision);if(editor.deck!.revision===before){error=editor.error;return;}revision=editor.deck!.revision;value=result.cells[row][column];onpreview(row,column,null);error='';status=`Pasted ${result.rows} × ${result.columns} · Undo is available`;schedule();}catch(e){error=`${(e as Error).message} Current data is unchanged.`;}}
  onMount(()=>{
    const p=popup!;p.showPopover();void activate();const observe=new ResizeObserver(schedule);observe.observe(p);window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
    return()=>{closing=true;onpreview(row,column,null);observe.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);p.hidePopover();};
  });
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={popup} popover="auto" role="dialog" aria-label="Edit table cell" tabindex="-1" class="cell-editor" onbeforetoggle={event=>{if(event.newState==='closed'&&!closing){if(commit()){closing=true;onpreview(row,column,null);onclose();}else queueMicrotask(()=>popup?.showPopover());}}} onkeydown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}}>
  <header><strong>{String.fromCharCode(65+column)}{row+1}</strong><div><Button variant="quiet" aria-label="Previous cell" disabled={row===0&&column===0||stale} onclick={()=>{const n=row*columns+column-1;void move(Math.floor(n/columns),n%columns);}}><ChevronLeft size={16}/></Button><Button variant="quiet" aria-label="Next cell" disabled={row===rowCount-1&&column===columns-1||stale} onclick={()=>{const n=row*columns+column+1;void move(Math.floor(n/columns),n%columns);}}><ChevronRight size={16}/></Button><Button variant="quiet" aria-label="Cancel cell edit" onclick={()=>close(true)}><X size={16}/></Button></div></header>
  <div class="value-editor-body">
  <textarea bind:this={input} aria-label={`Table cell ${String.fromCharCode(65+column)}${row+1}`} rows="3" maxlength="5000" value={value} oninput={event=>{value=event.currentTarget.value;error='';onpreview(row,column,value);}} onkeydown={key} onpaste={paste}></textarea>
  <p>Enter ↓ · Tab → · Alt+Enter for a new line · Esc cancels</p>
  {#if stale||error}<p class="error" role="alert">{error||'The document changed. Close and reopen this cell.'}</p>{:else if status}<p role="status">{status}</p>{/if}
  </div>
  <footer><Button variant="quiet" disabled={stale} onclick={()=>{if(commit()){onfull();close(true,false);}}}><Table2 size={14}/>All data</Button><Button variant="secondary" disabled={stale} onclick={()=>close()}>Done</Button></footer>
</div>
<style>
  .cell-editor{position:fixed;inset:auto;margin:0;width:min(320px,calc(100vw - 24px));padding:12px;box-sizing:border-box;border:1px solid var(--component-border);border-radius:var(--r-popover);background:var(--dialog-surface);color:var(--text-primary);box-shadow:var(--shadow-popover);overflow:hidden;display:flex;flex-direction:column;overscroll-behavior:contain}.cell-editor header,.cell-editor footer{display:flex;justify-content:space-between;align-items:center;gap:8px}.cell-editor header>div{display:flex;gap:4px}.cell-editor header :global(button){padding:4px;min-width:32px;min-height:32px}.cell-editor strong{font-size:var(--ui-label);font-weight:600}.cell-editor textarea{width:100%;min-height:92px;max-height:220px;resize:vertical;font-size:var(--ui-body);line-height:var(--ui-line-reading);margin:8px 0;border:1px solid var(--field-border);background:var(--field-surface)}.cell-editor p{font-size:var(--ui-meta);color:var(--text-secondary);line-height:var(--ui-line-reading);margin:0 0 8px}.cell-editor .error{color:var(--danger-text)}
  .value-editor-body{min-height:0;overflow:auto;overscroll-behavior:contain;flex:1}.cell-editor header,.cell-editor footer{flex:none}.cell-editor footer{padding-top:8px}
  @media(max-width:760px),(pointer:coarse){.cell-editor header :global(button),.cell-editor footer :global(button){min-height:44px;min-width:44px}.cell-editor textarea{font-size:max(16px,var(--ui-body))}}
</style>
