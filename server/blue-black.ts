import { libraryAssetCopy } from '../src/core/library-copy';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { recolorAccentPixels, ORIGINAL_ACCENT, normalizeAccent } from '../public/resources/accent-engine.js';
import { attributionText, type ResourceItem } from '../src/core/resources';

export type BlueBlackAsset = {id: string; file: string; title: string; type: string; theme: string; keywords: string[]; alt: string; suggestedUsage: string; width: number; height: number; sha256: string};
export async function blueBlackLibrary(): Promise<BlueBlackAsset[]> {
  const manifest = JSON.parse(await readFile(resolve('public/resources/blue-black-v1/manifest.json'), 'utf8'));
  return manifest.assets.map(libraryAssetCopy);
}
export function blueBlackItem(asset: BlueBlackAsset): ResourceItem {
  const resource = {id: `blue-black:${asset.id}`, kind: 'illustration' as const, provider: 'Duoquill', title: asset.title,
    creator: 'Decksprig · AI-generated', sourceUrl: 'https://duoquill.kens-toolbox.com/',
    license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false, attribution: '', licenseNotice: `Project-generated AI artwork dedicated by Ken Pan under CC0 1.0, to the extent he holds rights. Original SHA-256: ${asset.sha256}`,
    originalSha256: asset.sha256, color: ORIGINAL_ACCENT};
  return {...resource, attribution: attributionText(resource), colorable: true, collection: 'blue-black', illustrationType: asset.type === 'scene' ? 'scene' : 'spot', category: asset.type === 'character' ? 'people' : 'work', tags: [...asset.keywords, asset.theme, asset.suggestedUsage],
    previewUrl: `/api/resources/preview?id=${encodeURIComponent(resource.id)}`, width: asset.width, height: asset.height};
}
export async function blueBlackImage(id: string, color: string, preview: boolean) {
  const asset = (await blueBlackLibrary()).find(a => `blue-black:${a.id}` === id);
  if (!asset || !/^png\/[\w-]+\.png$/.test(asset.file)) throw new Error('This illustration does not exist.');
  const original = await readFile(resolve('public/resources/blue-black-v1', asset.file));
  const accent = normalizeAccent(color);
  if (accent === ORIGINAL_ACCENT && !preview) return {item: blueBlackItem(asset), bytes: original};
  const png = PNG.sync.read(original);
  recolorAccentPixels(png.data, accent);
  if (!preview) return {item: blueBlackItem(asset), bytes: PNG.sync.write(png)};
  const scale = Math.min(1, 480 / Math.max(png.width, png.height));
  const thumb = new PNG({width: Math.round(png.width * scale), height: Math.round(png.height * scale)});
  for (let y = 0; y < thumb.height; y++) for (let x = 0; x < thumb.width; x++) {
    const source = (Math.min(png.height - 1, Math.floor(y / scale)) * png.width + Math.min(png.width - 1, Math.floor(x / scale))) * 4;
    png.data.copy(thumb.data, (y * thumb.width + x) * 4, source, source + 4);
  }
  return {item: blueBlackItem(asset), bytes: PNG.sync.write(thumb)};
}
