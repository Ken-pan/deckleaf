<script lang="ts">
  import {portalToBody} from '../ui-portal';
  import {onMount,tick} from 'svelte';
  import {X,Bold,Italic,AlignLeft,AlignCenter,AlignRight} from '@lucide/svelte';
  import {Button} from './ui';
  import ColorField from './ui/ColorField.svelte';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  import PropertyRow from './ui/PropertyRow.svelte';
  import {textAlignmentIcons} from './icons/text-icons';
  import {tablePresentation,tableCellStyle} from '../core/table-appearance';
  import {styleTableRange,cellOwner} from '../core/table-structure';
  import {cellBounds,type CellRange} from '../core/table-grid';
  import type {TableCellStyle} from '../core/table-schema';
  import type {SlideElement} from '../core/model';
  import type {DesignSystem} from '../core/design-system-schema';
  import {floatingPlacement,visualBounds} from '../ui-viewport';
  import {popoverFocus} from '../ui-focus';
  import {editor} from '../core/editor.svelte';
  let {element,system,range,anchor,onapply,onclose}:{element:SlideElement;system?:DesignSystem;range:CellRange;anchor:()=>HTMLElement|undefined;onapply:(patch:Partial<SlideElement>)=>boolean;onclose:()=>void}=$props();
  let popup=$state<HTMLDivElement>(),frame=0,closing=false;
  const bounds=$derived(cellBounds(range)),p=$derived(tablePresentation(element,system));
  const styles=$derived.by(()=>{const result:ReturnType<typeof tableCellStyle>[]=[];for(let r=bounds.top;r<=bounds.bottom;r++)for(let c=bounds.left;c<=bounds.right;c++){const owner=cellOwner(element.tableStyle,{row:r,column:c});result.push(tableCellStyle(p,owner.row,owner.column));}return result;});
  function mixed(key:keyof ReturnType<typeof tableCellStyle>){return styles.some(s=>s[key]!==styles[0]?.[key]);}
  function apply(patch:Omit<Partial<TableCellStyle>,'row'|'column'>|null){const live=editor.slide?.elements.find(e=>e.id===element.id);if(!live||live.locked)return false;return onapply(styleTableRange(live,range,patch,system));}
  function position(){
    if(!popup?.matches(':popover-open')||!anchor())return;
    const root=document.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(element.id)}"] .canvas-cell-grid`),stage=root?.closest('.canvas-stage')?.getBoundingClientRect(),dock=document.querySelector('.canvas-insert-dock')?.getBoundingClientRect(),v=visualBounds();
    const left=Math.max(v.left,stage?.left??v.left),top=Math.max(v.top,stage?.top??v.top),right=Math.min(v.left+v.width,stage?.right??v.left+v.width),bottom=Math.min(v.top+v.height,stage?.bottom??v.top+v.height,dock?dock.top-8:Infinity),viewport={left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
    const cells=Array.from(root?.querySelectorAll<HTMLElement>('.selected-cell')??[],node=>node.getBoundingClientRect()),avoid=cells.length?{left:Math.min(...cells.map(r=>r.left)),right:Math.max(...cells.map(r=>r.right)),top:Math.min(...cells.map(r=>r.top)),bottom:Math.max(...cells.map(r=>r.bottom))}:undefined;
    popup.style.maxWidth=`${Math.max(1,viewport.width-24)}px`;
    const place=()=>floatingPlacement(anchor()!.getBoundingClientRect(),{width:popup!.offsetWidth,height:popup!.offsetHeight},viewport,{preferredHeight:popup!.scrollHeight,minHeight:240,avoid});
    popup.style.maxHeight=`${place().maxHeight}px`;const result=place();popup.style.left=`${result.left}px`;popup.style.top=`${result.top}px`;
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  function close(){if(closing)return;closing=true;popup?.hidePopover();onclose();}
  onMount(()=>{popup!.showPopover();void tick().then(()=>{position();popup?.querySelector<HTMLButtonElement>('[aria-label="Bold cells"]')?.focus();});const observer=new ResizeObserver(schedule);observer.observe(popup!);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);return()=>{closing=true;popup?.hidePopover();observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};});
</script>
<div bind:this={popup} use:portalToBody popover="auto" class="cell-style-editor ui-property-surface" role="dialog" aria-label="Style selected cells" tabindex="-1" use:popoverFocus={{close,origin:anchor}} onbeforetoggle={e=>{if(e.newState==='closed'&&!closing)close();}} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){if(e.target instanceof HTMLInputElement&&e.target.value!==e.target.dataset.documentValue)return;e.preventDefault();e.stopPropagation();close();e.shiftKey?editor.redo():editor.undo();}}}>
  <header><strong>Cells {String.fromCharCode(65+bounds.left)}{bounds.top+1}{bounds.top===bounds.bottom&&bounds.left===bounds.right?'':`:${String.fromCharCode(65+bounds.right)}${bounds.bottom+1}`}</strong><Button variant="quiet" kind="icon" aria-label="Close cell styles" onclick={close}><X size={16}/></Button></header>
  <div class="cell-style-row" role="group" aria-label="Cell text style">
    <Button variant="quiet" aria-label="Bold cells" aria-pressed={mixed('fontWeight')?'mixed':(styles[0]?.fontWeight??400)>=600} onclick={()=>apply({fontWeight:!mixed('fontWeight')&&(styles[0]?.fontWeight??400)>=600?400:600})}><Bold size={16}/></Button>
    <Button variant="quiet" aria-label="Italic cells" aria-pressed={mixed('fontStyle')?'mixed':styles[0]?.fontStyle==='italic'} onclick={()=>apply({italic:mixed('fontStyle')||styles[0]?.fontStyle!=='italic'})}><Italic size={16}/></Button>
    <span class="separator"></span>
    <PropertyChoice label="Cell text alignment" icons value={mixed('textAlign')?'':styles[0]?.textAlign} options={[{value:'left',label:'Left',icon:AlignLeft},{value:'center',label:'Center',icon:AlignCenter},{value:'right',label:'Right',icon:AlignRight}]} onchange={value=>{apply({align:value as TableCellStyle['align']});}}/>
  </div>
  <PropertyRow label="Vertical"><PropertyChoice label="Cell vertical alignment" icons value={mixed('verticalAlign')?'':styles[0]?.verticalAlign??'top'} options={[{value:'top',label:'Top',icon:textAlignmentIcons.top},{value:'middle',label:'Middle',icon:textAlignmentIcons.middle},{value:'bottom',label:'Bottom',icon:textAlignmentIcons.bottom}]} onchange={value=>{apply({verticalAlign:value as TableCellStyle['verticalAlign']});}}/></PropertyRow>
  <PropertyRow label="Fill"><ColorField label="Cell fill" opaque value={styles[0]?.background??'#ffffff'} mixed={mixed('background')} onchange={value=>apply({fill:value})}/></PropertyRow>
  <PropertyRow label="Text"><ColorField label="Cell text" value={styles[0]?.color??'#172b26'} mixed={mixed('color')} opaque allowClear={false} onchange={value=>apply({color:value})}/></PropertyRow>
  <footer><Button variant="quiet" onclick={()=>apply(null)}>Reset cells</Button><Button variant="secondary" onclick={close}>Done</Button></footer>
</div>
<style>
  .cell-style-editor{position:fixed;inset:auto;margin:0;width:min(288px,calc(100vw - 24px));box-sizing:border-box;padding:12px;border:1px solid var(--component-border);border-radius:var(--r-popover);background:var(--dialog-surface);color:var(--text-primary);box-shadow:var(--shadow-popover);display:flex;flex-direction:column;gap:12px;overflow:auto;scrollbar-gutter:stable;}.cell-style-editor header,.cell-style-editor footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.cell-style-editor strong{font-size:var(--ui-label)}.cell-style-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.cell-style-row :global(.property-choice){flex:1;min-width:0}.cell-style-row :global(.ui-button),header :global(button){min-width:36px;min-height:36px;padding:8px}.cell-style-row :global([aria-pressed=true]){background:var(--state-selected);color:var(--text-link)}.separator{width:1px;background:var(--component-border);margin:6px 4px}footer{padding-top:4px}@media(pointer:coarse),(max-width:760px){.cell-style-row :global(.ui-button),header :global(button),footer :global(button),.cell-style-row{gap:0}.separator{margin-inline:3px}}
</style>
