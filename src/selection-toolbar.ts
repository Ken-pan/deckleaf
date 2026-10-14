import type { selectionToolbar as mountToolbar, SelectionToolbarOptions } from './selection-toolbar-layout';

// Load selection-only geometry and styles after selection; preserve updates made
// while the chunk loads, and never attach it to a toolbar that was dismissed.
export function selectionToolbar(node: HTMLElement, initial: SelectionToolbarOptions) {
  let options = initial, disposed = false;
  let action: ReturnType<typeof mountToolbar>;
  node.style.visibility = 'hidden';
  void import('./selection-toolbar-layout').then(module => {
    if (!disposed) action = module.selectionToolbar(node, options);
  });
  return {
    update(next: SelectionToolbarOptions) { options = next; action?.update(next); },
    destroy() { disposed = true; action?.destroy(); },
  };
}
