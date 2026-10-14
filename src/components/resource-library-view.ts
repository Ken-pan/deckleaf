import type { ResourceItem, ResourceKind } from '../core/resources';
import type {Slide} from '../core/model';
import type {IllustrationType, IllustrationView} from '../core/resource-taxonomy';
import type {ResourceReplacementOptions} from '../core/resource-replacement';

export type ResourceQuickView = ResourceKind | 'graphics' | 'favorites';

export type ResourceReplacementPreview = {
  deckId: string;
  baseRevision: number;
  slide: Slide;
};

// Transient browse state, shared when expanding the quick panel into the library.
export type ResourceLibraryView = {
  kind: ResourceKind | 'used';
  scope: 'browse' | 'favorites' | 'recent';
  favoriteView?: boolean;
  collection?: string;
  category?: string;
  family?: string;
  illustrationView?: IllustrationView;
  illustrationType?: IllustrationType | '';
  selected?: ResourceItem;
  replacement?: ResourceReplacementOptions;
  connectionOpen?: boolean;
  illustrationColor?: string;
  graphicColor?: string;
  iconColor?: string;
};
