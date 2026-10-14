import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getIconData } from '@iconify/utils';
import { ICON_SETS, DOODLES, resourceMatches, type ResourceCatalog } from '../src/core/resources';
import { blueBlackLibrary } from './blue-black';
import {graphicLibrary} from './deck-graphics';
const require = createRequire(import.meta.url);
const libraries = new Map<string, {data: any; info: any; names: string[]}>();
export async function iconLibrary(prefix: string) {
  if (!ICON_SETS.some(s => s.id === prefix)) throw new Error('Unsupported icon collection.');
  const cached = libraries.get(prefix); if (cached) return cached;
  const [raw, info] = await Promise.all([readFile(require.resolve(`@iconify-json/${prefix}/icons.json`), 'utf8'), readFile(require.resolve(`@iconify-json/${prefix}/info.json`), 'utf8')]);
  const data = JSON.parse(raw), library = {data, info: JSON.parse(info), names: Object.keys(data.icons)};
  libraries.set(prefix, library); return library;
}
export async function localIcon(prefix: string, name: string) { const library = await iconLibrary(prefix); return getIconData(library.data, name); }
export function iconStyle(prefix: string, name: string) {
  if (/duotone/.test(name)) return 'duotone';
  if (/fill(ed)?$|solid$/.test(name) || (prefix === 'material-symbols' && !name.includes('outline'))) return 'solid';
  return 'outline';
}
export async function findIcons(prefix: string, query: string, style: string) {
  const sets = prefix === 'all' ? ICON_SETS : ICON_SETS.filter(s => s.id === prefix);
  if (!sets.length) throw new Error('Unsupported icon collection.');
  const groups = await Promise.all(sets.map(async set => {
    const library = await iconLibrary(set.id);
    const names = [...library.names, ...Object.keys(library.data.aliases || {})];
    return names.filter(name => resourceMatches(name, query) && (!style || style === 'all' || iconStyle(set.id, name) === style)).map(name => `${set.id}:${name}`);
  }));
  const results = groups.flat();
  const normalized = query.toLowerCase().replaceAll(' ', '-');
  results.sort((a, b) => {
    const an = a.split(':')[1], bn = b.split(':')[1];
    const rank = (name: string) => name === normalized ? 0 : name.startsWith(normalized) ? 1 : 2;
    return rank(an) - rank(bn) || an.length - bn.length || a.localeCompare(b);
  });
  return results;
}
export type IllustrationRecord = {id: string; file: string; title: string; sourceUrl: string; sha256: string};
let illustrations: Promise<IllustrationRecord[]> | undefined;
export function illustrationLibrary(): Promise<IllustrationRecord[]> { return illustrations ??= readFile(resolve('public/resources/illlustrations/manifest.json'), 'utf8').then(raw => JSON.parse(raw).items); }
export function illustrationCategory(text: string) {
  const value = text.toLowerCase().replace(/[_-]/g, ' ');
  if (/\b(dog|dogs|cat|cats|fish|whale|owl|farm|rainbow|plant|nature|flower|petting|pet|animal|snail)\b/.test(value)) return 'nature';
  if (/\b(gym|person|people|guy|girl|boy|dance|jump|jumping|run|running|sport|meditation|meditating|ballet|skating|loving|fitness)\b/.test(value)) return 'people';
  if (/\b(computer|pc|mac|macintosh|ipod|gaming|mouse|camera|printer|phone|robot|rocket|ram|gpu|experiment|lab|chip|desktop|hard disk|floppy|cassette|radio|walkie|tv|powerbook|watch)\b/.test(value)) return 'technology';
  if (/\b(design|designer|tool|work|working|freelancer|writing|notebook|stationary|office|reading|book|canvas|blackboard)\b/.test(value)) return 'work';
  return 'lifestyle';
}

export async function resourceCatalog(): Promise<ResourceCatalog> {
  const collections = await Promise.all(ICON_SETS.map(async set => { const library = await iconLibrary(set.id); return {...set, count: library.names.length, license: library.info.license.title}; }));
  const count = (await illustrationLibrary()).length;
  return {iconCount: collections.reduce((sum, c) => sum + c.count, 0), illustrationCount: DOODLES.length + count + (await blueBlackLibrary()).length + (await graphicLibrary()).length, collections};
}
