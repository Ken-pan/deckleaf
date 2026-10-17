import type { Deck, Slide } from './model';

export type LibraryDocument = Pick<Deck, 'id' | 'title' | 'width' | 'height' | 'updatedAt'> & {
  count: number;
  revision?: number;
  firstSlide?: Slide;
};
export type LibrarySort = 'recent' | 'oldest' | 'title';

// A closed library only needs its summaries. Embedded preview media should not
// keep documents alive between visits; opening the library fetches fresh pages.
export function releaseLibraryPreviews(documents: LibraryDocument[]): LibraryDocument[] {
  if (!documents.some(document => document.firstSlide)) return documents;
  return documents.map(({firstSlide: _preview, ...summary}) => summary);
}

const titles = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function libraryDocuments(documents: readonly LibraryDocument[], query: string, sort: LibrarySort): LibraryDocument[] {
  const needle = query.trim().toLocaleLowerCase();
  return documents.filter(document => document.title.toLocaleLowerCase().includes(needle)).sort((a, b) => {
    if (sort === 'title') return titles.compare(a.title, b.title) || a.id.localeCompare(b.id);
    const order = a.updatedAt.localeCompare(b.updatedAt);
    return (sort === 'oldest' ? order : -order) || titles.compare(a.title, b.title) || a.id.localeCompare(b.id);
  });
}

export function libraryDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
