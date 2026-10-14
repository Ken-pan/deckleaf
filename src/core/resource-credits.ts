import type {Deck} from './model';

// The editor can show credits without loading resource catalogs and import tools.
export function usedResourceCredits(deck: Deck) {
  const seen = new Set<string>();
  return deck.slides.flatMap(s => s.elements.flatMap(e => {
    if (!e.resource || seen.has(e.resource.id)) return [];
    seen.add(e.resource.id);
    return [e.resource];
  }));
}
export function resourceCredits(deck: Deck) {
  return usedResourceCredits(deck).map(r => r.attribution + (r.licenseNotice ? `\n${r.licenseNotice}` : '')).join('\n\n');
}
