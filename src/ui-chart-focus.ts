import {availableFocus,restoreFocus,type FocusElement} from './ui-focus';
let release:(()=>void)|undefined;
/** Follow a logical SVG label through preview and save redraws; never take a new focus choice. */
export function focusAfterChartRedraw(target?:FocusElement|null,fallback?:FocusElement|null){
  release?.();
  if(!availableFocus(target)){restoreFocus(fallback);return;}
  const scopeNode=target.closest('[data-focus-scope]'),scope=scopeNode?.getAttribute('data-focus-scope'),key=target.getAttribute('data-focus-key'),parent=scopeNode?.parentElement;
  target.focus({preventScroll:true});
  if(!scope||!key||!parent)return;
  let stopped=false;
  const selector=`[data-focus-scope="${CSS.escape(scope)}"] [data-focus-key="${CSS.escape(key)}"]`;
  const recover=()=>{if(stopped||document.activeElement!==document.body)return;const next=document.querySelector(selector);if(availableFocus(next)&&!document.querySelector('dialog:modal'))next.focus({preventScroll:true});};
  const changed=(event:FocusEvent)=>{if(!(event.target instanceof Element)||!event.target.matches(selector))cleanup();};
  const observer=new MutationObserver(recover);
  const timer=setTimeout(cleanup,1000);
  function cleanup(){if(stopped)return;stopped=true;observer.disconnect();clearTimeout(timer);document.removeEventListener('focusin',changed,true);if(release===cleanup)release=undefined;}
  release=cleanup;observer.observe(parent,{childList:true,subtree:true});document.addEventListener('focusin',changed,true);requestAnimationFrame(recover);
}
