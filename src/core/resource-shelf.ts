import { resourceMetadata, unsplashImageUrl, type ResourceItem } from './resources';
import type { ResourceAttribution } from './model';
import {CharacterRecipeSchema} from './characters';
import {GraphicRecipeSchema} from './graphic-recipe';
export type ShelfEntry = {resource: ResourceAttribution; width?: number; height?: number; colorable: boolean; usedAt?: number; remotePreview?: string};
export const shelfKey = (item: ResourceAttribution) => `${item.id}:${item.characterRecipe?JSON.stringify(CharacterRecipeSchema.parse(item.characterRecipe)):item.id.startsWith('deck-graphics:')?`${(item.color||'#26362c').toLowerCase()}:${JSON.stringify(GraphicRecipeSchema.parse(item.graphicRecipe||{}))}`:item.color || ''}`;
export function shelfEntry(item: ResourceItem, color?: string): ShelfEntry {
  const resource = resourceMetadata({...item, ...(color && item.colorable ? {color} : {})});
  return {resource, width: item.width, height: item.height, colorable: Boolean(item.colorable), ...(item.id.startsWith('unsplash:') && unsplashImageUrl(item.previewUrl) ? {remotePreview: item.previewUrl} : {})};
}
export function shelfItem(entry: ShelfEntry): ResourceItem {
  return {...entry.resource, width: entry.width, height: entry.height, colorable: entry.colorable, previewUrl: entry.resource.id.startsWith('unsplash:') && entry.remotePreview && unsplashImageUrl(entry.remotePreview) ? entry.remotePreview : entry.resource.characterRecipe && !entry.resource.id.startsWith('character-saved:') ? `/api/characters/preview?recipe=${encodeURIComponent(JSON.stringify(entry.resource.characterRecipe))}` : `/api/resources/preview?id=${encodeURIComponent(entry.resource.id)}`};
}
export function readShelf(raw: string | null, max = 200): ShelfEntry[] {
  try {
    const data = JSON.parse(raw || '[]'); if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.slice(0, max).flatMap((entry: any) => {
      try {
        const resource = resourceMetadata(entry.resource), key = shelfKey(resource);
        if (!/^(iconify:[a-z-]+:[\w-]+|character:[\w-]+|character-saved:[\da-f-]{36}|blue-black:[\w-]+|deck-graphics:[\w-]+|doodles:[\w-]+|illlustrations:[\w-]+|openverse:[\da-f-]{36}|unsplash:[\w-]{6,100}|pexels:[1-9]\d{0,15})$/.test(resource.id) || seen.has(key)) return [];
        seen.add(key);
        return [{resource, width: Number.isFinite(entry.width) && entry.width > 0 ? entry.width : undefined, height: Number.isFinite(entry.height) && entry.height > 0 ? entry.height : undefined, colorable: resource.kind === 'icon' || /^(doodles|blue-black|deck-graphics):/.test(resource.id), usedAt: Number.isFinite(entry.usedAt) ? entry.usedAt : undefined, remotePreview: resource.id.startsWith('unsplash:') && typeof entry.remotePreview === 'string' && entry.remotePreview.length < 3000 && unsplashImageUrl(entry.remotePreview) ? entry.remotePreview : undefined}];
      } catch { return []; }
    });
  } catch { return []; }
}
export function rememberResource(list: ShelfEntry[], item: ResourceItem, color?: string, at = Date.now()): ShelfEntry[] {
  const entry = {...shelfEntry(item, color), usedAt: at};
  return [entry, ...list.filter(old => shelfKey(old.resource) !== shelfKey(entry.resource))].slice(0, 40);
}
