<script lang="ts">
  import {onMount,onDestroy,untrack} from 'svelte';
  import {editor} from '../core/editor.svelte';
  import type {SlideElement} from '../core/model';
  import {initialCropImage,panCropImage,resizeCropImage,resizeCropFrame,cropImagePatch,type CropBox} from '../core/image-crop';
  import {positionFloating} from '../ui-viewport';
  import {Button} from './ui';
  import {Crop,Check,X} from '@lucide/svelte';
  let {element,slideId,scale}:{element:SlideElement;slideId:string;scale:number}=$props();
  const origin=untrack(()=>({element:{...element},deckId:editor.deck!.id,revision:editor.deck!.revision,slideId}));
  const e=origin.element;
  let size=$state({w:1,h:1}),image=$state<CropBox>({x:0,y:0,w:e.w,h:e.h}),frame=$state<CropBox>({x:0,y:0,w:e.w,h:e.h});
  let ready=$state(false),error=$state(''),toolbar=$state<HTMLDivElement>(),surface=$state<HTMLButtonElement>(),ghost=$state<HTMLButtonElement>();

  let finished=false,positionFrame=0;
  function schedulePosition(){cancelAnimationFrame(positionFrame);positionFrame=requestAnimationFrame(position);}
  type Drag={pointer:number;target:HTMLElement;kind:string;x:number;y:number;image:CropBox;frame:CropBox;scale:number};
  let drag:Drag|undefined;
  const handles=['nw','n','ne','e','se','s','sw','w'];
  const coords=(event:PointerEvent,d:Drag)=>{const x=(event.clientX-d.x)/d.scale,y=(event.clientY-d.y)/d.scale,a=e.rotation*Math.PI/180;return {x:(x*Math.cos(a)+y*Math.sin(a))*(e.flipX?-1:1),y:(-x*Math.sin(a)+y*Math.cos(a))*(e.flipY?-1:1)};};
  function load(event:Event){if(ready)return;const img=event.currentTarget as HTMLImageElement;size={w:img.naturalWidth,h:img.naturalHeight};image=initialCropImage(e,size);ready=true;schedulePosition();}
  function begin(event:PointerEvent,kind:string){
    if(!ready||event.button!==0||drag)return;event.preventDefault();event.stopPropagation();const target=event.currentTarget as HTMLElement;target.setPointerCapture(event.pointerId);drag={pointer:event.pointerId,target,kind,x:event.clientX,y:event.clientY,image:{...image},frame:{...frame},scale};
  }
  function move(event:PointerEvent){
    const d=drag;if(!d||d.pointer!==event.pointerId)return;event.preventDefault();event.stopPropagation();const delta=coords(event,d);
    if(d.kind==='pan')image=panCropImage(d.image,d.frame,delta.x,delta.y);
    else if(d.kind.startsWith('scale-'))image=resizeCropImage(d.image,d.kind.slice(6),delta.x,delta.y,8/d.scale);
    else frame=resizeCropFrame(d.frame,d.image,d.kind,delta.x,delta.y,event.shiftKey?d.frame.w/d.frame.h:undefined,event.altKey);
    schedulePosition();
  }
  function end(event:PointerEvent){if(drag?.pointer!==event.pointerId)return;const d=drag;drag=undefined;if(d.target.hasPointerCapture(event.pointerId))d.target.releasePointerCapture(event.pointerId);}
  function cancelPointer(event:PointerEvent){if(drag?.pointer!==event.pointerId)return;image=drag.image;frame=drag.frame;end(event);}
  function reset(){frame={x:0,y:0,w:e.w,h:e.h};image=initialCropImage({...e,fit:'cover',crop:undefined,imagePosition:undefined,imageZoom:undefined},size);error='';schedulePosition();}
  function finish(cancel=false){
    if(finished)return;
    if(!cancel&&!ready)return;
    if(!cancel&&(editor.deck?.id!==origin.deckId||editor.activeId!==origin.slideId||editor.deck.revision!==origin.revision)){error='The document changed. Cancel and reopen Crop.';return;}
    if(!cancel){const patch=cropImagePatch(e,size,frame,image);editor.commit([{op:'update_element',slideId,elementId:e.id,patch}],'','manual',origin.revision);if(editor.deck?.revision===origin.revision){error=editor.error||'The crop could not update.';return;}}
    finished=true;editor.croppingId='';document.querySelector<HTMLElement>('.canvas-stage')?.focus({preventScroll:true});
  }
  function key(event:KeyboardEvent){
    if(event.defaultPrevented||event.isComposing||event.keyCode===229)return;
    const typing=(event.target as Element).closest('input,select,textarea');
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);return;}
    if(event.key==='Enter'&&!typing){event.preventDefault();event.stopImmediatePropagation();finish();return;}
    if(typing)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();const n=(event.shiftKey?10:1)/scale,x=event.key==='ArrowLeft'?-n:event.key==='ArrowRight'?n:0,y=event.key==='ArrowUp'?-n:event.key==='ArrowDown'?n:0,a=e.rotation*Math.PI/180,dx=(x*Math.cos(a)+y*Math.sin(a))*(e.flipX?-1:1),dy=(-x*Math.sin(a)+y*Math.cos(a))*(e.flipY?-1:1),handle=(event.target as HTMLElement).dataset.cropHandle,sourceHandle=(event.target as HTMLElement).dataset.imageScale;
      if(sourceHandle)image=resizeCropImage(image,sourceHandle,dx,dy,8/scale);else if(handle)frame=resizeCropFrame(frame,image,handle,dx,dy);else image=panCropImage(image,frame,dx,dy);return;
    }
    if(['Delete','Backspace'].includes(event.key)||event.metaKey||event.ctrlKey){event.preventDefault();event.stopImmediatePropagation();}
  }
  function outside(event:PointerEvent){if(finished||(event.target as Element).closest('[data-image-crop]'))return;event.preventDefault();event.stopImmediatePropagation();finish();}
  function position(){if(!toolbar||!surface)return;const a=surface.getBoundingClientRect(),b=ghost?.getBoundingClientRect()??a,l=Math.min(a.left,b.left)-48,t=Math.min(a.top,b.top)-48,r=Math.max(a.right,b.right)+48,bottom=Math.max(a.bottom,b.bottom)+48;positionFloating(toolbar,new DOMRect(l,t,r-l,bottom-t),{preferredHeight:toolbar.scrollHeight,minHeight:80});}
  function portal(node:HTMLElement){document.body.append(node);return {destroy(){node.remove();}};}
  $effect(()=>{if(editor.deck?.id!==origin.deckId||editor.activeId!==origin.slideId||!editor.selected.includes(e.id)||editor.sourceMode)finish(true);});
  onMount(()=>{
    window.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);document.addEventListener('scroll',position,true);
    const observer=new ResizeObserver(schedulePosition);if(toolbar)observer.observe(toolbar);position();
    return()=>{observer.disconnect();window.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);document.removeEventListener('scroll',position,true);};
  });
  onDestroy(()=>{cancelAnimationFrame(positionFrame);if(!finished&&editor.croppingId===e.id)editor.croppingId='';});
</script>

<div class="canvas-image-crop" data-image-crop style:--crop-scale={scale} aria-label="Crop image on canvas">
  <button type="button" bind:this={ghost} class="crop-image-ghost" aria-label="Move original image" style:left={`${image.x}px`} style:top={`${image.y}px`} style:width={`${image.w}px`} style:height={`${image.h}px`} onpointerdown={ev=>begin(ev,'pan')} onpointermove={move} onpointerup={end} onpointercancel={cancelPointer} onlostpointercapture={end}><img src={e.src} alt="Uncropped original" draggable="false" onload={load} onerror={()=>error='The image could not load. Cancel and check its source.'}/></button>
  <button type="button" bind:this={surface} class="crop-frame" aria-label="Reposition image in crop" style:left={`${frame.x}px`} style:top={`${frame.y}px`} style:width={`${frame.w}px`} style:height={`${frame.h}px`} onpointerdown={ev=>begin(ev,'pan')} onpointermove={move} onpointerup={end} onpointercancel={cancelPointer} onlostpointercapture={end}><img src={e.src} alt={e.name} draggable="false" style:left={`${image.x-frame.x}px`} style:top={`${image.y-frame.y}px`} style:width={`${image.w}px`} style:height={`${image.h}px`}/><span class="crop-grid" aria-hidden="true"></span></button>
  {#each ['nw','ne','se','sw'] as h}<button type="button" class="image-scale-handle {h}" aria-label={`Resize original image ${h}`} data-image-scale={h} style:left={`${image.x+(h.includes('w')?0:image.w)+(h.includes('w')?-24:24)/scale}px`} style:top={`${image.y+(h.includes('n')?0:image.h)+(h.includes('n')?-24:24)/scale}px`} onpointerdown={ev=>begin(ev,`scale-${h}`)} onpointermove={move} onpointerup={end} onpointercancel={cancelPointer} onlostpointercapture={end}><span></span></button>{/each}
  {#each handles as h}<button type="button" class="canvas-crop-handle {h}" aria-label={`Crop edge ${h}`} data-crop-handle={h} style:left={`${frame.x+(h.includes('w')?0:h.includes('e')?frame.w:frame.w/2)}px`} style:top={`${frame.y+(h.includes('n')?0:h.includes('s')?frame.h:frame.h/2)}px`} onpointerdown={ev=>begin(ev,h)} onpointermove={move} onpointerup={end} onpointercancel={cancelPointer} onlostpointercapture={end}><span></span></button>{/each}
</div>
<div bind:this={toolbar} use:portal class="canvas-crop-toolbar" data-image-crop role="toolbar" aria-label="Image crop controls">
  <div class="crop-toolbar-heading"><span><Crop size={16}/>Crop</span><div><Button variant="quiet" size="md" onclick={reset}>Reset</Button><Button aria-label="Cancel crop" variant="quiet" size="md" onclick={()=>finish(true)}><X size={16}/>Cancel</Button><Button aria-label="Done cropping" variant="quiet" size="md" disabled={!ready||Boolean(error)} onclick={()=>finish()}><Check size={16}/>Done</Button></div></div>

  {#if error}<p role="alert">{error}</p>{:else}<p>Drag the image and handles · Enter to finish · Esc to cancel</p>{/if}
</div>
<style>
  .canvas-image-crop{position:absolute;inset:0;pointer-events:none}.crop-image-ghost,.crop-frame{position:absolute;display:block;padding:0;border:0;border-radius:0;min-height:0;touch-action:none;pointer-events:auto;cursor:move;background:transparent}.crop-image-ghost{opacity:.3}.crop-image-ghost img{width:100%;height:100%;display:block;pointer-events:none;user-select:none}.crop-frame{overflow:hidden;outline:calc(1.5px / var(--crop-scale)) solid var(--canvas-selection);background:transparent}.crop-frame img{position:absolute;max-width:none;pointer-events:none;user-select:none}.crop-grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent calc(33.333% - .5px),#ffffff90 33.333%,transparent calc(33.333% + .5px),transparent calc(66.666% - .5px),#ffffff90 66.666%,transparent calc(66.666% + .5px)),linear-gradient(transparent calc(33.333% - .5px),#ffffff90 33.333%,transparent calc(33.333% + .5px),transparent calc(66.666% - .5px),#ffffff90 66.666%,transparent calc(66.666% + .5px))}.canvas-crop-handle,.image-scale-handle{position:absolute;display:grid;place-items:center;width:calc(28px / var(--crop-scale));height:calc(28px / var(--crop-scale));min-height:0;padding:0;transform:translate(-50%,-50%);border:0;border-radius:0;background:transparent;pointer-events:auto;touch-action:none;z-index:2}.canvas-crop-handle span,.image-scale-handle span{width:calc(8px / var(--crop-scale));height:calc(8px / var(--crop-scale));background:var(--surface-top);border:calc(1px / var(--crop-scale)) solid var(--canvas-selection)}.image-scale-handle span{border-radius:50%}.image-scale-handle{z-index:1}.nw,.se{cursor:nwse-resize}.ne,.sw{cursor:nesw-resize}.n,.s{cursor:ns-resize}.e,.w{cursor:ew-resize}
  .canvas-crop-toolbar{position:fixed;margin:0;z-index:105;width:420px;max-width:calc(100vw - 24px);padding:12px;border:1px solid var(--overlay-border);border-radius:var(--r-popover);background:var(--surface-overlay);color:var(--text-primary);box-shadow:var(--shadow-floating);font:var(--ui-label)/var(--ui-line-body) var(--font-ui);pointer-events:auto;overflow:auto}.crop-toolbar-heading{display:flex;justify-content:space-between;align-items:center;gap:8px}.crop-toolbar-heading>span{display:flex;align-items:center;gap:8px;font-weight:var(--ui-weight-medium)}.crop-toolbar-heading>div{display:flex;gap:4px}.canvas-crop-toolbar p{margin:8px 0 0;font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary)}
  @media(max-width:760px),(pointer:coarse){.canvas-crop-handle,.image-scale-handle{width:calc(44px / var(--crop-scale));height:calc(44px / var(--crop-scale))}.crop-toolbar-heading :global(button){min-height:44px}}
  @media(max-width:360px){.crop-toolbar-heading{flex-wrap:wrap}.crop-toolbar-heading>div{flex:1 1 100%;justify-content:flex-end}}
  @media(forced-colors:active){.canvas-crop-handle span{background:Canvas;border-color:Highlight}}
</style>
