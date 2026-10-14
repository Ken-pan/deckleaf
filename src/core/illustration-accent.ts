import {isThemedIllustration} from './resource-purpose';
import type {GraphicRecipe} from './graphic-recipe';
import type { Deck, SlideElement } from './model';
import type { Operation } from './operations';
import type { EmbeddedResource } from './resources';
import { normalizeAccent } from '../../public/resources/accent-engine.js';
export type AccentScope = 'selection' | 'slide' | 'deck';
export function illustrationTargets(deck: Deck, slideId: string, selected: string[], scope: AccentScope) {
  return deck.slides.flatMap(slide => scope !== 'deck' && slide.id !== slideId ? [] : slide.elements.filter(e =>
    e.type === 'image' && isThemedIllustration(e.resource) && (scope !== 'selection' || selected.includes(e.id))).map(element => ({slideId: slide.id, element})));
}
export async function illustrationAccentOperations(deck: Deck, slideId: string, selected: string[], scope: AccentScope, value: string,
  load: (id: string, color: string, recipe?:GraphicRecipe) => Promise<EmbeddedResource>): Promise<Operation[]> {
  const color = normalizeAccent(value);
  const targets = illustrationTargets(deck, slideId, selected, scope).filter(t => !t.element.locked && (t.element.design?.fill==='accent'?t.element.fill:t.element.resource?.color)?.toLowerCase() !== color);
  if (targets.length + (scope === 'deck' ? 1 : 0) > 1000) throw new Error('Adjust up to 999 illustrations at a time. Work on one slide at a time.');
  const images = new Map<string, EmbeddedResource>();
  const key=(e:SlideElement)=>JSON.stringify([e.resource?.id,e.resource?.graphicRecipe??null]);
  for (const t of targets)if(!images.has(key(t.element)))images.set(key(t.element),await load(t.element.resource!.id,color,t.element.resource!.graphicRecipe));
  const operations: Operation[] = targets.map(t => {
    const data = images.get(key(t.element))!;
    if (data.resource.id !== t.element.resource!.id || (t.element.resource!.originalSha256 && data.resource.originalSha256 !== t.element.resource!.originalSha256)) throw new Error('The illustration source has changed. Select the resource again.');
    if(data.resource.color?.toLowerCase()!==color||(t.element.resource!.graphicRecipe&&JSON.stringify(data.resource.graphicRecipe)!==JSON.stringify(t.element.resource!.graphicRecipe)))throw new Error('The illustration settings could not be preserved. Try again.');
    const patch: Partial<SlideElement> = {src: data.src, resource: {...t.element.resource!, color},...(t.element.design?.fill==='accent'?{fill:color}: {})};
    return {op: 'update_element', slideId: t.slideId, elementId: t.element.id, patch};
  });
  if (scope === 'deck' && deck.illustrationAccent !== color) operations.push({op: 'set_illustration_accent', color});
  return operations;
}
