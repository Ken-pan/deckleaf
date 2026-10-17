import type { selectionToolbar as mountToolbar, SelectionToolbarOptions } from './selection-toolbar-layout';

// Apply the flow boundary synchronously, even if the geometry and its stylesheet
// are delayed or fail. A hidden static toolbar still displaces the canvas.
// Preserve updates while loading and never attach to a dismissed toolbar.
export function selectionToolbar(node: HTMLElement, initial: SelectionToolbarOptions) {
  let options = initial, disposed = false;
  let action: ReturnType<typeof mountToolbar>;
  node.style.position = 'fixed';
  node.style.visibility = 'hidden';
  void import('./selection-toolbar-layout').then(module => {
    if (!disposed) action = module.selectionToolbar(node, options);
  });
  return {
    update(next: SelectionToolbarOptions) { options = next; action?.update(next); },
    destroy() { disposed = true; action?.destroy(); },
  };
}
