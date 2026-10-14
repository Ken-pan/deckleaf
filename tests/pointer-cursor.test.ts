import {test} from 'node:test';
import assert from 'node:assert/strict';
import {holdPointerCursor, isPointerGestureActive} from '../src/pointer-cursor';

test('pointer cursor ownership survives overlapping gestures and repeated cleanup, restoring previous inline state', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const properties = new Map<string, {value: string; priority: string}>();
  const attributes = new Map<string, string>();
  let nativeDrag = false;
  const style = {
    getPropertyValue: (name: string) => properties.get(name)?.value ?? '',
    getPropertyPriority: (name: string) => properties.get(name)?.priority ?? '',
    setProperty: (name: string, value: string, priority = '') => properties.set(name, {value, priority}),
    removeProperty: (name: string) => properties.delete(name),
  };
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {querySelector: () => nativeDrag ? {} : null, documentElement: {
    style, getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  }}});
  try {
    style.setProperty('--pointer-cursor', 'wait', 'important');
    attributes.set('data-pointer-cursor', 'existing-owner');
    const endMove = holdPointerCursor('grabbing'), endResize = holdPointerCursor('ns-resize');
    endMove(); endMove();
    assert.equal(style.getPropertyValue('--pointer-cursor'), 'ns-resize');
    endResize(); endResize();
    assert.equal(style.getPropertyValue('--pointer-cursor'), 'wait');
    assert.equal(style.getPropertyPriority('--pointer-cursor'), 'important');
    assert.equal(attributes.get('data-pointer-cursor'), 'existing-owner');
    properties.clear(); attributes.clear();
    assert.equal(isPointerGestureActive(), false);
    const endMarquee = holdPointerCursor('crosshair');
    assert.equal(attributes.get('data-pointer-cursor'), 'crosshair');
    assert.equal(isPointerGestureActive(), true);
    endMarquee();
    assert.equal(properties.has('--pointer-cursor'), false);
    assert.equal(attributes.has('data-pointer-cursor'), false);
    assert.equal(isPointerGestureActive(), false);
    nativeDrag = true;
    assert.equal(isPointerGestureActive(), true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
