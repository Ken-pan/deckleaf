<script lang="ts">
  import {onDestroy,untrack} from 'svelte';
  import type {SlideElement} from '../core/model';
  import type {Point} from '../core/interactions';
  import {passedDragThreshold} from '../core/interactions';
  import {lineGeometry} from '../core/line-path';
  import {lineEndpoints,lineBendPoint,lineBendPatch,lineEndpointPatch,lineEndpointTarget,lineSnapTargets,lineWorldToLocal,lineLocalToWorld,type LinePoint,type LineGuide} from '../core/line-editing';
  import {editor} from '../core/editor.svelte';
  import {focusCanvasSelection} from '../editor-focus';
  import {holdPointerCursor,isPointerGestureActive} from '../pointer-cursor';
  let {element:e,scale,canvasPoint,page,onpreview}:{element:SlideElement;scale:number;canvasPoint:(x:number,y:number)=>Point;page:{width:number;height:number};onpreview:(preview:{id:string;patch:Partial<SlideElement>}|null)=>void}=$props();
  type Drag={kind:LinePoint;id:number;node:HTMLButtonElement;base:SlideElement;client:Point;origin:Point;revision:number;slideId:string;deckId:string;active:boolean;patch:Partial<SlideElement>;targets:Point[]};
  let drag=$state<Drag|null>(null),guides=$state<LineGuide[]>([]);
  let releaseCursor:(()=>void)|undefined;
  const geometry=$derived(lineGeometry(e)),bend=$derived(lineBendPoint(e,24/scale));
  const points=$derived([{kind:'start' as const,point:geometry.start},{kind:'end' as const,point:geometry.end},...(bend?[{kind:'bend' as const,point:bend}]:[])]);
  function clear(){const previous=drag;drag=null;guides=[];onpreview(null);releaseCursor?.();releaseCursor=undefined;if(previous?.node.hasPointerCapture(previous.id))previous.node.releasePointerCapture(previous.id);}
  function down(event:PointerEvent,kind:LinePoint){
    if(event.button!==0||e.locked||drag||isPointerGestureActive()||!editor.deck||!editor.slide)return;
    event.preventDefault();event.stopPropagation();
    const at=canvasPoint(event.clientX,event.clientY);
    const nearest=points.map(handle=>({kind:handle.kind,point:lineLocalToWorld(e,handle.point)})).sort((a,b)=>Math.hypot(a.point.x-at.x,a.point.y-at.y)-Math.hypot(b.point.x-at.x,b.point.y-at.y))[0];
    kind=nearest?.kind??kind;
    const clicked=event.currentTarget as HTMLButtonElement,node=clicked.parentElement?.querySelector<HTMLButtonElement>(`[data-line-point="${kind}"]`)??clicked;node.focus({preventScroll:true});
    const base={...e,line:e.line?{...e.line}:undefined};
    drag={kind,id:event.pointerId,node,base,client:{x:event.clientX,y:event.clientY},origin:canvasPoint(event.clientX,event.clientY),revision:editor.deck.revision,slideId:editor.activeId,deckId:editor.deck.id,active:false,patch:{},targets:lineSnapTargets(base,editor.slide.elements,page)};
    node.setPointerCapture(event.pointerId);releaseCursor=holdPointerCursor('crosshair');
  }
  function move(event:PointerEvent){
    if(!drag||event.pointerId!==drag.id)return;event.stopPropagation();
    if(!drag.active&&!passedDragThreshold(event.clientX-drag.client.x,event.clientY-drag.client.y,event.pointerType))return;
    const g=drag,at=canvasPoint(event.clientX,event.clientY);
    if(g.kind==='bend'){const anchor=lineLocalToWorld(g.base,lineBendPoint(g.base)!);guides=[];g.patch=lineBendPatch(g.base,{x:anchor.x+at.x-g.origin.x,y:anchor.y+at.y-g.origin.y});}
    else {
      const origin=lineEndpoints(g.base)[g.kind],raw={x:origin.x+at.x-g.origin.x,y:origin.y+at.y-g.origin.y};
      const next=lineEndpointTarget(g.base,g.kind,raw,{shift:event.shiftKey,alt:event.altKey,snapping:editor.snapping,grid:editor.snapToIncrement,threshold:(event.pointerType==='touch'?10:6)/scale,targets:g.targets});
      guides=next.guides;g.patch=lineEndpointPatch(g.base,g.kind,next.point);
    }
    drag={...g,active:true};onpreview({id:g.base.id,patch:g.patch});
  }
  function up(event:PointerEvent){
    if(!drag||event.pointerId!==drag.id)return;event.stopPropagation();if(drag.active)move(event);
    const g=drag;clear();
    if(g.active&&editor.deck?.id===g.deckId&&editor.deck.revision===g.revision&&editor.activeId===g.slideId&&Object.keys(g.patch).length)editor.commit([{op:'update_element',slideId:g.slideId,elementId:g.base.id,patch:g.patch}],'','manual',g.revision);
  }
  function key(event:KeyboardEvent,kind:LinePoint){
    if(event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(drag)clear();else void focusCanvasSelection();return;}
    if(event.metaKey||event.ctrlKey||event.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    if(kind==='bend'){const delta=(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)*(event.shiftKey ? .1 : .01);editor.patch({line:{...e.line!,bend:Math.max(.1,Math.min(.9,(e.line?.bend??.5)+delta))}},'line-bend-key');}
    else {const p=lineEndpoints(e)[kind],step=event.shiftKey?10:1,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;editor.patch(lineEndpointPatch(e,kind,{x:p.x+dx,y:p.y+dy}),`line-${kind}-key`);}
  }
  function escape(event:KeyboardEvent){if(drag&&event.key==='Escape'){event.preventDefault();event.stopPropagation();clear();}}
  $effect(()=>{if(drag&&(editor.deck?.id!==drag.deckId||editor.deck.revision!==drag.revision||editor.activeId!==drag.slideId||!editor.selected.includes(drag.base.id)||e.locked))untrack(clear);});
  onDestroy(()=>{if(drag)untrack(clear);releaseCursor?.();});
</script>
<svelte:document onkeydowncapture={escape}/>
<svelte:window onblur={()=>{if(drag)clear();}}/>
{#if bend&&['curve','arc'].includes(e.line?.route??'')}<svg class="line-tangent" viewBox="0 0 {e.w} {e.h}" aria-hidden="true"><path d={`M ${geometry.start.x} ${geometry.start.y} L ${bend.x} ${bend.y}`}/></svg>{/if}
{#if guides.length}<svg class="line-snaps" viewBox="0 0 {e.w} {e.h}" aria-hidden="true">{#each guides as guide}{@const a=lineWorldToLocal(e,guide.from)}{@const b=lineWorldToLocal(e,guide.to)}<path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}/>{/each}</svg>{/if}
{#each points as handle(handle.kind)}
  <button type="button" class="line-point" data-line-point={handle.kind} class:bend-point={handle.kind==='bend'} class:active={drag?.kind===handle.kind&&drag.active} style:left={`${handle.point.x}px`} style:top={`${handle.point.y}px`} style:--line-unit={`${1/scale}px`} aria-label={handle.kind==='bend'?'Adjust line bend':`Move line ${handle.kind}`} title={handle.kind==='bend'?'Drag to adjust bend':`Drag ${handle.kind} · Shift: 45° · Alt: free`} oncontextmenu={event=>{event.preventDefault();event.stopPropagation();}} onpointerdown={event=>down(event,handle.kind)} onpointermove={move} onpointerup={up} onpointercancel={()=>{if(drag)clear();}} onlostpointercapture={()=>{if(drag)clear();}} onkeydown={event=>key(event,handle.kind)}></button>
{/each}
<style>
  .line-point {position:absolute;display:grid;place-items:center;transform:translate(-50%,-50%);width:calc(28 * var(--line-unit));height:calc(28 * var(--line-unit));min-width:0;min-height:0;padding:0;border:0;border-radius:50%;background:transparent;pointer-events:auto;touch-action:none;cursor:crosshair;z-index:7;}
  .line-point::after {content:'';width:calc(9 * var(--line-unit));height:calc(9 * var(--line-unit));border:calc(1.5 * var(--line-unit)) solid var(--canvas-selection);border-radius:50%;background:var(--surface-raised);box-sizing:border-box;}
  .line-point.bend-point {z-index:6;}
  .bend-point::after {width:calc(7 * var(--line-unit));height:calc(7 * var(--line-unit));border-radius:calc(1 * var(--line-unit));rotate:45deg;}
  .line-point.active::after {background:var(--canvas-selection);}
  .line-point:focus-visible {outline:none;}
  .line-point:focus-visible::after {outline:calc(1.5 * var(--line-unit)) solid var(--canvas-selection);outline-offset:calc(3 * var(--line-unit));}
  .line-tangent,.line-snaps {position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}
  .line-tangent path,.line-snaps path {fill:none;stroke:var(--canvas-selection);stroke-width:calc(1px / var(--canvas-scale));stroke-dasharray:calc(3px / var(--canvas-scale)) calc(3px / var(--canvas-scale));}
  .line-tangent {opacity:.55;}
  .line-snaps path {stroke:var(--canvas-snap);}
  @media(hover:hover){.line-point:hover::after{background:var(--canvas-selection);}}
  @media(pointer:coarse){.line-point{width:calc(44 * var(--line-unit));height:calc(44 * var(--line-unit));}.line-point::after{width:calc(11 * var(--line-unit));height:calc(11 * var(--line-unit));}.bend-point::after{width:calc(9 * var(--line-unit));height:calc(9 * var(--line-unit));}}
</style>
