import type {SlideElement} from './model';
/** A generated sizing frame never competes with the block's editable artwork. */
export function isBlockSizingFrame(e:SlideElement):boolean {
  return e.type==='rect'&&e.name==='Block frame'&&e.fill==='transparent'&&(e.stroke==='transparent'||!e.strokeWidth)&&!(e.text||e.shadow||e.prototype||e.animation);
}
