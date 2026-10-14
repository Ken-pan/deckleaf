import type {SlideElement} from './model';
import {isGraphicBackground} from './resource-purpose';

export type ResourceReplacementOptions = {fit?: SlideElement['fit']};

export const resourceReplacementFit = (fit?: SlideElement['fit']) => fit === 'cover' ? 'cover' as const : 'contain' as const;

// Preview and commit share the content patch; the existing frame owns layout.
export function resourceReplacementPatch(image: Pick<SlideElement, 'src' | 'resource' | 'name'>, options: ResourceReplacementOptions = {}): Partial<SlideElement> {
  // Legacy edge crops stretch a new source independently on each axis.
  // Reset them with the source and normalize Stretch, while preserving the frame.
  const region=options.fit==='fill'&&isGraphicBackground(image.resource?.id);
  return {src: image.src, resource: image.resource, name: image.name, sourceRegion: undefined, crop: undefined, fit: region?'fill':resourceReplacementFit(options.fit),...(region?{aspectRatioLocked:false}:{})};
}
