import { tick } from 'svelte';
import { editor } from './core/editor.svelte';

export async function focusCanvasSelection() {
  await tick();
  const stage = document.querySelector<HTMLElement>('.canvas-stage');
  const selected = editor.selected.length === 1
    ? Array.from(stage?.querySelectorAll<HTMLElement>('.slide-element[tabindex]') ?? []).find(e => e.dataset.elementId === editor.selected[0] && e.getClientRects().length > 0)
    : undefined;
  (selected ?? stage)?.focus({preventScroll: true});
}

// Pointer actions resume canvas work. Keyboard activation keeps a surviving control.
export async function objectAction(action: () => void, event?: MouseEvent) {
  const control = event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
  const popover = control?.closest('[popover]');
  const origin = popover && !popover.matches(':popover-open') ? document.activeElement as HTMLElement | null : control ?? document.activeElement as HTMLElement | null;
  const canvas = Boolean(origin?.closest('.canvas-stage'));
  action();
  await tick();
  if (!event || event.detail > 0 || canvas || !origin?.isConnected || origin.matches(':disabled') || origin.closest('[inert]')) await focusCanvasSelection();
}
