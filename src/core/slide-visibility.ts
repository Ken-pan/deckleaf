import type { Deck, Slide } from './model';
import type {Operation} from './operations';

type Visibility = Pick<Slide, 'hidden'>;

/** A mixed selection is set to one explicit state in one transaction. */
export function slideVisibilityOperations(deck: Deck, ids: readonly string[], hidden: boolean): Operation[] {
  const selected = new Set(ids);
  const existing = new Set(deck.slides.map(slide => slide.id));
  if (ids.some(id => !existing.has(id))) throw new Error('A selected slide no longer exists.');
  return deck.slides.flatMap(slide => selected.has(slide.id) && Boolean(slide.hidden) !== hidden
    ? [{op: 'update_slide' as const, slideId: slide.id, patch: {hidden}}] : []);
}

/** Original indices remain stable for page numbers and explicit jumps to backup slides. */
export function visibleSlideIndices(slides: readonly Visibility[]): number[] {
  return slides.flatMap((slide, index) => slide.hidden ? [] : [index]);
}

export function adjacentVisibleSlide(slides: readonly Visibility[], index: number, direction: number): number | null {
  const step = direction > 0 ? 1 : -1;
  for (let next = index + step; next >= 0 && next < slides.length; next += step) {
    if (!slides[next].hidden) return next;
  }
  return null;
}

/** Starting from a hidden slide uses the next visible slide, then the previous one. */
export function presentationStartIndex(slides: readonly Visibility[], requested = 0): number | null {
  if (!slides.length) return null;
  const index = Math.max(0, Math.min(slides.length - 1, requested));
  return !slides[index].hidden ? index : adjacentVisibleSlide(slides, index, 1) ?? adjacentVisibleSlide(slides, index, -1);
}

/** Audience deliveries omit hidden pages without changing the stored document. */
export function visibleDeliveryDeck(deck: Deck): Deck {
  const slides = deck.slides.filter(slide => !slide.hidden);
  if (!slides.length) throw new Error('Unhide a slide before exporting PDF or a web page.');
  return {...deck, slides};
}
