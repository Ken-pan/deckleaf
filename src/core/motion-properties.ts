import type {ElementAnimation, SlideElement} from './model';
import {defaultAnimation} from './motion';

/** Locked values are readable, but do not affect an editable selection's state. */
export function motionPropertyState<K extends keyof ElementAnimation>(selection:SlideElement[], key:K) {
  const editable=selection.filter(item=>!item.locked),items=editable.length?editable:selection;
  const values=items.map(item=>{
    const animation={...defaultAnimation,...item.animation};
    return (key==='withTransition'?Boolean(animation.withTransition):animation[key]) as ElementAnimation[K];
  });
  return {value:values[0]??defaultAnimation[key],mixed:values.some(value=>value!==values[0])};
}
