import {slideLabel} from './core/slide-label';
import type {BlockId} from './core/deck-blocks';
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

/** Block aliases belong to the search index, loaded when search is first opened. */
export function blockSearchActions(open: (id: BlockId) => void, disabled = false): SearchAction[] {
  const ids: BlockId[] = ['architecture','agenda','timeline','roadmap','gantt','process','organization','kanban','comparison','swot','metrics','funnel'];
  const labels = ['architecture','agenda','timeline','roadmap','Gantt plan','process flow','org chart','Kanban board','comparison','SWOT matrix','key metrics','funnel'];
  const aliases = ['架构 系统','日程 议程 规划','时间线 里程碑','路线图 计划','甘特 排期 日程规划','流程 步骤','组织架构 团队','看板 任务','对比 比较','分析 优势 劣势','指标 数据','漏斗 转化'];
  return ids.map((id, index) => ({id: `block:${id}`, kind: 'command', label: `Insert ${labels[index]}`, searchText: `${id} block diagram plan ${aliases[index]}`, disabled, run: () => open(id)}));
}
