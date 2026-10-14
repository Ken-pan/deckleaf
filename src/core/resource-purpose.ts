import type {SlideElement, ResourceAttribution} from './model';

export function isGraphicBackground(id = '') { return id.startsWith('deck-graphics:') && !id.startsWith('deck-graphics:accent-'); }
export function isRegionFill(e?: Pick<SlideElement, 'resource' | 'fit' | 'crop' | 'sourceRegion'> | null) { return Boolean(e && isGraphicBackground(e.resource?.id) && e.fit === 'fill' && !e.crop && !e.sourceRegion); }
export function canRecolorResource(resource?: Pick<ResourceAttribution, 'id'>) { return Boolean(resource && /^(?:blue-black|deck-graphics|doodles|illlustrations|iconify):/.test(resource.id)); }

export function isThemedIllustration(resource?: Pick<ResourceAttribution,'id'>) {
  return Boolean(resource && (/^(?:blue-black|doodles|illlustrations):/.test(resource.id) || resource.id.startsWith('deck-graphics:accent-')));
}
