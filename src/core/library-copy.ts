import copy from '../../public/resources/library-copy.en.json';

// Translate display metadata without rewriting the source manifest or artwork.
export function libraryAssetCopy<T extends {id: string; title: string; theme: string; alt: string; suggestedUsage: string; keywords: string[]}>(asset: T): T {
  const display = copy.assets[asset.id as keyof typeof copy.assets];
  return {...asset, ...display, theme: copy.themes[asset.theme as keyof typeof copy.themes] ?? asset.theme,
    keywords: [...asset.keywords, asset.title, asset.theme, asset.suggestedUsage]};
}

export function characterDisplayLabel(id: string, fallback: string) {
  return copy.characters[id as keyof typeof copy.characters] ?? fallback;
}

export function sceneDisplayLabel(id: string, fallback: string) {
  return copy.scenes[id as keyof typeof copy.scenes] ?? fallback;
}
