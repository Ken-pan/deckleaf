import type {SlideElement} from './model';
import {shapePath} from './shapes';

/** DrawingML paths remain editable and use the same cubic corners as the canvas. */
export function customShapeXml(e: SlideElement): string {
  const tokens = shapePath(e).match(/[MLCZ]|-?\d+(?:\.\d+)?/g)!;
  let i = 0, path = '';
  const point = () => `<a:pt x="${Math.round(Number(tokens[i++])*1000)}" y="${Math.round(Number(tokens[i++])*1000)}"/>`;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') path += `<a:moveTo>${point()}</a:moveTo>`;
    else if (command === 'L') path += `<a:lnTo>${point()}</a:lnTo>`;
    else if (command === 'C') path += `<a:cubicBezTo>${point()}${point()}${point()}</a:cubicBezTo>`;
    else if (command === 'Z') path += '<a:close/>';
  }
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="w" b="h"/><a:pathLst><a:path w="${Math.round(e.w*1000)}" h="${Math.round(e.h*1000)}">${path}</a:path></a:pathLst></a:custGeom>`;
}
export function shadowXml(e: SlideElement): string {
  const s = e.shadow;
  if (!s || !s.opacity) return '';
  const direction = (Math.atan2(s.y,s.x)*180/Math.PI+360)%360;
  return `<a:effectLst><a:outerShdw blurRad="${Math.round(s.blur*9525)}" dist="${Math.round(Math.hypot(s.x,s.y)*9525)}" dir="${Math.round(direction*60000)}" algn="ctr" rotWithShape="1"><a:srgbClr val="${s.color.slice(1).toUpperCase()}"><a:alpha val="${Math.round(s.opacity*100000)}"/></a:srgbClr></a:outerShdw></a:effectLst>`;
}
