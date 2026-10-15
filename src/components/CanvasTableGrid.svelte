<script lang="ts">
  import {onMount,tick,untrack} from 'svelte';
  import TableVisual from './TableVisual.svelte';
  import {tablePresentation,tableCellStyle} from '../core/table-appearance';
  import {Button} from './ui';
  import CanvasTableManipulation from './CanvasTableManipulation.svelte';
  import CanvasTableContextMenu from './CanvasTableContextMenu.svelte';
  import {autofillTableRange} from '../core/table-manipulation';
  import {styleTableRange} from '../core/table-structure';
  import {loadFeature} from '../features';
  import CanvasTableStyleEditor from './CanvasTableStyleEditor.svelte';
  import {Expand,Move,Ellipsis,Paintbrush} from '@lucide/svelte';
  import {editor} from '../core/editor.svelte';
  import {cellBounds,cellInRange,selectedCells,cellsTsv,clearCellRange,pasteCellRange,type Cell,type CellRange} from '../core/table-grid';
  import {changeTableAxis,mergeTableRange,expandMergedRange,cellOwner,cellMerge,pastedTableStyle} from '../core/table-structure';
  import type {SlideElement} from '../core/model';
  import type {DesignSystem} from '../core/design-system-schema';
  import {positionFloating} from '../ui-viewport';
  import {holdPointerCursor} from '../pointer-cursor';
  let {element,system,style='',scale=1,activeCell,oncell,onmove,onselection}:{element:SlideElement;system?:DesignSystem;style?:string;scale?:number;activeCell?:Cell;oncell:(row:number,column:number,initialValue?:string)=>void;onmove:(event:PointerEvent)=>void;onselection?:(active:boolean)=>void}=$props();
  let draft=$state<SlideElement|null>(null),menuAnchor=$state<HTMLElement>(),menuAxis=$state<'row'|'column'>();
  let root=$state<HTMLDivElement>(),tools=$state<HTMLDivElement>(),range=$state<CellRange>(),extend=$state(false),status=$state(''),busy=$state(false),tabTarget=$state<Cell>({row:0,column:0}),styleOpen=$state(false),styleTrigger=$state<HTMLButtonElement>();
  type Drag={id:number;before:CellRange|undefined;anchor:Cell;node:HTMLElement;revision:number;deckId:string;slideId:string;touch:boolean;x:number;y:number;moved:boolean};
  let drag=$state<Drag|null>(null),release:(()=>void)|undefined,frame=0,clipboardSequence=0;
  let pointerCell:Cell|undefined,previousPointerCell:Cell|undefined,pointerType='',lastTap:{cell:Cell;time:number}|undefined,touchEdit:Cell|undefined,editTimer=0;
  let menuTimer=0,releaseMenu:(()=>void)|undefined;
  function openMenu(axis:'row'|'column'|undefined,anchor:HTMLElement,event?:MouseEvent){releaseMenu?.();menuAxis=axis;const show=()=>{releaseMenu?.();menuAnchor=anchor;};if(event?.buttons){releaseMenu=()=>{clearTimeout(menuTimer);document.removeEventListener('pointerup',show,true);releaseMenu=undefined;};document.addEventListener('pointerup',show,{capture:true,once:true});menuTimer=window.setTimeout(show,350);}else show();}
  function cancelClipboard(){clipboardSequence++;busy=false;}
  const columns=$derived(Math.max(1,...(element.cells??[]).map(r=>r.length))),rows=$derived(element.cells?.length??0),bounds=$derived(range?cellBounds(range):undefined);
  const label=$derived(bounds?`${String.fromCharCode(65+bounds.left)}${bounds.top+1}${bounds.top===bounds.bottom&&bounds.left===bounds.right?'':`:${String.fromCharCode(65+bounds.right)}${bounds.bottom+1}`}`:'');
  function cell(node:EventTarget|null):Cell|undefined{if(!(node instanceof Element))return;const n=node.closest<HTMLElement>('[data-table-row]');return n&&root?.contains(n)?{row:Number(n.dataset.tableRow),column:Number(n.dataset.tableColumn)}:undefined;}
  function node(c:Cell){c=cellOwner(element.tableStyle,c);return root?.querySelector<HTMLElement>(`[data-table-row="${c.row}"][data-table-column="${c.column}"]`)??undefined;}
  function clamp(c:Cell):Cell{return {row:Math.max(0,Math.min(rows-1,c.row)),column:Math.max(0,Math.min(columns-1,c.column))};}
  async function select(c:Cell,expand=false,focus=true){cancelClipboard();const head=clamp(c);range=expandMergedRange(element.tableStyle,{anchor:expand&&range?range.anchor:head,head});tabTarget=cellOwner(element.tableStyle,head);styleOpen=false;status='';await tick();if(focus)node(head)?.focus({preventScroll:true});schedule();}
  function valid(g:Drag){return editor.deck?.id===g.deckId&&editor.slide?.id===g.slideId&&editor.deck?.revision===g.revision&&!element.locked;}
  function clear(cancel=false){const g=drag;if(cancel){lastTap=undefined;touchEdit=undefined;clearTimeout(editTimer);}drag=null;release?.();release=undefined;if(cancel&&g){range=g.before;tabTarget=g.before?.head??g.anchor;}if(g?.node.hasPointerCapture(g.id))g.node.releasePointerCapture(g.id);}
  function down(e:PointerEvent){const c=cell(e.target);if(!c||e.button!==0||element.locked)return;e.preventDefault();e.stopPropagation();if(drag){clear(true);return;}touchEdit=undefined;clearTimeout(editTimer);previousPointerCell=pointerCell;pointerCell=c;pointerType=e.pointerType;if(pointerType!=='touch')lastTap=undefined;const before=range;void select(c,e.shiftKey||extend);drag={id:e.pointerId,before,anchor:range&&(e.shiftKey||extend)?range.anchor:c,node:root!,revision:editor.deck!.revision,deckId:editor.deck!.id,slideId:editor.slide!.id,touch:e.pointerType==='touch'&&!e.shiftKey&&!extend,x:e.clientX,y:e.clientY,moved:false};root!.setPointerCapture(e.pointerId);release=holdPointerCursor('cell');}
  function move(e:PointerEvent){const g=drag;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(!valid(g)){lastTap=undefined;clear();return;}if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>=8)g.moved=true;const c=cell(document.elementFromPoint(e.clientX,e.clientY));if(c){range=expandMergedRange(element.tableStyle,{anchor:g.anchor,head:c});tabTarget=c;schedule();}}
  function up(e:PointerEvent){const g=drag;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const tap=g.touch&&!g.moved,edit=tap&&lastTap&&e.timeStamp-lastTap.time<450&&lastTap.cell.row===g.anchor.row&&lastTap.cell.column===g.anchor.column;lastTap=tap&&!edit?{cell:g.anchor,time:e.timeStamp}:undefined;touchEdit=edit?g.anchor:undefined;clear();void tick().then(()=>node(tabTarget)?.focus({preventScroll:true}));}
  function click(e:MouseEvent){const c=touchEdit;if(!c)return;touchEdit=undefined;e.preventDefault();e.stopPropagation();clearTimeout(editTimer);editTimer=window.setTimeout(()=>oncell(c.row,c.column),0);}
  function live(){return editor.slide?.elements.find(e=>e.id===element.id)??element;}
  function applyPatch(patch:Partial<SlideElement>,revision=editor.deck!.revision,merge=''){
    const current=live();if(current.locked)return false;if(Object.entries(patch).every(([key,value])=>JSON.stringify(value)===JSON.stringify(current[key as keyof SlideElement])))return true;
    const before=editor.deck!.revision;editor.commit([{op:'update_element',slideId:editor.slide!.id,elementId:element.id,patch}],merge,'manual',revision);if(editor.deck!.revision===before){status=editor.error;return false;}return true;
  }
  function apply(cells:string[][],revision=editor.deck!.revision){return applyPatch({cells},revision);}
  function structure(axis:'row'|'column',insert:boolean,after=false){if(!range)return;try{cancelClipboard();const b=cellBounds(range),index=axis==='row'?(after?b.bottom+1:b.top):(after?b.right+1:b.left),count=insert?1:axis==='row'?b.bottom-b.top+1:b.right-b.left+1;if(applyPatch(changeTableAxis(live(),axis,index,count,insert))){const c={row:axis==='row'?Math.min(index,rows+(insert?1:-count)-1):b.top,column:axis==='column'?Math.min(index,columns+(insert?1:-count)-1):b.left};void tick().then(async()=>{await select(c);status=`${insert?'Added':'Deleted'} ${count===1?axis:axis+'s'} · Undo available`;});}}catch(error){status=(error as Error).message;}}
  function mergeCells(split=false){if(!range)return;try{cancelClipboard();if(applyPatch(mergeTableRange(live(),range,split,system))){tabTarget={row:bounds!.top,column:bounds!.left};status=split?'Split cells · Original values restored':'Merged cells · Other values return when split';void tick().then(()=>node(tabTarget)?.focus());}}catch(error){status=(error as Error).message;}}
  function fillSelection(axis:'row'|'column'){if(!range||!bounds)return;const b=bounds,source={anchor:{row:b.top,column:b.left},head:{row:axis==='row'?b.top:b.bottom,column:axis==='column'?b.left:b.right}};try{if(applyPatch(autofillTableRange(live(),source,range,true)))status='Filled cells · Undo available';}catch(e){status=(e as Error).message;}}
  const actions=$derived([
    {label:'Copy',shortcut:'⌘/Ctrl+C',onselect:()=>copy()},
    {label:'Paste',shortcut:'⌘/Ctrl+V',disabled:busy,onselect:()=>void clipboard()},
    {label:'Edit cell',shortcut:'Enter',onselect:()=>oncell(tabTarget.row,tabTarget.column)},
    {label:'Fill down',shortcut:'⌘/Ctrl+D',disabled:!bounds||bounds.top===bounds.bottom,onselect:()=>fillSelection('row')},
    {label:'Fill right',shortcut:'⌘/Ctrl+R',disabled:!bounds||bounds.left===bounds.right,onselect:()=>fillSelection('column')},
    {label:'Insert row above',disabled:rows>=100,onselect:()=>structure('row',true)},
    {label:'Insert row below',disabled:rows>=100,onselect:()=>structure('row',true,true)},
    {label:'Insert column left',disabled:columns>=20,onselect:()=>structure('column',true)},
    {label:'Insert column right',disabled:columns>=20,onselect:()=>structure('column',true,true)},
    {label:'Merge cells',divider:true,disabled:!bounds||bounds.top===bounds.bottom&&bounds.left===bounds.right,onselect:()=>mergeCells()},
    {label:'Split cells',disabled:!range||!live().tableStyle?.merges?.some(m=>{const b=cellBounds(range!);return m.row<=b.bottom&&m.row+m.rowSpan-1>=b.top&&m.column<=b.right&&m.column+m.columnSpan-1>=b.left;}),onselect:()=>mergeCells(true)},
    {label:'Delete selected rows',divider:true,tone:'danger' as const,disabled:!bounds||bounds.bottom-bounds.top+1>=rows,onselect:()=>structure('row',false)},
    {label:'Delete selected columns',tone:'danger' as const,disabled:!bounds||bounds.right-bounds.left+1>=columns,onselect:()=>structure('column',false)}
  ]);
  function pasteText(text:string,revision=editor.deck!.revision){if(!range)return;try{const b=cellBounds(range),result=pasteCellRange(element.cells??[],text,range);if(applyPatch({cells:result.cells,...(element.tableStyle?.merges?.length?{tableStyle:pastedTableStyle(element,{anchor:{row:b.top,column:b.left},head:{row:b.top+result.rows-1,column:b.left+result.columns-1}})}:{})},revision)){range={anchor:{row:b.top,column:b.left},head:{row:b.top+result.rows-1,column:b.left+result.columns-1}};tabTarget=range.head;status=`Pasted ${result.rows} × ${result.columns} · Undo available`;void tick().then(()=>node(tabTarget)?.focus({preventScroll:true}));}}catch(error){status=(error as Error).message;}}
  function copy(e?:ClipboardEvent,cut=false){if(!range)return;const values=selectedCells(element.cells??[],range),text=cellsTsv(values);if(e?.clipboardData){e.preventDefault();e.stopPropagation();e.clipboardData.setData('text/plain',text);if(cut)apply(clearCellRange(element.cells??[],range));status=cut?'Cells cut · Undo available':'Cells copied';return;}void clipboard(cut,text);}
  async function clipboard(cut=false,text?:string){if(!range||busy)return;const token=++clipboardSequence,captured={revision:editor.deck!.revision,id:editor.deck!.id,slide:editor.slide!.id,element:element.id,range:untrack(()=>range!)};busy=true;node(tabTarget)?.focus({preventScroll:true});try{if(text!==undefined){await navigator.clipboard.writeText(text);if(token!==clipboardSequence)return;if(cut){if(editor.deck?.id!==captured.id||editor.slide?.id!==captured.slide||editor.deck?.revision!==captured.revision)throw Error('The table changed. Copy the cells again.');apply(clearCellRange(element.cells??[],captured.range),captured.revision);}status=cut?'Cells cut · Undo available':'Cells copied';}else{const value=await navigator.clipboard.readText();if(token!==clipboardSequence)return;if(editor.deck?.id!==captured.id||editor.slide?.id!==captured.slide||editor.deck?.revision!==captured.revision||element.id!==captured.element||JSON.stringify(range)!==JSON.stringify(captured.range))throw Error('The selection changed. Paste the cells again.');pasteText(value,captured.revision);}}catch(error){status=(error as Error).name==='NotAllowedError'?'Clipboard access is unavailable. Use ⌘/Ctrl+C or V.':(error as Error).message;}finally{if(token===clipboardSequence)busy=false;}}
  function paste(e:ClipboardEvent){if(!range||e.target instanceof Element&&e.target.closest('input,textarea,select'))return;e.preventDefault();e.stopPropagation();pasteText(e.clipboardData?.getData('text/plain')??'');}
  function key(e:KeyboardEvent){const c=cell(e.target);if(!c||e.isComposing)return;const cmd=e.metaKey||e.ctrlKey;
    if(e.key==='Escape'){cancelClipboard();e.preventDefault();e.stopPropagation();if(drag)clear(true);else{range=undefined;extend=false;styleOpen=false;root?.closest<HTMLElement>('[data-element-id]')?.focus();}return;}
    if(cmd&&['c','x','v'].includes(e.key.toLowerCase()))return;
    if(cmd&&e.key.toLowerCase()==='z'){cancelClipboard();e.preventDefault();e.stopPropagation();e.shiftKey?editor.redo():editor.undo();return;}
    if(cmd&&['d','r'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();fillSelection(e.key.toLowerCase()==='d'?'row':'column');return;}
    if(cmd&&e.key.toLowerCase()==='b'&&range){e.preventDefault();e.stopPropagation();const p=tablePresentation(live(),system),b=cellBounds(range);let bold=true;for(let r=b.top;r<=b.bottom;r++)for(let c=b.left;c<=b.right;c++)bold&&=Number(tableCellStyle(p,r,c).fontWeight)>=600;applyPatch(styleTableRange(live(),range,{fontWeight:bold?400:600},system));return;}
    if(cmd&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopPropagation();range={anchor:{row:0,column:0},head:{row:rows-1,column:columns-1}};schedule();return;}
    if(e.key===' '&&(e.shiftKey||cmd)){e.preventDefault();e.stopPropagation();range={anchor:{row:cmd?0:c.row,column:e.shiftKey?0:c.column},head:{row:cmd?rows-1:c.row,column:e.shiftKey?columns-1:c.column}};schedule();return;}
    if(cmd&&['Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();void select({row:e.key==='Home'?0:rows-1,column:e.key==='Home'?0:columns-1},e.shiftKey);return;}
    if(cmd||e.altKey)return;
    if(['Enter','F2'].includes(e.key)){e.preventDefault();e.stopPropagation();oncell(c.row,c.column);return;}
    if(e.key.length===1&&!cmd&&!e.altKey){e.preventDefault();e.stopPropagation();oncell(c.row,c.column,e.key);return;}
    if(['Delete','Backspace'].includes(e.key)&&range){e.preventDefault();e.stopPropagation();apply(clearCellRange(element.cells??[],range));status='Cleared cells · Undo available';return;}
    if(e.key==='Tab'){const cells=Array.from(root?.querySelectorAll<HTMLElement>('[data-table-row]')??[]).map(n=>({row:Number(n.dataset.tableRow),column:Number(n.dataset.tableColumn)})),i=cells.findIndex(n=>n.row===c.row&&n.column===c.column)+(e.shiftKey?-1:1);if(cells[i]){e.preventDefault();e.stopPropagation();void select(cells[i]);}return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const m=cellMerge(element.tableStyle,c.row,c.column);void select({row:c.row+(e.key==='ArrowDown'?(m?.rowSpan??1):e.key==='ArrowUp'?-1:0),column:e.key==='Home'?0:e.key==='End'?columns-1:c.column+(e.key==='ArrowRight'?(m?.columnSpan??1):e.key==='ArrowLeft'?-1:0)},e.shiftKey);}
  }
  function position(){if(!root||!tools||!range)return;const r=root.getBoundingClientRect(),coarse=matchMedia('(pointer:coarse)').matches;positionFloating(tools,{...r.toJSON(),height:r.height+(coarse?52:0),bottom:r.bottom+(coarse?52:0)},{preferredHeight:tools.scrollHeight,minHeight:44});}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  function portal(n:HTMLElement){document.body.append(n);return {destroy(){n.remove();}};}
  $effect(()=>{scale;element;range;onselection?.(Boolean(range));void tick().then(schedule);if(drag&&!valid(drag))clear();if(range&&(range.head.row>=rows||range.head.column>=columns||range.anchor.row>=rows||range.anchor.column>=columns)){range={anchor:clamp(range.anchor),head:clamp(range.head)};tabTarget=range.head;}});
  onMount(()=>{void loadFeature('table-cell').catch(()=>{});const observe=new ResizeObserver(schedule);if(root)observe.observe(root);if(tools)observe.observe(tools);window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);const cancel=()=>clear(true);window.addEventListener('blur',cancel);return()=>{onselection?.(false);releaseMenu?.();cancelClipboard();clear();observe.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.removeEventListener('blur',cancel);};});
</script>
<!-- The managed table grid owns cell pointer and clipboard operations. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={root} class="canvas-cell-grid" onpointerdown={down} onpointermove={move} onpointerup={up} onclick={click} onpointercancel={()=>clear(true)} onlostpointercapture={()=>{if(drag)clear(true);}} onkeydown={key} oncopy={e=>copy(e)} oncut={e=>copy(e,true)} onpaste={paste} ondblclick={e=>{e.preventDefault();e.stopPropagation();if(pointerType==="touch"&&previousPointerCell)return;const c=cell(e.target)??pointerCell;if(c&&pointerCell&&c.row===pointerCell.row&&c.column===pointerCell.column&&(!previousPointerCell||previousPointerCell.row===c.row&&previousPointerCell.column===c.column)){lastTap=undefined;oncell(c.row,c.column);}}} oncontextmenu={e=>{const c=cell(e.target);if(c){e.preventDefault();e.stopPropagation();if(!range)void select(c);openMenu(undefined,node(c)??root!,e);}}} onfocusin={e=>{const c=cell(e.target);if(c){tabTarget=c;if(!cellInRange(range,c.row,c.column))void select(c,false,false);}}}>
  <TableVisual element={draft??element} {system} {style} editable managed {activeCell} {tabTarget} selection={bounds} oncell={(row,column)=>oncell(row,column)}/>
{#if root&&!activeCell}<CanvasTableManipulation {element} {root} {range} onrange={next=>{cancelClipboard();range=next;tabTarget=cellOwner(element.tableStyle,next.anchor);styleOpen=false;schedule();}} onapply={applyPatch} onstatus={value=>status=value} onpreview={value=>draft=value} onmenu={openMenu} {scale}/>{/if}
</div>
<div bind:this={tools} use:portal class="cell-tools" role="toolbar" tabindex="-1" aria-label="Selected cells" style:display={range&&!activeCell?'flex':'none'} onkeydown={e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z')cancelClipboard();if(e.key==='Escape'){cancelClipboard();e.preventDefault();extend=false;node(tabTarget)?.focus();}}} oncopy={e=>copy(e)} oncut={e=>copy(e,true)} onpaste={paste}>
  <span class="range-label" title="Drag to select · Shift extends · Esc returns to the object">{label}</span>
  <Button class="range-toggle" variant="quiet" aria-label="Extend cell selection" aria-pressed={extend} title="Tap another cell to extend the range" onclick={()=>extend=!extend}><Expand size={16}/><span class="range-mode">Range</span></Button>
  <Button variant="quiet" aria-label="Style selected cells" aria-expanded={styleOpen} onclick={event=>{styleTrigger=event.currentTarget;styleOpen=!styleOpen;}}><Paintbrush size={16}/><span>Format</span></Button>
  <Button variant="quiet" aria-label="Table actions" aria-haspopup="menu" onclick={event=>{openMenu(undefined,event.currentTarget);}}><Ellipsis size={16}/><span>More</span></Button>
  <Button variant="quiet" aria-label="Move table" title="Drag to move the table · Enter returns to object controls" onpointerdown={e=>{e.preventDefault();e.stopPropagation();onmove(e);}} onkeydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();range=undefined;root?.closest<HTMLElement>('[data-element-id]')?.focus();}}}><Move size={16}/></Button>
  {#if status}<span class="cell-status" role="status">{status}</span>{/if}
</div>
{#if menuAnchor&&range}<CanvasTableContextMenu anchor={menuAnchor} items={actions.filter(item=>!menuAxis||!item.label.includes(menuAxis==='row'?'column':'row'))} onclose={()=>menuAnchor=undefined}/>{/if}
{#if styleOpen&&range&&!activeCell}<CanvasTableStyleEditor element={live()} {system} {range} anchor={()=>styleTrigger} onapply={patch=>applyPatch(patch,editor.deck!.revision,`cell-style:${element.id}:${label}`)} onclose={()=>{styleOpen=false;styleTrigger?.focus();}}/>{/if}
<style>
  .canvas-cell-grid{position:relative;width:100%;height:100%;touch-action:none;user-select:none}.cell-tools{position:fixed;z-index:160;align-items:center;gap:4px;flex-wrap:wrap;max-width:calc(100vw - 24px);padding:4px 8px;background:var(--surface-overlay);color:var(--text-primary);border:1px solid var(--component-border);border-radius:var(--r-popover);box-shadow:var(--shadow-floating);box-sizing:border-box}.cell-tools :global(button[aria-label="Move table"]){order:0}.cell-status{order:2}.range-mode{display:none}.cell-tools :global(.range-toggle){display:none}.range-label{font:var(--ui-meta)/1.4 var(--font-ui);font-variant-numeric:tabular-nums;min-width:42px}.cell-tools :global(button){min-height:36px;padding:8px;gap:4px}.cell-status{flex-basis:100%;font:var(--ui-meta)/1.5 var(--font-ui);max-width:310px;padding:4px}.cell-tools :global(button[aria-pressed=true]){background:var(--surface-selected)}@media(pointer:coarse){.cell-tools :global(.range-toggle){display:inline-flex}.cell-tools :global(button){min-width:44px;min-height:44px}.range-label{min-width:36px}.range-mode{display:inline}.cell-tools{gap:0;padding-inline:6px}.cell-status{flex:1;flex-basis:auto;min-width:120px;max-width:none;padding-inline:8px}.cell-tools :global(button:not([aria-label="Move table"]) svg){display:none}}
</style>
