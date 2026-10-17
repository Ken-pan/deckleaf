import type {SlideElement} from './model';

/** Identify authored strokes without decoding unrelated or large imported media. */
export function isDrawingElement(element: SlideElement | undefined): boolean {
  if (!element || element.type !== 'image' || element.sourceId || element.sourceRegion || element.resource || element.crop || element.fit !== 'fill' || !element.src?.startsWith('data:image/svg+xml;base64,')) return false;
  try {
    const encoded = element.src.slice('data:image/svg+xml;base64,'.length);
    const head = atob(encoded.slice(0, Math.min(encoded.length, 256)));
    return /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" data-deck-drawing="1" /.test(head)
      || /^(Pen|Brush|Highlighter) drawing$/.test(element.name) && /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width=/.test(head);
  } catch {return false;}
}
