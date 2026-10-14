import type {Deck, SlideElement} from './model';
import {isRegionFill} from './resource-purpose';

const decoded = new Map<string, string>(), rendered = new Map<string, string>();
function keep(cache: Map<string, string>, key: string, value: string, limit: number) {
  cache.set(key, value); if (cache.size > limit) cache.delete(cache.keys().next().value!); return value;
}
function svgText(src: string): string | undefined {
  if (!src.startsWith('data:image/svg+xml')) return;
  const cached = decoded.get(src); if (cached) return cached;
  const comma = src.indexOf(','); if (comma < 0) return;
  try {
    const text = /;base64/i.test(src.slice(0, comma)) ? new TextDecoder().decode(Uint8Array.from(atob(src.slice(comma + 1)), c => c.charCodeAt(0))) : decodeURIComponent(src.slice(comma + 1));
    return keep(decoded, src, text, 16);
  } catch { return; }
}

/** Render a derivative; the saved source, recipe and attribution stay intact. */
export function regionFillSource(e: Pick<SlideElement, 'src' | 'w' | 'h' | 'resource' | 'fit' | 'crop' | 'sourceRegion'>): string | undefined {
  if (!isRegionFill(e) || !e.src) return e.src;
  const w = Math.round(Math.max(1, Math.min(20000, e.w)) * 1000) / 1000, h = Math.round(Math.max(1, Math.min(20000, e.h)) * 1000) / 1000;
  const key = `${w}:${h}:${e.src}`, cached = rendered.get(key); if (cached) return cached;
  const svg = svgText(e.src); if (!svg) return e.src;
  const root = svg.match(/<svg\b([^>]*)>/i), viewBox = root?.[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!root || !viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) return e.src;
  let repeating = false;
  // Only the outer coverage rectangle changes. Repeats retain their native units,
  // angle, density and opacity even in a tall or wide region.
  let result = svg.replace(/<rect\b([^>]*)>/gi, (tag, attrs: string) => {
    const rw = attrs.match(/\bwidth=["']([^"']+)["']/)?.[1], rh = attrs.match(/\bheight=["']([^"']+)["']/)?.[1];
    if (!/<pattern\b/i.test(svg) || !/\bfill=["']url\(/.test(attrs) || !(Number(rw) === viewBox[2] && Number(rh) === viewBox[3] || rw === '100%' && rh === '100%')) return tag;
    repeating = true;
    return `<rect${attrs.replace(/\bwidth=["'][^"']+["']/, 'width="100%"').replace(/\bheight=["'][^"']+["']/, 'height="100%"')}>`;
  });
  let attrs = root[1].replace(/\s+(?:width|height|viewBox|preserveAspectRatio)\s*=\s*["'][^"']*["']/gi, '');
  // Fixed textures/compositions cover the region without distorting their marks.
  const box = repeating ? `0 0 ${w} ${h}` : viewBox.join(' ');
  attrs += ` width="${w}" height="${h}" viewBox="${box}" preserveAspectRatio="${repeating ? 'none' : 'xMidYMid slice'}"`;
  result = result.replace(/<svg\b[^>]*>/i, `<svg${attrs}>`);
  return keep(rendered, key, `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(result), byte => String.fromCharCode(byte)).join(''))}`, 48);
}

export function prepareRegionFills(deck: Deck): Deck {
  if (!deck.slides.some(s => s.elements.some(isRegionFill))) return deck;
  return {...deck, slides: deck.slides.map(s => ({...s, elements: s.elements.map(e => isRegionFill(e) ? {...e, src: regionFillSource(e)} : e)}))};
}
