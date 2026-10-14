import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorTask } from '../src/editor-priority';

const idle = {previewing: false, reference: false, editing: false, selected: 0, allLocked: false};
test('preview owns the workspace even when a source render or old selection exists', () => {
  assert.equal(editorTask({...idle, previewing: true, reference: true, editing: true, selected: 1}), 'review');
  assert.equal(editorTask({...idle, reference: true, editing: true, selected: 1}), 'reference');
});
test('ending inline editing returns to selection, then to the composing canvas', () => {
  assert.equal(editorTask({...idle, editing: true, selected: 1}), 'text');
  assert.equal(editorTask({...idle, selected: 1}), 'selection');
  assert.equal(editorTask({...idle, allLocked: true}), 'compose');
});
test('a mixed lock selection remains editable while a fully locked selection exposes unlocking', () => {
  assert.equal(editorTask({...idle, selected: 2, allLocked: false}), 'selection');
  assert.equal(editorTask({...idle, selected: 2, allLocked: true}), 'locked');
});
