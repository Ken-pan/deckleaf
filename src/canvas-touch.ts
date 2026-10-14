import type {TouchOptions} from './canvas-touch-controller';
let loading:Promise<typeof import('./canvas-touch-controller')>|undefined;
const preload=()=>loading??=import('./canvas-touch-controller');
if(matchMedia('(any-pointer:coarse)').matches)void preload();

export function canvasTouch(node:HTMLElement, options:TouchOptions){
  let active:ReturnType<typeof import('./canvas-touch-controller').canvasTouch>|undefined,disposed=false;
  const ready=()=>preload().then(module=>{if(disposed||active)return;active=module.canvasTouch(node,options);node.removeEventListener('pointerdown',pending,true);});
  function pending(event:PointerEvent){
    if(event.pointerType!=='touch'||(event.target as Element)?.closest('button:not(.resize-handle),a,input,textarea,select,[contenteditable="true"],.selection-context,.prototype-shell,[popover]'))return;
    event.preventDefault();event.stopImmediatePropagation();void ready();
  }
  node.addEventListener('pointerdown',pending,true);
  if(matchMedia('(any-pointer:coarse)').matches)void ready();
  return{update(next:TouchOptions){options=next;active?.update(next);},destroy(){disposed=true;active?.destroy();node.removeEventListener('pointerdown',pending,true);}};
}
