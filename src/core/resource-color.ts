import type {Deck, SlideElement} from './model';
import type {Operation} from './operations';
import type {EmbeddedResource} from './resources';
import {canRecolorResource} from './resource-purpose';
import {normalizeAccent} from '../../public/resources/accent-engine.js';

export function resourceColorTargets(deck: Deck, slideId: string, selected: string[]) {
  return deck.slides.find(s => s.id === slideId)?.elements.filter(e => selected.includes(e.id) && !e.locked && e.type === 'image' && canRecolorResource(e.resource) && !e.sourceRegion) ?? [];
}

/** Rebuild each source variant, then commit all selected objects in one transaction. */
export async function resourceColorOperations(deck: Deck, slideId: string, selected: string[], value: string,
  load: (resource: NonNullable<SlideElement['resource']>, color: string) => Promise<EmbeddedResource>): Promise<Operation[]> {
  const color = normalizeAccent(/^#[\da-f]{3}$/i.test(value) ? '#' + value.slice(1).split('').map(c => c + c).join('') : value), targets = resourceColorTargets(deck, slideId, selected).filter(e => (e.design?.fill === 'accent' ? e.fill : e.resource?.color)?.toLowerCase() !== color);
  const variants = new Map<string, EmbeddedResource>();
  const key = (e: SlideElement) => JSON.stringify([e.resource!.id, e.resource!.graphicRecipe ?? null]);
  for (const e of targets) {
    if (!variants.has(key(e))) variants.set(key(e), await load(e.resource!, color));
  }
  return targets.map(e => {
    const data = variants.get(key(e))!;
    if (data.resource.id !== e.resource!.id || data.resource.color?.toLowerCase() !== color || (e.resource!.originalSha256 && data.resource.originalSha256 !== e.resource!.originalSha256)) throw new Error('The resource source has changed. Select it again.');
    if (e.resource!.graphicRecipe && JSON.stringify(data.resource.graphicRecipe) !== JSON.stringify(e.resource!.graphicRecipe)) throw new Error('The graphic settings could not be preserved. Try again.');
    return {op: 'update_element', slideId, elementId: e.id, patch: {src: data.src, resource: {...e.resource!, color}, ...(e.design?.fill === 'accent' ? {fill: color} : {})}};
  });
}
