import {fontStack} from './font-stack';
import type { Deck, Slide } from './model';

const stylesheets = new Map<string, Promise<void>>();

export async function loadLibraryFont(family: string, imported: Deck['fonts'] = []): Promise<void> {
  if (imported?.some(font => font.family === family)) return Promise.resolve();
  if(typeof document==='undefined')return;
  const {findFont}=await import('./fonts');
  const font=findFont(family);
  if(!font)return;
  let request = stylesheets.get(font.css);
  if (!request) {
    request = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = font.css;
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove(); stylesheets.delete(font.css);
        reject(new Error(`Cannot load font: ${family}`));
      };
      document.head.append(link);
    });
    stylesheets.set(font.css, request);
  }
  return request;
}

// Read typography only: selecting or moving an image must not copy its bytes.
export function slideFontFamilies(slide: Slide): string[] {
  const families = new Set<string>();
  for (const element of slide.elements) {
    if (element.hidden || !['text', 'table', 'chart'].includes(element.type)) continue;
    families.add(element.fontFamily);
    for (const run of element.paragraphs?.flatMap(p => [...p.runs,...(p.endStyle?[p.endStyle]:[])]) ?? element.runs ?? []) {
      if (run.fontFamily) families.add(run.fontFamily);
    }
  }
  return [...families];
}

// Measurement needs the actual glyphs, including pages not yet rendered.
export async function loadLibraryTypography(slides: Slide[], imported: Deck['fonts'] = []) {
  if(typeof document==='undefined')return;
  const {findFont}=await import('./fonts');
  const uses = new Map<string, {family: string; weight: number; italic: boolean; sample: string}>();
  for (const slide of slides) for (const element of slide.elements) {
    if (element.hidden || !['text', 'table', 'chart'].includes(element.type)) continue;
    const runs = element.paragraphs?.flatMap(p => [...p.runs,...(p.endStyle?[p.endStyle]:[])]) ?? element.runs;
    const samples = element.type === 'text' && runs?.length ? runs : [{text: element.type === 'table'
      ? element.cells?.flat().join(' ') || '' : element.type === 'chart'
        ? element.chart ? JSON.stringify(element.chart) : element.values?.map(v => `${v.label} ${v.value}`).join(' ') || '' : element.text}];
    for (const run of samples) {
      const family = run.fontFamily || element.fontFamily;
      if (!findFont(family) || imported?.some(font => font.family === family)) continue;
      const weight = run.fontWeight ?? (run.bold === true ? 700 : run.bold === false ? 400 : element.fontWeight);
      const italic = run.italic ?? element.italic, key = `${family}:${weight}:${italic}`;
      const use = uses.get(key) ?? {family, weight, italic, sample: ''};
      use.sample += run.text; uses.set(key, use);
      if(/[\u3400-\u9fff]/.test(run.text)&&!findFont(family)?.chinese){const fallback=findFont(family)?.category==='serif'?'Noto Serif SC':'Noto Sans SC',key=`${fallback}:${weight}:${italic}`;const other=uses.get(key)??{family:fallback,weight,italic,sample:''};other.sample+=run.text;uses.set(key,other);}
    }
  }
  await Promise.all([...uses.values()].map(async use => {
    await loadLibraryFont(use.family);
    await document.fonts.load(`${use.italic ? 'italic ' : ''}${use.weight} 32px ${fontStack(use.family)}`, use.sample || 'Aa');
  }));
}
