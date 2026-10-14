/** Task priority belongs to editor chrome, never to document styles. */
export type EditorTask = 'compose' | 'selection' | 'locked' | 'text' | 'reference' | 'review';
export function editorTask(context: {previewing: boolean; reference: boolean; editing: boolean; selected: number; allLocked: boolean}): EditorTask {
  if (context.previewing) return 'review';
  if (context.reference) return 'reference';
  if (context.editing) return 'text';
  if (context.selected) return context.allLocked ? 'locked' : 'selection';
  return 'compose';
}
