import {activeModal,restoreFocus,tabStops} from './ui-focus';

// Loaded with modal surfaces. Native isolation owns focus; only wrap Tab edges.
export function modalFocus(node: HTMLDialogElement, returnTo?:()=>HTMLElement|undefined) {
  const origin=document.activeElement as HTMLElement|null;
  const release=(event:Event)=>{if(event.target===node&&node.open){node.close();restoreFocus(returnTo?.(),origin);}};
  const key=(event:KeyboardEvent)=>{
    if(event.key!=='Tab'||event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||!node.open||activeModal()!==node||document.activeElement?.closest('[popover]:popover-open:not([role="tooltip"])'))return;
    const controls=tabStops(node),active=document.activeElement,index=controls.indexOf(active as HTMLElement);
    if(!controls.length){event.preventDefault();return;}
    if(event.shiftKey?index<=0:index===controls.length-1||!node.contains(active)){
      event.preventDefault();controls[event.shiftKey?controls.length-1:0].focus();
    }
  };
  node.addEventListener('keydown',key,true);node.addEventListener('outrostart',release);
  return {update(next:typeof returnTo){returnTo=next;},destroy(){node.removeEventListener('keydown',key,true);node.removeEventListener('outrostart',release);}};
}
