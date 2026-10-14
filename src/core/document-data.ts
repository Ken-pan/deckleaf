// Documents contain JSON data. Copy their mutable containers without encoding
// immutable image/font strings; JSON round trips duplicate those bytes per edit.
export function cloneDocumentData<T>(value: T): T {
  const ancestors = new Set<object>();
  function copy(input: unknown): unknown {
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'number') return Number.isFinite(input) ? input || 0 : null;
      if (typeof input === 'bigint') throw new TypeError('Document data cannot contain BigInt values.');
      return input;
    }
    if (ancestors.has(input)) throw new TypeError('Document data cannot contain circular references.');
    ancestors.add(input);
    try {
      if (Array.isArray(input)) return Array.from(input, item => item === undefined ? null : copy(item));
      return Object.fromEntries(Object.entries(input).filter(([, item]) => item !== undefined).map(([key, item]) => [key, copy(item)]));
    } finally { ancestors.delete(input); }
  }
  return copy(value) as T;
}

// Optional undefined properties are omitted in persisted JSON. Property order
// does not create a different recovery branch; content and revisions do.
export function sameDocumentData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => sameDocumentData(item ?? null, right[index] ?? null));
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length
    && keys.every(key => Object.hasOwn(b, key) && sameDocumentData(a[key], b[key]));
}

// Run only after canonical validation has produced independent JSON data.
// Editor revisions are immutable: reuse equal containers without retaining a
// second copy of every page in the undo stack. This never skips validation.
const revisionKeyCounts = new WeakMap<object, number>();
export function shareDocumentRevision<T>(previous: T, validated: T): T {
  function share(before: any, after: any): any {
    if (before === after || !before || !after || typeof before !== 'object' || typeof after !== 'object') return after;
    if (Array.isArray(before) !== Array.isArray(after)) return after;
    if (Array.isArray(after)) {
      let equal = before.length === after.length;
      const reordered = after.some((item, i) => item?.id && item.id !== before[i]?.id);
      const byId = reordered ? new Map(before.filter((item: any) => item?.id).map((item: any) => [item.id, item])) : undefined;
      for (let i = 0; i < after.length; i++) {
        const current = after[i], shared = share(byId && current?.id ? byId.get(current.id) : before[i], current);
        if (shared !== current) after[i] = shared;
        if (after[i] !== before[i]) equal = false;
      }
      return equal ? before : after;
    }
    let equal = true, count = 0;
    for (const key in after) {
      if (after[key] === undefined) continue;
      count++;
      const current = after[key];
      if (current === before[key]) continue;
      const shared = share(before[key], current);
      if (shared !== current) after[key] = shared;
      if (shared !== before[key]) equal = false;
    }
    if (equal) {
      let previousCount = revisionKeyCounts.get(before);
      if (previousCount === undefined) {
        previousCount = 0;
        for (const key in before) if (before[key] !== undefined) previousCount++;
        revisionKeyCounts.set(before, previousCount);
      }
      if (count !== previousCount) equal = false;
    }
    revisionKeyCounts.set(after, count);
    return equal ? before : after;
  }
  return share(previous, validated);
}
