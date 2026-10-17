import type {SlideElement} from './model';
import {textDraftPatch} from './text-range-format';
import {lineLabelElement} from './line-label';

// Shared by the canvas and standalone HTML player; keep this factory portable.
export function createShapeTextRendering(lineLabel?: (e:SlideElement)=>SlideElement) {
  function isTextShape(e?: Pick<SlideElement, 'type' | 'designPattern' | 'sourceRegion'>): boolean {
    return Boolean(e && ['rect', 'ellipse', 'diamond', 'line'].includes(e.type) && !e.designPattern && !e.sourceRegion);
  }
  function shapeTextElement(e: SlideElement): SlideElement {
    if(e.type==='line'&&lineLabel)return lineLabel(e);
    // Automatic contrast follows the shape fill until an explicit text color is chosen.
    const raw = e.fill.replace('#', '');
    const hex = raw.length === 3 || raw.length === 4 ? raw.slice(0, 3).split('').map(v => v + v).join('') : raw.slice(0, 6);
    const rgb = /^[a-f0-9]{6}$/i.test(hex) ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) : [1, 1, 1];
    const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    const insetX = Math.min(16, e.w * .1), insetY = Math.min(12, e.h * .1);
    return {...e, type: 'text', fill: e.shapeText?.color ?? (luminance > .179 ? '#171c19' : '#ffffff'),
      align: e.shapeText?.align ?? 'center', verticalAlign: e.shapeText?.verticalAlign ?? 'middle',
      padding: e.padding ?? {left: insetX, right: insetX, top: insetY, bottom: insetY},
      textSizing: 'fixed', clipText: true, design: undefined, nativeTextLayout: undefined};
  }
  return {isTextShape, shapeTextElement};
}
export const {isTextShape, shapeTextElement} = createShapeTextRendering(lineLabelElement);
export {canEditText} from './shapes';

// Store label styling independently of the shape's fill and geometry.
export function shapeTextPatch(base: SlideElement, text: SlideElement): Partial<SlideElement> {
  // Contenteditable keeps a trailing <br> when emptied. A blank line label
  // should disappear instead of leaving an empty background on the connector.
  if(base.type==='line'&&!text.text.trim())text={...text,text:'',runs:undefined,paragraphs:undefined};
  const {fill, align, ...patch} = textDraftPatch(text);
  const before = shapeTextElement(base);
  return {...patch, lineHeight: text.lineHeight, letterSpacing: text.letterSpacing, shapeText: {...base.shapeText,
    ...(fill !== before.fill ? {color: fill} : {}),
    ...(align !== before.align ? {align} : {}),
    ...(text.verticalAlign !== before.verticalAlign ? {verticalAlign: text.verticalAlign} : {}),
  }};
}
