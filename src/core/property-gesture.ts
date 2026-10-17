import type {Editor} from './editor.svelte';

let gestureSequence = 0;
/** Scope synchronous field updates to one undo entry, including pauses while dragging. */
export function beginPropertyGesture(editor: Editor) {
  const key = `field-gesture-${++gestureSequence}`;
  const scope = () => `${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}`;
  const origin = scope(), past = editor.past, pastContext = editor.pastContext, future = editor.future, futureContext = editor.futureContext, futureBeforeContext = editor.futureBeforeContext;
  let closed = false, lastRevision = editor.deck?.revision, lastKey = '';
  const current = () => !closed && scope() === origin && editor.deck?.revision === lastRevision;
  return {
    isCurrent: current,
    apply: (change: () => void) => {
      if (!current()) return false;
      editor.propertyGesture = key;
      try { change(); lastRevision = editor.deck?.revision; lastKey = editor.lastMerge; }
      finally { editor.propertyGesture = ''; }
      return true;
    },
    finish: (cancel = false) => {
      if (closed) return false;
      closed = true;
      let rolledBack = false;
      if (cancel && lastKey.endsWith(`:${key}`) && editor.lastMerge === lastKey && editor.deck?.revision === lastRevision && scope() === origin) {
        editor.undo();
        rolledBack = true;
        editor.past = past; editor.pastContext = pastContext;
        editor.future = future; editor.futureContext = futureContext; editor.futureBeforeContext = futureBeforeContext;
      }
      if (editor.lastMerge === lastKey) { editor.lastMerge = ''; editor.lastMergeTime = 0; }
      return rolledBack;
    },
  };
}

