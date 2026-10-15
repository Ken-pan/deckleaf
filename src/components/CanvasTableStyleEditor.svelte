<script lang="ts">
  import {onMount,tick} from 'svelte';
  import {X,Bold,Italic,AlignLeft,AlignCenter,AlignRight} from '@lucide/svelte';
  import {Button} from './ui';
  import ColorField from './ui/ColorField.svelte';
  import {tablePresentation,tableCellStyle} from '../core/table-appearance';
  import {styleTableRange,cellOwner} from '../core/table-structure';
  import {cellBounds,type CellRange} from '../core/table-grid';
  import type {TableCellStyle} from '../core/table-schema';
  import type {SlideElement} from '../core/model';
  import type {DesignSystem} from '../core/design-system-schema';
  import {positionFloating} from '../ui-viewport';
  import {popoverFocus} from '../ui-focus';
  import {editor} from '../core/editor.svelte';
  let {element,system,range,anchor,onapply,onclose}:{element:SlideElement;system?:DesignSystem;range:CellRange;anchor:()=>HTMLElement|undefined;onapply:(patch:Partial<SlideElement>)=>boolean;onclose:()=>void}=$props();
  let popup=$state<HTMLDivElement>(),frame=0,closing=false;
  const bounds=$derived(cellBounds(range)),p=$derived(tablePresentation(element,system));
  const styles=$derived.by(()=>{const result:ReturnType<typeof tableCellStyle>[]=[];for(let r=bounds.top;r<=bounds.bottom;r++)for(let c=bounds.left;c<=bounds.right;c++){const owner=cellOwner(element.tableStyle,{row:r,column:c});result.push(tableCellStyle(p,owner.row,owner.column));}return result;});
  function mixed(key:keyof ReturnType<typeof tableCellStyle>){return styles.some(s=>s[key]!==styles[0]?.[key]);}
  function apply(patch:Omit<Partial<TableCellStyle>,'row'|'column'>|null){const live=editor.slide?.elements.find(e=>e.id===element.id);if(!live||live.locked)return false;return onapply(styleTableRange(live,range,patch,system));}
  function position(){if(popup?.matches(':popover-open')&&anchor())positionFloating(popup,anchor()!.getBoundingClientRect(),{preferredHeight:popup.scrollHeight,minHeight:240});}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  function close(){if(closing)return;closing=true;popup?.hidePopover();onclose();}
  onMount(()=>{popup!.showPopover();void tick().then(()=>{position();popup?.querySelector<HTMLButtonElement>('[aria-label="Bold cells"]')?.focus();});const observer=new ResizeObserver(schedule);observer.observe(popup!);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);return()=>{closing=true;popup?.hidePopover();observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};});
</script>
<div bind:this={popup} popover="auto" class="cell-style-editor" role="dialog" aria-label="Style selected cells" tabindex="-1" use:popoverFocus={{close,origin:anchor}} onbeforetoggle={e=>{if(e.newState==='closed'&&!closing)close();}} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();close();e.shiftKey?editor.redo():editor.undo();}}}>
  <header><strong>Selected cells</strong><Button variant="quiet" aria-label="Close cell styles" onclick={close}><X size={16}/></Button></header>
  <div class="cell-style-row" role="group" aria-label="Cell text style">
    <Button variant="quiet" aria-label="Bold cells" aria-pressed={mixed('fontWeight')?'mixed':(styles[0]?.fontWeight??400)>=600} onclick={()=>apply({fontWeight:!mixed('fontWeight')&&(styles[0]?.fontWeight??400)>=600?400:600})}><Bold size={16}/></Button>
    <Button variant="quiet" aria-label="Italic cells" aria-pressed={mixed('fontStyle')?'mixed':styles[0]?.fontStyle==='italic'} onclick={()=>apply({italic:mixed('fontStyle')||styles[0]?.fontStyle!=='italic'})}><Italic size={16}/></Button>
    <span class="separator"></span>
    {#each [{value:'left',label:'Align cells left',icon:AlignLeft},{value:'center',label:'Center cells',icon:AlignCenter},{value:'right',label:'Align cells right',icon:AlignRight}] as item}<Button variant="quiet" aria-label={item.label} aria-pressed={!mixed('textAlign')&&styles[0]?.textAlign===item.value} onclick={()=>apply({align:item.value as TableCellStyle['align']})}><item.icon size={16}/></Button>{/each}
  </div>
  <label class="field-label">Vertical alignment<select aria-label="Cell vertical alignment" value={mixed('verticalAlign')?'mixed':styles[0]?.verticalAlign??'top'} onchange={e=>apply({verticalAlign:e.currentTarget.value as TableCellStyle['verticalAlign']})}>{#if mixed('verticalAlign')}<option value="mixed" disabled>Mixed</option>{/if}<option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
  <label class="field-label">Fill<ColorField label="Cell fill" value={styles[0]?.background??'#ffffff'} mixed={mixed('background')} onchange={value=>apply({fill:value})}/></label>
  <label class="field-label">Text<ColorField label="Cell text" value={styles[0]?.color??'#172b26'} mixed={mixed('color')} opaque allowClear={false} onchange={value=>apply({color:value})}/></label>
  <footer><Button variant="quiet" onclick={()=>apply(null)}>Reset cells</Button><Button variant="secondary" onclick={close}>Done</Button></footer>
</div>
<style>
  .cell-style-editor{position:fixed;inset:auto;margin:0;width:min(288px,calc(100vw - 24px));box-sizing:border-box;padding:12px;border:1px solid var(--component-border);border-radius:var(--r-popover);background:var(--dialog-surface);color:var(--text-primary);box-shadow:var(--shadow-popover);display:flex;flex-direction:column;gap:12px;overflow:auto}.cell-style-editor header,.cell-style-editor footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.cell-style-editor strong{font-size:var(--ui-label)}.cell-style-row{display:flex;gap:4px}.cell-style-row :global(button),header :global(button){min-width:36px;min-height:36px;padding:8px}.cell-style-row :global([aria-pressed=true]){background:var(--surface-selected)}.separator{width:1px;background:var(--component-border);margin:6px 4px}.field-label{margin:0;gap:4px}.field-label select{min-height:36px;width:100%}footer{padding-top:4px}@media(pointer:coarse),(max-width:760px){.cell-style-row :global(button),header :global(button),footer :global(button),.field-label select{min-width:44px;min-height:44px}.cell-style-row{gap:0}.separator{margin-inline:3px}.cell-style-editor :global(.color-swatch),.cell-style-editor :global(.color-clear){width:44px;height:44px}}
</style>
