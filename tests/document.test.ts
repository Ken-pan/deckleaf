import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankSlide, element, newDeck, validateDeck } from '../src/core/model';
import { applyOperations, type Operation } from '../src/core/operations';
import { COLLECTIONS, templateDeck } from '../src/core/templates';
import { importFigma, importGoogle, importLegacySlides, importBroadser } from '../src/importers/structured';
import { exportBroadser } from '../src/core/export';

function document() { const s = blankSlide('Evidence'); s.elements.push(element('text', {text: 'Observed finding'})); return newDeck('Review', [s]); }
test('a bad operation rolls back the whole transaction and does not mutate source evidence', () => {
  const deck = document(), before = JSON.stringify(deck), s = deck.slides[0], e = s.elements[0];
  const operations: Operation[] = [{op: 'update_element', slideId: s.id, elementId: e.id, patch: {text: 'Edited'}}, {op: 'delete_element', slideId: s.id, elementId: 'missing'}];
  assert.throws(() => applyOperations(deck, operations)); assert.equal(JSON.stringify(deck), before);
});
test('an old AI proposal cannot overwrite newer manual edits', () => {
  const deck = document(), s = deck.slides[0], e = s.elements[0];
  const manual = applyOperations(deck, [{op: 'update_element', slideId: s.id, elementId: e.id, patch: {text: 'Latest evidence'}}]);
  assert.throws(() => applyOperations(manual, [{op: 'update_element', slideId: s.id, elementId: e.id, patch: {text: 'Old proposal'}}], 0, 'ai'));
  assert.equal(manual.slides[0].elements[0].text, 'Latest evidence');
});
test('locked evidence survives AI edits and slide deletion', () => {
  const deck = document(); deck.slides.push(blankSlide()); const s = deck.slides[0], e = s.elements[0]; e.locked = true;
  for (const op of [{op: 'delete_slide', slideId: s.id}, {op: 'update_element', slideId: s.id, elementId: e.id, patch: {locked: false}}, {op: 'delete_element', slideId: s.id, elementId: e.id}] as Operation[]) assert.throws(() => applyOperations(deck, [op], 0, 'ai'));
});
test('duplicate IDs, corrupt order and deleting the last slide are rejected', () => {
  const deck = document(), s = deck.slides[0];
  assert.throws(() => applyOperations(deck, [{op: 'delete_slide', slideId: s.id}]));
  assert.throws(() => applyOperations(deck, [{op: 'reorder_slides', ids: ['missing']}]));
  deck.slides.push({...s}); assert.throws(() => validateDeck(deck));
});
test('all template decks have finite in-canvas geometry and source-free editable objects', () => {
  for (const collection of COLLECTIONS) {
    const deck = templateDeck(collection.id); validateDeck(deck);
    for (const s of deck.slides) for (const e of s.elements) {
      assert(e.x >= 0 && e.y >= 0 && e.x + e.w <= deck.width && e.y + e.h <= deck.height, `${collection.id}/${s.title}/${e.name}`);
      assert(!e.locked);
    }
  }
});
test('Figma and Google normalized imports preserve official render, geometry and text', () => {
  const png = 'data:image/png;base64,aA==';
  const figma = importFigma({title: 'Original', slides: [{id: '1:1', name: 'Slide', absoluteBoundingBox: {x: 40, y: 50, width: 1200, height: 675}, children: [{id: '2:1', type: 'TEXT', name: 'Title', characters: 'Original text', absoluteBoundingBox: {x: 100, y: 100, width: 400, height: 60}, style: {fontSize: 40, fontFamily: 'Arial', fontWeight: 600}}]}], renders: {'1:1': png}});
  assert.equal(figma.slides[0].source?.render, png); assert.equal(figma.slides[0].elements[0].x, 60); assert.equal(figma.slides[0].elements[0].text, 'Original text');
  const google = importGoogle({presentation: {title: 'Google source', pageSize: {width: {magnitude: 720, unit: 'PT'}, height: {magnitude: 405, unit: 'PT'}}, slides: [{objectId: 's1', pageElements: [{objectId: 't1', size: {width: {magnitude: 200, unit: 'PT'}, height: {magnitude: 40, unit: 'PT'}}, transform: {scaleX: 1, scaleY: 1, translateX: 48, translateY: 100, unit: 'PT'}, shape: {text: {textElements: [{textRun: {content: 'Source text', style: {fontFamily: 'Arial', fontSize: {magnitude: 24, unit: 'PT'}}}}]}}}]}]}, renders: {s1: png}});
  assert.equal(google.slides[0].source?.render, png); assert.equal(google.slides[0].elements[0].x, 96); assert.equal(google.slides[0].elements[0].fontSize, 48);
});
test('Broadser export uses the actual board/card contract and can be read back', () => {
  const deck = document(); deck.slides[0].notes = 'Original speaker notes';
  const board = exportBroadser(deck); assert.equal(board.cards.length, 1); assert.equal(board.cards[0].type, 'note'); assert(board.cards[0].text.includes('Original speaker notes'));
  const imported = importBroadser(board); assert(imported.slides[0].elements.some(e => e.text.includes('Observed finding')));
});
test('existing deck conversion keeps choices and narration in editable notes', () => {
  const deck = importLegacySlides({title: 'Project', slides: [{id: 's', template: 'choice', title: 'Choose one', body: 'The source body', choices: [{label: 'A', text: 'Reason', chosen: true}], narration: {script: 'Exact narration'}}]});
  assert(deck.slides[0].notes.includes('Exact narration')); assert(deck.slides[0].notes.includes('Chosen: A: Reason'));
});
