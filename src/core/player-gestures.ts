// Self-contained so downloaded HTML and the editor share navigation semantics.
export function createPlaybackGestures(advance: (direction: number) => void, activate: (target: HTMLElement) => void) {
  let start: {x: number; y: number; id: number; time:number; moved:boolean; held:boolean} | null = null, suppressClick = false;
  const blocked = (event: Event) => Boolean((event.target as Element | null)?.closest?.('.prototype-shell,.prototype,button,a,input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
  return {
    pointerdown(event: PointerEvent) {
      if(event.isPrimary === false){start=null;suppressClick=true;return;}
      start = null;suppressClick=false;
      if (event.defaultPrevented || blocked(event)) return;
      activate(event.currentTarget as HTMLElement);
      if (event.pointerType === 'touch') start = {x:event.clientX,y:event.clientY,id:event.pointerId,time:event.timeStamp,moved:false,held:false};
    },
    pointermove(event:PointerEvent) {
      if(start&&!start.moved&&event.pointerId===start.id&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8){start.held=event.timeStamp-start.time>500;start.moved=true;}
    },
    pointerup(event: PointerEvent) {
      if(start&&event.pointerId!==start.id)return;
      const from = start; start = null;
      if (!from) return;
      const dx = event.clientX-from.x, dy = event.clientY-from.y;
      const held=from.held||!from.moved&&event.timeStamp-from.time>500;
      suppressClick=from.moved||Math.hypot(dx,dy)>8||held||event.defaultPrevented;
      if (!held&&!event.defaultPrevented&&!blocked(event)&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.4) {suppressClick=true;advance(dx<0?1:-1);}
    },
    pointercancel() {start=null;suppressClick=true;},
    click(event: MouseEvent) {
      if (event.defaultPrevented || blocked(event)) return;
      if(suppressClick&&event.detail!==0){suppressClick=false;return;}
      activate(event.currentTarget as HTMLElement); advance(1);
    },
  };
}
