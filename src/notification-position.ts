import { visualBounds, type ViewportBounds } from './ui-viewport';

type Rect = {left:number; right:number; top:number; bottom:number};
export function notificationPlacement(size:{width:number;height:number}, viewport:ViewportBounds, options:{canvas?:Rect; footer?:Rect; top?:number} = {}) {
  const margin=viewport.width<=760?12:16, gap=12;
  const canvas=viewport.width>760?options.canvas:undefined;
  const leftEdge=Math.max(viewport.left,canvas?.left??viewport.left)+margin;
  const rightEdge=Math.min(viewport.left+viewport.width,canvas?.right??viewport.left+viewport.width)-margin;
  const width=Math.min(size.width,Math.max(1,rightEdge-leftEdge)),left=rightEdge-width;
  const topEdge=Math.max(viewport.top+margin,options.top??viewport.top+margin);
  let bottom=viewport.top+viewport.height-margin;
  const footer=options.footer;
  if(footer&&footer.left<rightEdge&&footer.right>left&&footer.bottom>topEdge)bottom=Math.min(bottom,footer.top-gap);
  const available=Math.max(0,bottom-topEdge),height=Math.min(size.height,available);
  return {left,top:Math.max(topEdge,bottom-height),width,maxHeight:available,hidden:available<Math.min(size.height,80)};
}

// Use the actual footer and canvas geometry: wrapping tools, panel visibility,
// text sizing and short screens change their size independently of breakpoints.
export function positionNotification(node:HTMLElement) {
  let frame=0,settleUntil=performance.now()+400;
  const editor=document.querySelector<HTMLElement>('.editor-app');
  const rect=(selector:string)=>{
    const element=editor?.querySelector<HTMLElement>(selector);
    return element&&element.getClientRects().length&&!element.closest('[inert],[hidden]')?element.getBoundingClientRect():undefined;
  };
  const apply=()=>{
    const viewport=visualBounds(),header=rect('.topbar'),feedback=rect('.notification-feedback');
    // The insertion dock can extend above its footer. Protect the actual
    // controls, rather than the footer's sometimes empty layout rectangle.
    const controls=[...editor?.querySelectorAll<HTMLElement>('.stage-footer button,.stage-footer input,.canvas-insert-dock')??[]].filter(e=>e.getClientRects().length&&!e.closest('[inert],[hidden]')).map(e=>e.getBoundingClientRect());
    const footer=controls.length?{left:Math.min(...controls.map(r=>r.left)),right:Math.max(...controls.map(r=>r.right)),top:Math.min(...controls.map(r=>r.top)),bottom:Math.max(...controls.map(r=>r.bottom))}:undefined;
    const height=Math.ceil([...node.children].reduce((total,child)=>total+child.getBoundingClientRect().height,0)||node.scrollHeight);
    const result=notificationPlacement({width:Math.min(360,viewport.width-24),height},viewport,{canvas:rect('.canvas-stage'),footer,top:Math.max(viewport.top,header?.bottom??0,feedback?.bottom??0)+12});
    node.style.left=`${result.left}px`;node.style.top=`${result.top}px`;
    node.style.width=`${result.width}px`;node.style.maxHeight=`${result.maxHeight}px`;
    node.style.setProperty('--notification-max-height',`${result.maxHeight}px`);
    const hidden=String(result.hidden);
    if(node.dataset.notificationHidden!==hidden){node.dataset.notificationHidden=hidden;node.dispatchEvent(new Event('notificationvisibilitychange'));}
    // Layout motion can change a control's position without changing its size.
    // Follow the short transition, then leave no permanent animation loop.
    if(performance.now()<settleUntil)frame=requestAnimationFrame(apply);
  };
  const schedule=()=>{cancelAnimationFrame(frame);settleUntil=performance.now()+400;frame=requestAnimationFrame(apply);};
  const resize=new ResizeObserver(schedule);
  for(const element of [node,editor,...editor?.querySelectorAll('.workspace,.topbar,.canvas-stage,.slide-rail,.stage-footer,.canvas-insert-dock')??[]])if(element)resize.observe(element);
  const footer=editor?.querySelector('.stage-footer');
  const content=new MutationObserver(()=>{const dock=editor?.querySelector('.canvas-insert-dock');if(dock)resize.observe(dock);schedule();});
  if(footer)content.observe(footer,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  apply();
  return {destroy(){cancelAnimationFrame(frame);resize.disconnect();content.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);}};
}
