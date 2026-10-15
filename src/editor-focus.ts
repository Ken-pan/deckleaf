import { tick } from 'svelte';
import { editor } from './core/editor.svelte';
import {availableFocus} from './ui-focus';

export async function focusCanvasSelection() {
  await tick();
  const stage = document.querySelector<HTMLElement>('.canvas-stage');
  const selected = editor.selected.length === 1
    ? Array.from(stage?.querySelectorAll<HTMLElement>('.slide-element[tabindex]') ?? []).find(e => e.dataset.elementId === editor.selected[0] && e.getClientRects().length > 0)
    : undefined;
  const target=selected??stage;
  if(availableFocus(target))target?.focus({preventScroll:true});
  else {
    const fallback=document.querySelector<HTMLElement>('.layer-list .layer-group-name[aria-pressed="true"],.layer-list .layer-name[aria-pressed="true"]')??document.querySelector<HTMLElement>('.layer-list .layer-name,.property-panel .panel-tabs [aria-selected="true"]');
    if(availableFocus(fallback))fallback?.focus({preventScroll:true});
  }
}

export async function containerAction(action:()=>Promise<void>,origin:HTMLElement){
  const layers=Boolean(origin.closest('.layer-browser'));
  await action();await tick();
  if(document.activeElement!==origin&&document.activeElement!==document.body)return;
  const row=layers?document.querySelector<HTMLElement>('.layer-list .layer-group-name[aria-pressed="true"],.layer-list .layer-name[aria-pressed="true"]'):null;
  if(availableFocus(row)){row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest',inline:'nearest'});}
  else await focusCanvasSelection();
}

export async function focusSlideSelection(){
  await tick();
  const current=document.querySelector<HTMLElement>('.slide-thumb.current');
  const target=[current,document.querySelector<HTMLElement>('.focus-page-controls button:enabled'),document.querySelector<HTMLElement>('.focus-page-controls'),document.querySelector<HTMLElement>('.canvas-stage')].find(node=>availableFocus(node));
  target?.focus({preventScroll:true});if(target===current)current?.scrollIntoView({block:'nearest',inline:'nearest'});
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
