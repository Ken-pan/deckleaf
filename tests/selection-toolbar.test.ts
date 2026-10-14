import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionSelectionToolbar, unionRects } from '../src/selection-toolbar-position';

const boundary = {left: 200, top: 100, right: 1100, bottom: 700};
const size = {width: 320, height: 40};
test('object toolbar is centered ten screen pixels above its selection', () => {
  assert.deepEqual(positionSelectionToolbar({left: 400, top: 300, right: 800, bottom: 500}, size, boundary), {x: 440, y: 250, placement: 'top'});
});
test('toolbar flips below an object at the top, and shifts inside the left/right canvas boundaries', () => {
  assert.deepEqual(positionSelectionToolbar({left: 200, top: 100, right: 220, bottom: 130}, size, boundary), {x: 208, y: 140, placement: 'bottom'});
  assert.deepEqual(positionSelectionToolbar({left: 1080, top: 600, right: 1120, bottom: 640}, size, boundary), {x: 772, y: 550, placement: 'top'});
});
test('partially clipped or viewport-filling selections remain reachable; offscreen selections hide', () => {
  const result = positionSelectionToolbar({left: 0, top: 0, right: 1440, bottom: 810}, size, boundary)!;
  assert.ok(result.x >= 208 && result.x + size.width <= 1092 && result.y >= 108 && result.y + size.height <= 692);
  assert.equal(positionSelectionToolbar({left: 0, top: 0, right: 100, bottom: 90}, size, boundary), null);
});
test('a tall narrow object uses the side when neither above nor below fits', () => {
  assert.deepEqual(positionSelectionToolbar({left: 400, top: 105, right: 450, bottom: 695}, size, boundary), {x: 460, y: 380, placement: 'right'});
});
test('mobile toolbar fits a narrow canvas and a keyboard-reduced viewport', () => {
  const result = positionSelectionToolbar({left: 12, top: 120, right: 308, bottom: 160}, {width: 288, height: 52}, {left: 0, top: 96, right: 320, bottom: 280})!;
  assert.deepEqual(result, {x: 16, y: 170, placement: 'bottom'});
  assert.equal(positionSelectionToolbar(boundary, size, {left: 0, top: 0, right: 100, bottom: 100}), null);
});
test('multi-selection uses the union, and a caret with zero width can be an anchor', () => {
  assert.deepEqual(unionRects([{left: 400, top: 300, right: 500, bottom: 350}, {left: 600, top: 400, right: 800, bottom: 500}]), {left: 400, top: 300, right: 800, bottom: 500});
  assert.deepEqual(positionSelectionToolbar({left: 700, top: 300, right: 700, bottom: 325}, size, boundary), {x: 540, y: 250, placement: 'top'});
});
