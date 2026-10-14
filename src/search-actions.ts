import {slideLabel} from './core/slide-label';
import type { Deck } from './core/model';

export type SearchScope = 'all' | 'slide' | 'object' | 'command';
export type SearchAction = {
  id: string;
  kind: Exclude<SearchScope, 'all'>;
  label: string;
  detail?: string;
  searchText?: string;
  key?: string;
  suggested?: boolean;
  disabled: boolean;
  run: () => void;
};
export const QUICK_SEARCH_LIMIT = 4;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

export function findSearchActions(actions: readonly SearchAction[], query: string, scope: SearchScope = 'all', suggestedOnly = false): SearchAction[] {
  const term = normalize(query), words = term.split(' ').filter(Boolean);
  return actions.flatMap((action, index) => {
    if (scope !== 'all' && action.kind !== scope || !term && suggestedOnly && !action.suggested) return [];
    const label = normalize(action.label), text = normalize(`${action.label} ${action.detail ?? ''} ${action.searchText ?? ''}`);
    if (!words.every(word => text.includes(word))) return [];
    const rank = !term ? 0 : label === term ? 0 : label.startsWith(term) ? 1 : label.includes(term) ? 2 : 3;
    return [{action, rank, index}];
  }).sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.action);
}

export function documentSearchActions(deck: Deck | null | undefined, navigate: (slideId: string, objectId?: string) => void, disabled = false): SearchAction[] {
  return (deck?.slides ?? []).flatMap((slide, index) => {
    const location = slideLabel(index);
    return [{id: `slide:${slide.id}`, kind: 'slide' as const, label: location, searchText: `${slide.notes} ${slide.elements.map(object => object.text).join(' ')}`, disabled, run: () => navigate(slide.id)},
      ...slide.elements.map(object => ({id: JSON.stringify(['object', slide.id, object.id]), kind: 'object' as const,
        label: object.type === 'text' && object.text.trim() ? object.text.replace(/\s+/g, ' ').trim().slice(0, 100) : object.name || 'Object',
        detail: `Object · ${location}${object.hidden ? ' · Hidden' : ''}${object.locked ? ' · Locked' : ''}`,
        searchText: `${object.name} ${object.text} ${object.type} ${object.resource?.title ?? ''}`, disabled, run: () => navigate(slide.id, object.id)}))];
  });
}
