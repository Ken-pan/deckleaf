// Pointer capture routes events, but the cursor still follows the hit-tested
// surface. Keep an active gesture's cursor across panels and native popovers.
const cursors = new Map<symbol, string>();
let previous: {value: string; priority: string; attribute: string | null} | undefined;

export function holdPointerCursor(cursor: string): () => void {
  const root = document.documentElement, owner = Symbol();
  if (!cursors.size) previous = {
    value: root.style.getPropertyValue('--pointer-cursor'),
    priority: root.style.getPropertyPriority('--pointer-cursor'),
    attribute: root.getAttribute('data-pointer-cursor'),
  };
  cursors.set(owner, cursor);
  const update = () => {
    const active = [...cursors.values()].at(-1);
    if (active) {
      root.style.setProperty('--pointer-cursor', active);
      root.setAttribute('data-pointer-cursor', active);
    } else if (previous) {
      if (previous.value) root.style.setProperty('--pointer-cursor', previous.value, previous.priority);
      else root.style.removeProperty('--pointer-cursor');
      if (previous.attribute === null) root.removeAttribute('data-pointer-cursor');
      else root.setAttribute('data-pointer-cursor', previous.attribute);
      previous = undefined;
    }
  };
  update();
  return () => { if (cursors.delete(owner)) update(); };
}

export function isPointerGestureActive(): boolean {
  return document.documentElement.hasAttribute('data-pointer-cursor') || Boolean(document.querySelector('.slide-thumb.dragging, .canvas-stage.is-file-drop'));
}
