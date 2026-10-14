<script lang="ts">
  import {onMount,tick,untrack} from 'svelte';
  import TableVisual from './TableVisual.svelte';
  import {Button} from './ui';
  import {Copy,ClipboardPaste,Pencil,Expand} from '@lucide/svelte';
  import {editor} from '../core/editor.svelte';
  import {cellBounds,selectedCells,cellsTsv,clearCellRange,pasteCellRange,type Cell,type CellRange} from '../core/table-grid';
  import type {SlideElement} from '../core/model';
  import type {DesignSystem} from '../core/design-system-schema';
  import {positionFloating} from '../ui-viewport';
  import {holdPointerCursor} from '../pointer-cursor';
  let {element,system,style='',activeCell,oncell}:{element:SlideElement;system?:DesignSystem;style?:string;activeCell?:Cell;oncell:(row:number,column:number)=>void}=$props();
  let root=$state<HTMLDivElement>(),tools=$state<HTMLDivElement>(),range=$state<CellRange>(),extend=$state(false),status=$state(''),busy=$state(false),tabTarget=$state<Cell>({row:0,column:0});
  type Drag={id:number;before:CellRange|undefined;anchor:Cell;node:HTMLElement;revision:number;deckId:string;slideId:string};
  let drag=$state<Drag|null>(null),release:(()=>void)|undefined,frame=0;
  const columns=$derived(Math.max(1,...(element.cells??[]).map(r=>r.length))),rows=$derived(element.cells?.length??0),bounds=$derived(range?cellBounds(range):undefined);
  const label=$derived(bounds?`${String.fromCharCode(65+bounds.left)}${bounds.top+1}${bounds.top===bounds.bottom&&bounds.left===bounds.right?'':`:${String.fromCharCode(65+bounds.right)}${bounds.bottom+1}`}`:'');
  function cell(node:EventTarget|null):Cell|undefined{if(!(node instanceof Element))return;const n=node.closest<HTMLElement>('[data-table-row]');return n&&root?.contains(n)?{row:Number(n.dataset.tableRow),column:Number(n.dataset.tableColumn)}:undefined;}
  function node(c:Cell){return root?.querySelector<HTMLElement>(`[data-table-row="${c.row}"][data-table-column="${c.column}"]`);}
  function clamp(c:Cell):Cell{return {row:Math.max(0,Math.min(rows-1,c.row)),column:Math.max(0,Math.min(columns-1,c.column))};}
  async function select(c:Cell,expand=false,focus=true){const head=clamp(c);range={anchor:expand&&range?range.anchor:head,head};tabTarget=head;status='';await tick();if(focus)node(head)?.focus({preventScroll:true});schedule();}
  function valid(g:Drag){return editor.deck?.id===g.deckId&&editor.slide?.id===g.slideId&&editor.deck?.revision===g.revision&&!element.locked;}
  function clear(cancel=false){const g=drag;drag=null;release?.();release=undefined;if(cancel&&g){range=g.before;tabTarget=g.before?.head??g.anchor;}if(g?.node.hasPointerCapture(g.id))g.node.releasePointerCapture(g.id);}
  function down(e:PointerEvent){const c=cell(e.target);if(!c||e.button!==0||element.locked)return;e.preventDefault();e.stopPropagation();if(drag){clear(true);return;}const before=range;void select(c,e.shiftKey||extend);drag={id:e.pointerId,before,anchor:range&&(e.shiftKey||extend)?range.anchor:c,node:root!,revision:editor.deck!.revision,deckId:editor.deck!.id,slideId:editor.slide!.id};root!.setPointerCapture(e.pointerId);release=holdPointerCursor('cell');}
  function move(e:PointerEvent){const g=drag;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(!valid(g)){clear(true);return;}const c=cell(document.elementFromPoint(e.clientX,e.clientY));if(c){range={anchor:g.anchor,head:c};tabTarget=c;schedule();}}
  function up(e:PointerEvent){if(drag?.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();clear();void tick().then(()=>node(tabTarget)?.focus({preventScroll:true}));}
  function apply(cells:string[][],revision=editor.deck!.revision){if(element.locked)return false;if(JSON.stringify(cells)===JSON.stringify(element.cells))return true;const before=editor.deck!.revision;editor.commit([{op:'update_element',slideId:editor.slide!.id,elementId:element.id,patch:{cells}}],'','manual',revision);if(editor.deck!.revision===before){status=editor.error;return false;}return true;}
  function pasteText(text:string,revision=editor.deck!.revision){if(!range)return;try{const b=cellBounds(range),result=pasteCellRange(element.cells??[],text,range);if(apply(result.cells,revision)){range={anchor:{row:b.top,column:b.left},head:{row:b.top+result.rows-1,column:b.left+result.columns-1}};tabTarget=range.head;status=`Pasted ${result.rows} × ${result.columns} · Undo available`;void tick().then(()=>node(tabTarget)?.focus({preventScroll:true}));}}catch(error){status=(error as Error).message;}}
  function copy(e?:ClipboardEvent,cut=false){if(!range)return;const values=selectedCells(element.cells??[],range),text=cellsTsv(values);if(e?.clipboardData){e.preventDefault();e.stopPropagation();e.clipboardData.setData('text/plain',text);if(cut)apply(clearCellRange(element.cells??[],range));status=cut?'Cells cut · Undo available':'Cells copied';return;}void clipboard(cut,text);}
  async function clipboard(cut=false,text?:string){if(!range||busy)return;const captured={revision:editor.deck!.revision,id:editor.deck!.id,slide:editor.slide!.id,element:element.id,range:untrack(()=>range!)};busy=true;try{if(text!==undefined){await navigator.clipboard.writeText(text);if(cut){if(editor.deck?.id!==captured.id||editor.slide?.id!==captured.slide||editor.deck?.revision!==captured.revision)throw Error('The table changed. Copy the cells again.');apply(clearCellRange(element.cells??[],captured.range),captured.revision);}status=cut?'Cells cut · Undo available':'Cells copied';}else{const value=await navigator.clipboard.readText();if(editor.deck?.id!==captured.id||editor.slide?.id!==captured.slide||editor.deck?.revision!==captured.revision||element.id!==captured.element||JSON.stringify(range)!==JSON.stringify(captured.range))throw Error('The selection changed. Paste the cells again.');pasteText(value,captured.revision);}}catch(error){status=(error as Error).name==='NotAllowedError'?'Clipboard access is unavailable. Use ⌘/Ctrl+C or V.':(error as Error).message;}finally{busy=false;}}
  function paste(e:ClipboardEvent){if(!range||e.target instanceof Element&&e.target.closest('input,textarea,select'))return;e.preventDefault();e.stopPropagation();pasteText(e.clipboardData?.getData('text/plain')??'');}
  function key(e:KeyboardEvent){const c=cell(e.target);if(!c||e.isComposing)return;const cmd=e.metaKey||e.ctrlKey;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(drag)clear(true);else{range=undefined;extend=false;root?.closest<HTMLElement>('[data-element-id]')?.focus();}return;}
    if(cmd&&['c','x','v'].includes(e.key.toLowerCase()))return;
    if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();e.shiftKey?editor.redo():editor.undo();return;}
    if(cmd&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopPropagation();range={anchor:{row:0,column:0},head:{row:rows-1,column:columns-1}};schedule();return;}
    if(e.key===' '&&(e.shiftKey||cmd)){e.preventDefault();e.stopPropagation();range={anchor:{row:cmd?0:c.row,column:e.shiftKey?0:c.column},head:{row:cmd?rows-1:c.row,column:e.shiftKey?columns-1:c.column}};schedule();return;}
    if(cmd&&['Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();void select({row:e.key==='Home'?0:rows-1,column:e.key==='Home'?0:columns-1},e.shiftKey);return;}
    if(cmd||e.altKey)return;
    if(['Enter','F2'].includes(e.key)){e.preventDefault();e.stopPropagation();oncell(c.row,c.column);return;}
    if(['Delete','Backspace'].includes(e.key)&&range){e.preventDefault();e.stopPropagation();apply(clearCellRange(element.cells??[],range));status='Cleared cells · Undo available';return;}
    if(e.key==='Tab'){const n=c.row*columns+c.column+(e.shiftKey?-1:1);if(n>=0&&n<rows*columns){e.preventDefault();e.stopPropagation();void select({row:Math.floor(n/columns),column:n%columns});}return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();void select({row:c.row+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0),column:e.key==='Home'?0:e.key==='End'?columns-1:c.column+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)},e.shiftKey);}
  }
  function position(){if(!root||!tools||!range)return;const r=root.getBoundingClientRect(),coarse=matchMedia('(pointer:coarse)').matches;positionFloating(tools,{...r.toJSON(),height:r.height+(coarse?52:0),bottom:r.bottom+(coarse?52:0)},{preferredHeight:tools.scrollHeight,minHeight:44,avoid:r});}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  function portal(n:HTMLElement){document.body.append(n);return {destroy(){n.remove();}};}
  $effect(()=>{element;range;void tick().then(schedule);if(drag&&!valid(drag))clear(true);if(range&&(range.head.row>=rows||range.head.column>=columns||range.anchor.row>=rows||range.anchor.column>=columns)){range={anchor:clamp(range.anchor),head:clamp(range.head)};tabTarget=range.head;}});
  onMount(()=>{const observe=new ResizeObserver(schedule);if(root)observe.observe(root);if(tools)observe.observe(tools);window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);const cancel=()=>clear(true);window.addEventListener('blur',cancel);return()=>{clear();observe.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.removeEventListener('blur',cancel);};});
</script>
<!-- The managed table grid owns cell pointer and clipboard operations. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={root} class="canvas-cell-grid" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={()=>clear(true)} onlostpointercapture={()=>{if(drag)clear(true);}} onkeydown={key} oncopy={e=>copy(e)} oncut={e=>copy(e,true)} onpaste={paste} onfocusin={e=>{const c=cell(e.target);if(c){tabTarget=c;if(!range)void select(c,false,false);}}}>
  <TableVisual {element} {system} {style} editable managed {activeCell} {tabTarget} selection={bounds} oncell={(row,column)=>oncell(row,column)}/>
</div>
<div bind:this={tools} use:portal class="cell-tools" role="toolbar" tabindex="-1" aria-label="Selected cells" style:display={range?'flex':'none'} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();extend=false;node(tabTarget)?.focus();}}} oncopy={e=>copy(e)} oncut={e=>copy(e,true)} onpaste={paste}>
  <span class="range-label" title="Drag to select · Shift extends · Esc returns to the object">{label}</span>
  <Button variant="quiet" aria-label="Copy cells" disabled={busy} onclick={()=>copy()}><Copy size={16}/><span>Copy</span></Button>
  <Button variant="quiet" aria-label="Paste cells" disabled={busy} onclick={()=>void clipboard()}><ClipboardPaste size={16}/><span>Paste</span></Button>
  <Button variant="quiet" aria-label="Edit active cell" onclick={()=>oncell(tabTarget.row,tabTarget.column)}><Pencil size={16}/><span>Edit</span></Button>
  <Button variant="quiet" aria-label="Extend cell selection" aria-pressed={extend} title="Tap another cell to extend the range" onclick={()=>extend=!extend}><Expand size={16}/></Button>
  {#if status}<span class="cell-status" role="status">{status}</span>{/if}
</div>
<style>
  .canvas-cell-grid{width:100%;height:100%;touch-action:none;user-select:none}.cell-tools{position:fixed;z-index:160;align-items:center;gap:4px;flex-wrap:wrap;max-width:calc(100vw - 24px);padding:4px 8px;background:var(--surface-overlay);color:var(--text-primary);border:1px solid var(--component-border);border-radius:var(--r-popover);box-shadow:var(--shadow-floating);box-sizing:border-box}.range-label{font:var(--ui-meta)/1.4 var(--font-ui);font-variant-numeric:tabular-nums;min-width:42px}.cell-tools :global(button){min-height:36px;padding:8px;gap:4px}.cell-status{flex-basis:100%;font:var(--ui-meta)/1.5 var(--font-ui);max-width:310px;padding:4px}.cell-tools :global(button[aria-pressed=true]){background:var(--surface-selected)}@media(pointer:coarse){.cell-tools :global(button){min-width:44px;min-height:44px}.range-label{min-width:36px}.cell-tools{gap:0}}
</style>
