import {holdPointerCursor} from './pointer-cursor';

export type SlideDragSnapshot={ids:string[];deckId:string;revision:number};
type Options={start:()=>SlideDragSnapshot|undefined;preview:(target:string,after:boolean,moving:boolean)=>void;drop:(snapshot:SlideDragSnapshot,target:string,after:boolean)=>void};

/** A dedicated grip leaves ordinary touch scrolling and thumbnail selection native. */
export function slideSelectionDrag(node:HTMLElement,initial:Options){
  let options=initial,session:{snapshot:SlideDragSnapshot;pointer:number;x:number;y:number;startX:number;startY:number;moving:boolean;target:string;after:boolean}|undefined;
  let frame=0,releaseCursor:(()=>void)|undefined;
  function hit(){
    if(!session)return;
    const rail=node.closest('.slide-rail'),list=rail?.querySelector<HTMLElement>('.slide-list');if(!list)return;
    const horizontal=list.getAttribute('aria-orientation')==='horizontal';
    const thumb=document.elementFromPoint(session.x,session.y)?.closest<HTMLElement>('.slide-thumb');
    const valid=thumb&&list.contains(thumb)&&!session.snapshot.ids.includes(thumb.dataset.slideId!);
    const rect=valid?thumb.getBoundingClientRect():undefined;
    session.target=valid?thumb.dataset.slideId!:'';
    session.after=Boolean(rect&&(horizontal?session.x>rect.x+rect.width/2:session.y>rect.y+rect.height/2));
    options.preview(session.target,session.after,session.moving);
  }
  function scroll(){
    if(!session?.moving)return;
    const list=node.closest('.slide-rail')?.querySelector<HTMLElement>('.slide-list');
    if(list){const r=list.getBoundingClientRect(),horizontal=list.getAttribute('aria-orientation')==='horizontal',p=horizontal?session.x:session.y,min=horizontal?r.left:r.top,max=horizontal?r.right:r.bottom;
      const inside=horizontal?session.y>=r.top-24&&session.y<=r.bottom+24:session.x>=r.left-24&&session.x<=r.right+24;
      const delta=inside?p<min+28?-Math.min(14,(min+28-p)/2):p>max-28?Math.min(14,(p-max+28)/2):0:0;
      if(delta)list.scrollBy(horizontal?{left:delta}:{top:delta});hit();
    }
    frame=requestAnimationFrame(scroll);
  }
  function cancel(){
    const old=session;session=undefined;cancelAnimationFrame(frame);releaseCursor?.();releaseCursor=undefined;delete node.dataset.dragging;
    if(old&&node.hasPointerCapture(old.pointer))node.releasePointerCapture(old.pointer);
    options.preview('',false,false);
  }
  function down(event:PointerEvent){
    if(event.button!==0||!event.isPrimary)return;const snapshot=options.start();if(!snapshot?.ids.length)return;
    cancel();event.preventDefault();node.querySelector('button')?.focus({preventScroll:true});
    session={snapshot,pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moving:false,target:'',after:false};
    node.setPointerCapture(event.pointerId);
  }
  function move(event:PointerEvent){
    if(!session||event.pointerId!==session.pointer)return;session.x=event.clientX;session.y=event.clientY;
    if(!session.moving&&Math.hypot(session.x-session.startX,session.y-session.startY)>=6){session.moving=true;node.dataset.dragging='true';releaseCursor=holdPointerCursor('grabbing');frame=requestAnimationFrame(scroll);}
    if(session.moving){event.preventDefault();hit();}
  }
  function up(event:PointerEvent){
    if(!session||event.pointerId!==session.pointer)return;session.x=event.clientX;session.y=event.clientY;hit();const old=session;cancel();
    if(old.moving&&old.target)options.drop(old.snapshot,old.target,old.after);
  }
  function key(event:KeyboardEvent){if(session&&event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();cancel();}}
  node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',cancel);node.addEventListener('lostpointercapture',cancel);
  window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
  return{update(next:Options){options=next;},destroy(){cancel();node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',cancel);node.removeEventListener('lostpointercapture',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);}};
}
