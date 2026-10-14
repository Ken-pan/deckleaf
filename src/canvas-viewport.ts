import type {ViewportOptions} from './canvas-viewport-controller';

// Install navigation after the shell's first paint. Cold input is retained so
// an early trackpad pinch cannot turn into page zoom while its controller loads.
export function canvasViewport(node:HTMLElement, options:ViewportOptions) {
  let active:ReturnType<typeof import('./canvas-viewport-controller')['canvasViewport']>|undefined,disposed=false;
  const pending:(WheelEvent|string)[]=[];
  function gate(event:WheelEvent|KeyboardEvent) {
    if(event.defaultPrevented||event.altKey||!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,select,[popover],.prototype-shell')||event instanceof KeyboardEvent&&event.target.closest('[contenteditable="true"]'))return;
    if(event instanceof WheelEvent){if(!event.deltaX&&!event.deltaY)return;pending.push(event);}
    else {if(event.isComposing||event.keyCode===229||!(event.ctrlKey||event.metaKey)||!['+','=','-','0'].includes(event.key)||document.querySelector('dialog:modal,[popover]:popover-open:not([role="tooltip"])'))return;pending.push(event.key);}
    event.preventDefault();event.stopPropagation();
  }
  node.addEventListener('wheel',gate,{passive:false});node.addEventListener('keydown',gate);
  const frame=requestAnimationFrame(()=>{void import('./canvas-viewport-controller').then(module=>{
    if(disposed)return;active=module.canvasViewport(node,options);node.removeEventListener('wheel',gate);node.removeEventListener('keydown',gate);
    void active.replay(pending.splice(0));
  });});
  return {update(next:ViewportOptions){options=next;active?.update(next);},destroy(){disposed=true;cancelAnimationFrame(frame);active?.destroy();node.removeEventListener('wheel',gate);node.removeEventListener('keydown',gate);}};
}
