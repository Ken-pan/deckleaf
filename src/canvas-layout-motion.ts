import {tick} from 'svelte';
import {reducedUI,uiLayoutGeometry} from './ui-motion';

const selector='.slide-element[data-element-id], [data-chrome-id], [data-container-chrome], .multi-selection-outline';
const pending=new WeakMap<HTMLElement,{cancelled:boolean;animations:Animation[]}>();
const geometry=(node:HTMLElement):Keyframe=>{
  const style=getComputedStyle(node);
  return {left:style.left,top:style.top,width:style.width,height:style.height};
};

export function cancelCanvasLayoutMotion(host:HTMLElement) {
  const state=pending.get(host);if(!state)return;
  state.cancelled=true;for(const animation of state.animations)animation.cancel();pending.delete(host);
}

/** Capture the visible drag before committing, then settle only the changed boxes. */
export function captureCanvasLayout(host:HTMLElement) {
  cancelCanvasLayoutMotion(host);
  if(reducedUI())return ()=>{};
  const before=new Map([...host.querySelectorAll<HTMLElement>(selector)].map(node=>[node,geometry(node)]));
  const state={cancelled:false,animations:[] as Animation[]};pending.set(host,state);
  return async()=>{
    await tick();
    if(state.cancelled||!host.isConnected||reducedUI())return;
    for(const [node,from] of before){
      if(!node.isConnected)continue;
      const to=geometry(node);if(Object.keys(from).every(key=>from[key]===to[key]))continue;
      const animation=uiLayoutGeometry(node,from,to);if(animation)state.animations.push(animation);
    }
    await Promise.allSettled(state.animations.map(animation=>animation.finished));
    if(pending.get(host)===state)pending.delete(host);
  };
}
