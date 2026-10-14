import type {Deck, Slide, SlideElement} from './model';
import {browserTextSize, type TextSizeMeasure} from './text-layout';

/** Measure the complete authored text before the fixed page band clips it. */
export function pageElementFitIssues(deck: Deck, slide: Slide, measure: TextSizeMeasure = browserTextSize) {
  return slide.elements.filter(e => e.pageElement && e.type === 'text' && !e.hidden).flatMap(e => {
    const probe: SlideElement = {...e, textSizing: 'auto-width', maxLines: undefined};
    const size = measure(probe, deck);
    return size && (size.w > e.w + .5 || size.h > e.h + .5) ? [{slideId: slide.id, kind: e.pageElement!.kind}] : [];
  });
}
