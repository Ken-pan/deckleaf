import type { Component } from 'svelte';

export type ContextMenuItem = {
  label: string;
  icon?: Component<any>;
  shortcut?: string;
  checked?: boolean;
  choice?: boolean;
  disabled?: boolean;
  divider?: boolean;
  tone?: 'danger';
  children?: ContextMenuItem[];
  onselect?: () => void | Promise<void>;
};
export type ContextActions = { label: string; items: ContextMenuItem[]; returnFocus?: HTMLElement; restore?: () => void };
export type ContextRequest = { target: HTMLElement; x: number; y: number; keyboard: boolean };

// Components supply their own actions; the app owns fallback scene routing.
const targets = new WeakMap<HTMLElement, () => ContextActions>();
export function contextActions(node: HTMLElement, resolve: () => ContextActions) {
  targets.set(node, resolve);
  return { update(next: () => ContextActions) { targets.set(node, next); }, destroy() { targets.delete(node); } };
}
export function registeredContext(target: HTMLElement): ContextActions | undefined {
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    const resolve = targets.get(node);
    if (resolve) return resolve();
  }
}
