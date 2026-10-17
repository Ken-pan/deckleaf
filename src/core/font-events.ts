type Group = {callbacks: Set<() => void>; listener: () => void};
const groups = new WeakMap<FontFaceSet, Group>();

/** Share one native listener; each subscriber releases only its own callback. */
export function observeFontLoading(fonts: FontFaceSet, update: () => void): () => void {
  let group = groups.get(fonts);
  if (!group) {
    const callbacks = new Set<() => void>();
    group = {callbacks, listener: () => {for (const callback of [...callbacks]) if(callbacks.has(callback)) callback();}};
    groups.set(fonts, group); fonts.addEventListener('loadingdone', group.listener);
  }
  const owned = group;
  owned.callbacks.add(update);
  return () => {
    if (!owned.callbacks.delete(update) || owned.callbacks.size) return;
    fonts.removeEventListener('loadingdone', owned.listener); groups.delete(fonts);
  };
}
