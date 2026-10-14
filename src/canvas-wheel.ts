type WheelInput = Pick<WheelEvent,'deltaX'|'deltaY'|'deltaMode'|'ctrlKey'|'metaKey'|'shiftKey'|'altKey'>;
export type CanvasWheel = {kind:'zoom';delta:number}|{kind:'pan';x:number;y:number};
export function canvasWheel(input:WheelInput, viewport:{width:number;height:number}):CanvasWheel|undefined {
  if(input.altKey||!Number.isFinite(input.deltaX)||!Number.isFinite(input.deltaY))return;
  const x=input.deltaX*(input.deltaMode===1?16:input.deltaMode===2?viewport.width:1);
  const y=input.deltaY*(input.deltaMode===1?16:input.deltaMode===2?viewport.height:1);
  if(input.ctrlKey||input.metaKey)return y?{kind:'zoom',delta:y}:undefined;
  if(!x&&!y)return;
  // Shift redirects a vertical mouse wheel; native two-axis gestures stay intact.
  return input.shiftKey&&!x?{kind:'pan',x:y,y:0}:{kind:'pan',x,y};
}

export function pagesWithWheel(navigation:CanvasWheel,{fits,blocked,shift}:{fits:boolean;blocked:boolean;shift:boolean}) {
  return navigation.kind==='pan'&&fits&&!blocked&&!shift&&Math.abs(navigation.y)>Math.abs(navigation.x);
}

// High-resolution trackpad events and their momentum form one paging gesture.
// A pause or a deliberate direction reversal starts the next gesture.
export class SlideWheelPager {
  private last=-Infinity;
  private direction=0;
  private distance=0;
  private consumed=false;
  reset(){this.last=-Infinity;this.direction=0;this.distance=0;this.consumed=false;}
  take(delta:number,time:number) {
    if(!Number.isFinite(delta)||!delta||!Number.isFinite(time))return 0;
    const direction=Math.sign(delta);
    if(time-this.last>180||direction!==this.direction){this.distance=0;this.consumed=false;}
    this.last=time;this.direction=direction;
    if(this.consumed)return 0;
    this.distance+=Math.abs(delta);
    if(this.distance<40)return 0;
    this.consumed=true;return direction;
  }
}
