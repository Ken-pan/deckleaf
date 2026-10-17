import {canEditText} from './shapes';
import catalog from './font-catalog.json';
import type { Deck, SlideElement, TextRun, OnlineFont } from './model';
import type { Operation } from './operations';

export type FontCategory = 'sans' | 'serif' | 'display' | 'mono' | 'handwriting';
export interface LibraryFont {
  id: string; family: string; category: string; tags: string; label?: string; chinese: boolean;
  weights: number[]; styles: string[]; css: string; license: string; source: string; version: string; online?: boolean;
  provider?: 'google' | 'fontsource'; licenseId?: OnlineFont['license'];
}
export type FontChoice = LibraryFont & {origin?: 'document' | 'system'};
export const FONT_LIBRARY: LibraryFont[] = catalog;
export const FONT_CATEGORIES: {id: FontCategory; label: string}[] = [
  {id: 'sans', label: 'Sans serif'}, {id: 'serif', label: 'Serif'}, {id: 'display', label: 'Display'},
  {id: 'mono', label: 'Monospace'}, {id: 'handwriting', label: 'Handwriting'},
];
export const fontDisplayName = (font: Pick<LibraryFont, 'family' | 'label'>) => font.label && !/[\u4e00-\u9fff]/.test(font.label) ? font.label : font.family;
export const WEIGHT_LABELS: Record<number, string> = {100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black'};
export const findFont = (family: string) => FONT_LIBRARY.find(f => f.family === family);
export function localFontChoices(deck: Deck | null | undefined, currentFamily = 'Manrope'): FontChoice[] {
  const documentFamilies = [...new Set([currentFamily, ...(deck?.fonts?.map(f => f.family) ?? [])])]
    .filter(f => !findFont(f) && !deck?.onlineFonts?.some(o => o.family === f));
  const systemFamilies = ['Arial', 'Georgia', 'Helvetica', 'PingFang SC', 'Songti SC'].filter(f => !documentFamilies.includes(f));
  const choice = (family: string, origin: 'document' | 'system'): FontChoice => ({
    id: `${origin}:${family}`, family, origin, category: /Georgia|Songti/.test(family) ? 'serif' : 'sans', chinese: /PingFang|Songti/.test(family),
    tags: origin === 'document' ? 'Document fonts' : 'System fonts', weights: fontWeights(family, deck?.fonts, deck?.onlineFonts),
    styles: ['normal', 'italic'], css: '', license: '', source: '', version: ''
  });
  return [...documentFamilies.map(f => choice(f, 'document')), ...FONT_LIBRARY, ...systemFamilies.map(f => choice(f, 'system'))];
}
export {fontStack} from './font-stack';
export {textStylePatch} from './text-style';
export function searchFonts(query: string, category = 'all', language = 'all', favorites?: string[], fonts = FONT_LIBRARY) {
  const categoryAliases: Record<string, string> = {'无衬线': 'sans', '衬线': 'serif', '标题': 'display', '等宽': 'mono', '手写': 'handwriting'};
  const terms = (categoryAliases[query.trim()] ?? query).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const queryCategory = FONT_CATEGORIES.find(c => c.label.toLocaleLowerCase() === terms.join(' ') || c.id === terms.join(' '))?.id;
  const matches = fonts.filter(f => (category === 'all' || f.category === category)
    && (!queryCategory || f.category === queryCategory)
    && (language !== 'chinese' || f.chinese)
    && (!favorites || favorites.includes(f.family))
    && terms.every(term => `${f.family} ${f.label ?? ''} ${f.tags} ${f.category} ${FONT_CATEGORIES.find(c => c.id === f.category)?.label}`.toLocaleLowerCase().includes(term)));
  if (!terms.length) return matches;
  const nameRank = (font: LibraryFont) => {
    const names = [font.family, font.label ?? '', catalog.find(item => item.family === font.family)?.label ?? ''].map(name => name.toLocaleLowerCase());
    const phrase = terms.join(' ');
    return names.includes(phrase) ? 3 : names.some(name => name.startsWith(phrase)) ? 2
      : terms.every(term => names.some(name => name.includes(term))) ? 1 : 0;
  };
  return matches.sort((a, b) => nameRank(b) - nameRank(a));
}
export function fontWeights(family: string, imported: Deck['fonts'] = [], online: Deck['onlineFonts'] = []) {
  const custom = imported?.filter(f => f.family === family) ?? [];
  if (custom.length) {
    const result = new Set<number>();
    for (const f of custom) {
      const [min, max = min] = f.weight.split(' ').map(Number);
      for (let w = 100; w <= 900; w += 100) if (w >= min && w <= max) result.add(w);
      result.add(min); result.add(max);
    }
    return [...result].sort((a, b) => a - b);
  }
  return findFont(family)?.weights ?? online?.find(f => f.family === family)?.weights ?? [100,200,300,400,500,600,700,800,900];
}
export function nearestWeight(weights: number[], requested: number) {
  return weights.reduce((best, w) => Math.abs(w - requested) < Math.abs(best - requested) ? w : best, weights[0] ?? 400);
}
// Keep each object's content and rich styling; replace only the family override.
export function fontOperations(deck: Deck, slideId: string, ids: string[], family: string): Operation[] {
  const slide = deck.slides.find(s => s.id === slideId);
  const weights = fontWeights(family, deck.fonts, deck.onlineFonts);
  const changeRun = (run: TextRun): TextRun => ({...run, fontFamily: family,
    ...(run.fontWeight !== undefined ? {fontWeight: nearestWeight(weights, run.fontWeight)} : {})});
  return (slide?.elements ?? []).filter(e => ids.includes(e.id) && canEditText(e) && !e.locked).map(e => ({
    op: 'update_element', slideId, elementId: e.id,
    patch: {fontFamily: family, fontWeight: nearestWeight(fontWeights(family, deck.fonts, deck.onlineFonts), e.fontWeight),
      ...(e.runs ? {runs: e.runs.map(changeRun)} : {}),
      ...(e.paragraphs ? {paragraphs: e.paragraphs.map(p => ({...p, runs: p.runs.map(changeRun), ...(p.endStyle ? {endStyle:changeRun(p.endStyle)} : {})}))} : {})},
  }));
}
export function usedLibraryFonts(deck: Deck) {
  const families = new Set<string>();
  for (const s of deck.slides) for (const e of s.elements) {
    families.add(e.fontFamily);
    for (const r of [...(e.runs ?? []), ...(e.paragraphs?.flatMap(p => [...p.runs,...(p.endStyle?[p.endStyle]:[])]) ?? [])]) if (r.fontFamily) families.add(r.fontFamily);
    for (const p of e.paragraphs ?? []) for (const r of p.runs) if (r.fontFamily) families.add(r.fontFamily);
  }
  // Imported files take precedence over a bundled family of the same name.
  if(deck.slides.some(s=>s.elements.some(e=>/[\u3400-\u9fff]/.test(e.text+(e.cells?.flat().join('')??'')+(e.chart?JSON.stringify(e.chart):''))))){families.add('Noto Sans SC');if([...families].some(f=>FONT_LIBRARY.find(font=>font.family===f)?.category==='serif'))families.add('Noto Serif SC');}
  const imported = new Set(deck.fonts?.map(f => f.family));
  return FONT_LIBRARY.filter(f => families.has(f.family) && !imported.has(f.family));
}
export async function embeddedLibraryFonts(deck: Deck) {
  return Promise.all(usedLibraryFonts(deck).map(async font => {
    const response = await fetch(font.css);
    if (!response.ok) throw new Error(`Cannot export font: ${font.family}`);
    let css = await response.text();
    const urls = [...new Set([...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m => m[1]))];
    const embedded = await Promise.all(urls.map(async url => {
      const r = await fetch(url); if (!r.ok) throw new Error(`Cannot export font file: ${font.family}`);
      const bytes = new Uint8Array(await r.arrayBuffer()); let str = '';
      for (let i = 0; i < bytes.length; i += 32768) str += String.fromCharCode(...bytes.slice(i, i + 32768));
      return {url, data: `data:font/${url.endsWith('.ttf') ? 'ttf' : 'woff2'};base64,${btoa(str)}`};
    }));
    for (const {url, data} of embedded) css = css.replaceAll(url, data);
    const licenseResponse = await fetch(font.license);
    if (!licenseResponse.ok) throw new Error(`Cannot export font license: ${font.family}`);
    const license = (await licenseResponse.text()).replaceAll('*/', '* /').replace(/[<>]/g, '');
    return `/* ${font.family} · SIL OFL 1.1\n${license}\n*/\n${css}`;
  }));
}
