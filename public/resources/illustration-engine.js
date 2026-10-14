import {normalizeAccent} from './accent-engine.js';

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const numbers = value => (value || '').trim().split(/[\s,]+/).map(Number);

/** The ticket source includes vector artwork and unavailable external shadow PNGs. */
export function standaloneIllustrationSvg(source, id = '') {
  if (id !== 'illlustrations:day34-ticket') return source;
  return source.replace(/<image\b[^>]*(?:\/>|>[\s\S]*?<\/image>)/gi, tag => /\b(?:xlink:)?href=["'](?!data:|#)/i.test(tag) ? '' : tag);
}

/** Remove only source-library backplates, leaving masks, white details and geometry intact. */
export function transparentIllustrationSvg(source, id = '') {
  const root = source.match(/<svg\b[^>]*>/i)?.[0]; if (!root) return source;
  const box = attribute(root, 'viewBox') ? numbers(attribute(root, 'viewBox')) : [0, 0, Number(attribute(root, 'width')), Number(attribute(root, 'height'))];
  if (box.length !== 4 || !box.every(Number.isFinite)) return source;
  const stack = [];
  return source.replace(/<!--[\s\S]*?-->|<[^>]*>/g, tag => {
    const token = tag.match(/^<(\/)?([\w:-]+)/); if (!token) return tag;
    const name = token[2].toLowerCase();
    if (token[1]) {const entry = stack.pop(); return entry?.removed ? '' : tag;}
    const excluded = stack.some(entry => entry.excluded), parentRemoved = stack.some(entry => entry.removed);
    const fullRect = name === 'rect' && (attribute(tag, 'width') === '100%' || Math.abs(Number(attribute(tag, 'width')) - box[2]) <= 1) && (attribute(tag, 'height') === '100%' || Math.abs(Number(attribute(tag, 'height')) - box[3]) <= 1) && Math.abs(Number(attribute(tag, 'x') || 0) - box[0]) <= 1 && Math.abs(Number(attribute(tag, 'y') || 0) - box[1]) <= 1;
    // Measured source exports use split, rounded or inset backplates instead.
    const special = id === 'illlustrations:day100-the-snail' && ['XMLID_384_', 'XMLID_380_'].includes(attribute(tag, 'id')) || id === 'illlustrations:day73-writing-tool' && name === 'path' && attribute(tag, 'id') === 'XMLID_26_' || id === 'illlustrations:115-eiffel-tower' && name === 'path' && /^(M83\.4,0\.4h437|M199\.2,600\.4C94\.7)/.test(attribute(tag,'d')||'') || id === 'illlustrations:112-installing' && name === 'rect' && attribute(tag, 'width') === '1000' && attribute(tag, 'height') === '1000' && attribute(tag, 'x') === '0.5';
    const removed = parentRemoved || !excluded && (fullRect || special);
    if (!/\/\s*>$/.test(tag)) stack.push({name, removed, excluded: excluded || ['defs', 'mask', 'clippath', 'pattern', 'symbol'].includes(name)});
    return removed ? '' : tag;
  });
}

const rgb = hex => {const value=hex.slice(1), full=value.length===3||value.length===4?value.split('').map(c=>c+c).join(''):value;return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16));};
const light = color => .2126*color[0]+.7152*color[1]+.0722*color[2];
const chromatic = color => Math.max(...color)-Math.min(...color)>24;
const paintPattern = /\b(fill|stroke|stop-color|flood-color|color)(\s*=\s*["']|\s*:\s*)(#[\da-f]{3,8})(?=["';\s}])/gi;

/** Theme colored pigments with tonal shading; source black/white and opacity remain intact. */
export function themedIllustrationSvg(source, color, id = '') {
  const accent = normalizeAccent(color), transparent = transparentIllustrationSvg(source, id);
  const paints = new Map();
  for (const match of transparent.matchAll(paintPattern)) {const hex=match[3].toLowerCase();if([3,4,6,8].includes(hex.length-1))paints.set(hex,(paints.get(hex)||0)+1);}
  const colors = [...paints.keys()], pigments = colors.filter(hex=>chromatic(rgb(hex)));
  const candidates = pigments.length ? pigments : colors.filter(hex=>light(rgb(hex))>25&&light(rgb(hex))<225);
  const primary = candidates.sort((a,b)=>paints.get(b)-paints.get(a))[0]; if (!primary) return transparent;
  const base=light(rgb(primary)), ink=rgb(accent), recolor=new Set(candidates);
  return transparent.replace(paintPattern, (match, property, separator, hex) => {
    const value=hex.toLowerCase();if(!recolor.has(value))return match;
    const delta=light(rgb(value))-base, amount=delta>=0?delta/Math.max(1,255-base):-delta/Math.max(1,base), target=delta>=0?255:0;
    const mapped='#'+ink.map(channel=>Math.round(channel+(target-channel)*amount).toString(16).padStart(2,'0')).join('');
    const alpha=value.length===9?value.slice(7):value.length===5?value[4]+value[4]:'';
    return property+separator+mapped+alpha;
  });
}
