export type SlideMove = 'earlier' | 'later' | 'start' | 'end';

export function selectedSlideOrder(order: readonly string[], ids: readonly string[]): string[] {
  const selected=new Set(ids),existing=new Set(order);
  if(ids.some(id=>!existing.has(id)))throw new Error('A selected slide no longer exists.');
  return order.filter(id=>selected.has(id));
}

/** Move the selection as one block; both selected and unselected order stay stable. */
export function reorderSelectedSlides(order: readonly string[], ids: readonly string[], target:string, after=false): string[] {
  const selected=selectedSlideOrder(order,ids),set=new Set(selected);
  if(!order.includes(target))throw new Error('The destination slide no longer exists.');
  if(!selected.length||set.has(target))return [...order];
  const rest=order.filter(id=>!set.has(id)),index=rest.indexOf(target)+Number(after);
  return [...rest.slice(0,index),...selected,...rest.slice(index)];
}

export function moveSelectedSlides(order: readonly string[], ids: readonly string[], direction:SlideMove): string[] {
  const selected=selectedSlideOrder(order,ids);if(!selected.length)return [...order];
  if(direction==='start'||direction==='end'){
    const set=new Set(selected),rest=order.filter(id=>!set.has(id));
    return direction==='start'?[...selected,...rest]:[...rest,...selected];
  }
  const first=order.indexOf(selected[0]),last=order.indexOf(selected.at(-1)!);
  const target=direction==='earlier'?order[first-1]:order[last+1];
  return target?reorderSelectedSlides(order,selected,target,direction==='later'):[...order];
}
