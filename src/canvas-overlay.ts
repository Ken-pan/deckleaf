import type {canvasOverlay as mountOverlay} from './canvas-overlay-layout';

export function canvasOverlay(node: HTMLElement) {
  let disposed = false;
  let action: ReturnType<typeof mountOverlay>;
  node.style.visibility = 'hidden';
  void import('./canvas-overlay-layout').then(module => {
    if (!disposed) { action = module.canvasOverlay(node); node.style.visibility = 'visible'; }
  });
  return {destroy() { disposed = true; action?.destroy(); }};
}
