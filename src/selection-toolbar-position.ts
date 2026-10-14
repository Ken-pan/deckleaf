export interface ScreenRect { left: number; top: number; right: number; bottom: number }
export interface ToolbarSize { width: number; height: number }

export function intersectRect(a: ScreenRect, b: ScreenRect): ScreenRect | null {
  const rect = {left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)};
  return rect.right >= rect.left && rect.bottom > rect.top ? rect : null;
}

export function unionRects(rects: ScreenRect[]): ScreenRect | null {
  if (!rects.length) return null;
  return {left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)), right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom))};
}

// Coordinates are CSS screen pixels, independent of the document's zoom/rotation.
export function positionSelectionToolbar(anchor: ScreenRect, size: ToolbarSize, boundary: ScreenRect, gap = 10, padding = 8) {
  const visible = intersectRect(anchor, boundary);
  const area = {left: boundary.left + padding, right: boundary.right - padding, top: boundary.top + padding, bottom: boundary.bottom - padding};
  if (!visible || size.width > area.right - area.left || size.height > area.bottom - area.top) return null;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const x = clamp((visible.left + visible.right - size.width) / 2, area.left, area.right - size.width);
  const above = visible.top - gap - size.height, below = visible.bottom + gap;
  if (above >= area.top) return {x, y: above, placement: 'top' as const};
  if (below + size.height <= area.bottom) return {x, y: below, placement: 'bottom' as const};
  const y = clamp((visible.top + visible.bottom - size.height) / 2, area.top, area.bottom - size.height);
  if (visible.right + gap + size.width <= area.right) return {x: visible.right + gap, y, placement: 'right' as const};
  if (visible.left - gap - size.width >= area.left) return {x: visible.left - gap - size.width, y, placement: 'left' as const};
  // A selection may fill the viewport. Keep the toolbar reachable at the edge
  // with the most room, rather than letting it escape behind editor panels.
  const topRoom = visible.top - area.top, bottomRoom = area.bottom - visible.bottom;
  return {x, y: clamp(topRoom >= bottomRoom ? above : below, area.top, area.bottom - size.height), placement: topRoom >= bottomRoom ? 'top' as const : 'bottom' as const};
}
