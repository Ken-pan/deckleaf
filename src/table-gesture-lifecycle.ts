/** Cancel table previews when the pointer interaction is interrupted. */
export function tableGestureLifecycle(pointer:()=>number|undefined,cancel:()=>void){
  const interrupted=()=>{if(pointer()!==undefined)cancel();};
  const visibility=()=>{if(document.hidden)interrupted();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&pointer()!==undefined){event.preventDefault();event.stopImmediatePropagation();cancel();}};
  const additional=(event:PointerEvent)=>{const held=pointer();if(held!==undefined&&event.pointerId!==held)cancel();};
  window.visualViewport?.addEventListener('resize',interrupted);window.addEventListener('blur',interrupted);window.addEventListener('resize',interrupted);window.addEventListener('keydown',key,true);document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerdown',additional,true);
  return()=>{window.visualViewport?.removeEventListener('resize',interrupted);window.removeEventListener('blur',interrupted);window.removeEventListener('resize',interrupted);window.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',additional,true);};
}
