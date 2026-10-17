import {intersectRect, type ScreenRect} from './selection-toolbar-position';
import {visualBounds} from './ui-viewport';

// Stage-wide UI and selection tools share the same unobscured screen rectangle.
export function canvasOverlayBounds(stage: HTMLElement): ScreenRect | null {
  const viewport = visualBounds(), rect = stage.getBoundingClientRect();
  let bounds = intersectRect({left: rect.left + stage.clientLeft, top: rect.top + stage.clientTop,
    right: rect.left + stage.clientLeft + stage.clientWidth, bottom: rect.top + stage.clientTop + stage.clientHeight},
    {left: viewport.left, top: viewport.top, right: viewport.left + viewport.width, bottom: viewport.top + viewport.height});
  if (!bounds) return null;
  const panel = stage.closest('.workspace')?.querySelector<HTMLElement>('.property-panel:not([inert])');
  if (panel && getComputedStyle(panel).position === 'absolute') {
    const p = panel.getBoundingClientRect();
    if (intersectRect(p, bounds)) bounds.right = Math.min(bounds.right, p.left - 8);
  }
  const footer = stage.closest('.stage-column')?.querySelector<HTMLElement>('.stage-footer');
  if (footer && getComputedStyle(footer).position === 'absolute') bounds.bottom = Math.min(bounds.bottom, footer.getBoundingClientRect().top - 8);
  return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : null;
}

export function canvasOverlay(node: HTMLElement) {
  const surface = node.parentElement!, stage = surface.querySelector<HTMLElement>('.canvas-stage')!;
  const workspace = surface.closest('.workspace')!;
  let frame = 0;
  const observed = new WeakSet<Element>();
  const resize = new ResizeObserver(schedule);
  function layout() {
    frame = 0;
    for (const element of [stage, surface, ...workspace.querySelectorAll('.stage-footer,.property-panel,.canvas-overlay-top,.canvas-overlay-bottom')]) {
      if (!observed.has(element)) { observed.add(element); resize.observe(element); }
    }
    const bounds = canvasOverlayBounds(stage), origin = surface.getBoundingClientRect();
    node.hidden = !bounds || bounds.right - bounds.left < 120;
    if (!bounds) return;
    for (const [key, value] of Object.entries({left: bounds.left - origin.left, top: bounds.top - origin.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top})) {
      const next = `${value}px`;
      if (node.style.getPropertyValue(key) !== next) node.style.setProperty(key, next);
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout); }
  const mutations = new MutationObserver(records => {
    if (records.some(record => record.target !== node && !record.target.parentElement?.closest('.selection-context'))) schedule();
  });
  mutations.observe(workspace, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'inert', 'hidden']});
  const app = workspace.closest('.editor-app');
  if (app) mutations.observe(app, {attributes: true, attributeFilter: ['class']});
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  layout();
  return {destroy() {
    cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect();
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  }};
}
