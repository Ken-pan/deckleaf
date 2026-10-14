export type NoticeTone = 'success' | 'info' | 'warning' | 'error';

// Important information stays available until explicitly dismissed. Routine
// confirmations have an untimed alternative in Recent notifications.
export function notificationDuration(tone: NoticeTone, message: string): number {
  return tone === 'success' ? Math.max(6000, Math.min(12000, message.length * 60)) : 0;
}

type Lifetime = {id: number; duration: number; dismiss: () => void};
export function notificationLifetime(node: HTMLElement, initial: Lifetime) {
  let options = initial, remaining = initial.duration, started = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false, focused = false;
  const surface=node.parentElement;
  const hidden=()=>document.hidden||surface?.dataset.notificationHidden==='true';
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const pause = () => {
    if (timer !== undefined) remaining = Math.max(0, remaining - (performance.now() - started));
    clear();
  };
  const resume = () => {
    clear();
    if (!options.duration || hovered || focused || hidden()) return;
    started = performance.now();
    timer = setTimeout(() => { timer = undefined; options.dismiss(); }, remaining);
  };
  const enter = () => { hovered = true; pause(); };
  const leave = () => { hovered = false; resume(); };
  const focus = () => { focused = true; pause(); };
  const blur = (event: FocusEvent) => { if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) return; focused = false; resume(); };
  const visibility = () => { if (hidden()) pause(); else resume(); };
  node.addEventListener('pointerenter', enter); node.addEventListener('pointerleave', leave);
  node.addEventListener('focusin', focus); node.addEventListener('focusout', blur);
  document.addEventListener('visibilitychange', visibility);
  surface?.addEventListener('notificationvisibilitychange',visibility);
  resume();
  return {
    update(next: Lifetime) { if (next.id === options.id && next.duration === options.duration) { options = next; return; } pause(); options = next; remaining = next.duration; resume(); },
    destroy() { clear(); node.removeEventListener('pointerenter', enter); node.removeEventListener('pointerleave', leave); node.removeEventListener('focusin', focus); node.removeEventListener('focusout', blur); document.removeEventListener('visibilitychange', visibility); surface?.removeEventListener('notificationvisibilitychange',visibility); },
  };
}
