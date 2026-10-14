/** Selection belongs to the editor UI, never the saved document. */
export type SlideSelection = {ids: string[]; anchor: string};
export type SlideSelectionIntent = {toggle?: boolean; range?: boolean; additive?: boolean};

export function orderedSlideSelection(order: readonly string[], ids: readonly string[]): string[] {
  const selected = new Set(ids);
  return order.filter(id => selected.has(id));
}

export function selectSlideRange(order: readonly string[], current: SlideSelection, id: string, intent: SlideSelectionIntent = {}): SlideSelection {
  if (!order.includes(id)) return {ids: orderedSlideSelection(order, current.ids), anchor: current.anchor};
  if (intent.range) {
    const anchor = order.includes(current.anchor) ? current.anchor : id;
    const from = order.indexOf(anchor), to = order.indexOf(id);
    const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return {ids: orderedSlideSelection(order, intent.additive ? [...current.ids, ...range] : range), anchor};
  }
  if (intent.toggle) {
    return {ids: orderedSlideSelection(order, current.ids.includes(id) ? current.ids.filter(value => value !== id) : [...current.ids, id]), anchor: id};
  }
  return {ids: [id], anchor: id};
}
