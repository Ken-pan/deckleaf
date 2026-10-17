import type {Deck, Slide} from './model';

export type LibrarySummary = Pick<Deck, 'id' | 'title' | 'revision' | 'width' | 'height' | 'updatedAt'> & {
  count: number;
  provider?: NonNullable<Deck['provenance']>['provider'];
};
export type LibraryPreview = LibrarySummary & {firstSlide?: Slide};

// Only scalar metadata belongs in the index. Never retain media or source data.
export function summarizeDeck(deck: Deck) {
  return {id: deck.id, title: deck.title, revision: deck.revision, width: deck.width, height: deck.height,
    updatedAt: deck.updatedAt, count: deck.slides.length, provider: deck.provenance?.provider};
}
export function requirePreviewRevision(actual: number, expected?: number) {
  if (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0)) {
    throw Object.assign(new Error('Invalid preview revision.'), {status: 422});
  }
  if (expected !== undefined && expected !== actual) {
    throw Object.assign(new Error('This document changed. Reopen the library to refresh its preview.'), {status: 409});
  }
}
