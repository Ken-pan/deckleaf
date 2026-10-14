export type ViewportBounds = {left: number; top: number; width: number; height: number};
type AnchorBounds = {left: number; right: number; top: number; bottom: number};
type PlacementOptions = {align?: 'start' | 'end'; maxHeight?: number; preferredHeight?: number; minHeight?: number; topBoundary?: number; bottomBoundary?: number; avoid?: AnchorBounds; overlay?: boolean};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));

export function floatingPlacement(anchor: AnchorBounds, size: {width: number; height: number}, viewport: ViewportBounds, options: PlacementOptions = {}) {
  const margin = Math.min(12, viewport.width / 4, viewport.height / 4), gap = 8;
  const left = viewport.left + margin, top = Math.max(viewport.top + margin, Math.min(options.topBoundary ?? viewport.top + margin, viewport.top + viewport.height - margin - 1));
  const right = viewport.left + viewport.width - margin, bottom = Math.max(top + 1, Math.min(options.bottomBoundary ?? viewport.top + viewport.height - margin, viewport.top + viewport.height - margin));
  const width = Math.min(size.width, right - left);
  if (options.overlay) return {left: clamp(anchor.left, left, right - width), top, maxWidth: right - left, maxHeight: Math.min(options.maxHeight ?? Infinity, bottom - top), placement: 'overlay' as const};
  const avoid = options.avoid;
  if (avoid && (right - avoid.right - gap >= width || avoid.left - left - gap >= width)) {
    const height = Math.min(options.preferredHeight ?? size.height, options.maxHeight ?? Infinity, bottom - top);
    return {left: clamp(right - avoid.right - gap >= width ? avoid.right + gap : avoid.left - width - gap, left, right - width), top: clamp(avoid.top, top, bottom - height), maxWidth: right - left, maxHeight: Math.min(options.maxHeight ?? Infinity, bottom - top), placement: 'beside' as const};
  }
  const below = Math.max(0, bottom - anchor.bottom - gap), above = Math.max(0, anchor.top - top - gap);
  const desired = Math.min(options.preferredHeight ?? size.height, bottom - top);
  const placedBelow = below >= desired || below >= above;
  const available = Math.min(bottom - top, placedBelow ? below : above);
  const overlay = available < Math.min(options.minHeight ?? 100, desired);
  const maxHeight = Math.max(1, Math.min(options.maxHeight ?? bottom - top, overlay ? bottom - top : available));
  const height = Math.min(size.height, maxHeight);
  return {
    left: clamp(options.align === 'end' ? anchor.right - width : anchor.left, left, right - width),
    top: clamp(overlay ? top : placedBelow ? anchor.bottom + gap : anchor.top - height - gap, top, bottom - height),
    maxWidth: right - left, maxHeight,
    placement: overlay ? 'overlay' : placedBelow ? 'below' : 'above',
  };
}

export function visualBounds(): ViewportBounds {
  const viewport = window.visualViewport;
  return {left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0, width: viewport?.width ?? innerWidth, height: viewport?.height ?? innerHeight};
}

export function workspaceViewport(layoutHeight:number, viewport:ViewportBounds, scale=1) {
  const magnified=scale>1.01;
  return {height:magnified?layoutHeight:Math.min(layoutHeight,viewport.height),top:magnified?0:viewport.top};
}

export function positionFloating(node: HTMLElement, anchor: DOMRect, options: PlacementOptions = {}) {
  const viewport = visualBounds();
  node.style.maxWidth = `${Math.max(1, viewport.width - 24)}px`;
  const result = floatingPlacement(anchor, {width: node.offsetWidth, height: node.offsetHeight}, viewport, options);
  node.style.maxHeight = `${result.maxHeight}px`;
  // Height can change when its scrollport is constrained, including after rotation.
  const final = floatingPlacement(anchor, {width: node.offsetWidth, height: node.offsetHeight}, viewport, options);
  node.style.left = `${final.left}px`; node.style.top = `${final.top}px`;
  node.dataset.uiPlacement = final.placement;
}

export function installVisualViewport(onchange?: (size:{width:number;height:number})=>void) {
  let frame = 0;
  const apply = () => {
    const bounds = visualBounds(), style = document.documentElement.style;
    for (const key of ['left', 'top', 'width', 'height'] as const) style.setProperty(`--ui-viewport-${key}`, `${bounds[key]}px`);
    // A keyboard resizes the workspace. Native page magnification keeps the
    // layout viewport and its ordinary pan behavior instead of reflowing it.
    const workspace=workspaceViewport(innerHeight,bounds,window.visualViewport?.scale);
    style.setProperty('--ui-workspace-height',`${workspace.height}px`);
    style.setProperty('--ui-workspace-top',`${workspace.top}px`);
    onchange?.({width:innerWidth,height:workspace.height});
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(apply); };
  apply(); window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule); window.visualViewport?.addEventListener('scroll', schedule);
  return () => {
    cancelAnimationFrame(frame); window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
    for (const key of ['left', 'top', 'width', 'height']) document.documentElement.style.removeProperty(`--ui-viewport-${key}`);
    document.documentElement.style.removeProperty('--ui-workspace-height');document.documentElement.style.removeProperty('--ui-workspace-top');
  };
}
