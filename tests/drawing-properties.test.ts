import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingElement, DEFAULT_DRAWING} from '../src/core/drawing';
import {isDrawingElement} from '../src/core/drawing-identity';
import {drawingColorPatch, drawingStyle} from '../src/core/drawing-properties';
import {elementLabel} from '../src/components/element-labels';
import {applyOperations} from '../src/core/operations';
import {blankSlide, newDeck, validateDeck} from '../src/core/model';

const points = [{x: 100, y: 100, pressure: .5}, {x: 200, y: 180, pressure: 1}];
const page = {width: 1440, height: 810};
const decode = (src: string) => atob(src.split(',')[1]);

test('authored strokes have a Drawing identity even after renaming, with legacy support', () => {
  const drawing = drawingElement(points, DEFAULT_DRAWING, page);
  assert.equal(elementLabel(drawing), 'Drawing');
  assert.equal(isDrawingElement({...drawing, name: 'My sketch', locked: true}), true);
  const legacy = {...drawing, src: `data:image/svg+xml;base64,${btoa(decode(drawing.src!).replace(' data-deck-drawing="1"', ''))}`};
  assert.equal(elementLabel(legacy), 'Drawing');
  assert.equal(isDrawingElement({...legacy, name: 'Imported art'}), false);
  for (const patch of [{sourceId: 'original'}, {resource: {id: 'source'}}, {crop: {left: 0, right: 0, top: 0, bottom: 0}}, {src: 'data:image/svg+xml;base64,broken'}, {src: 'https://example.com/photo.png'}]) assert.equal(isDrawingElement({...drawing, ...patch} as typeof drawing), false);
});

test('recoloring all brushes preserves geometry, opacity, transforms and transaction snapshots', () => {
  for (const brush of ['pen', 'brush', 'highlighter'] as const) {
    const drawing = {...drawingElement(points, {...DEFAULT_DRAWING, brush, size: 16}, page), rotation: 30, flipX: true, opacity: .6};
    const patch = drawingColorPatch(drawing, '#3e63dd')!;
    assert.deepEqual(Object.keys(patch), ['src']);
    assert.equal(decode(patch.src!).replace(/#3e63dd/g, DEFAULT_DRAWING.color), decode(drawing.src!));
    assert.equal(drawingStyle({...drawing, ...patch})?.color, '#3e63dd');
    assert.equal(drawingStyle(drawing)?.brush, brush);
    const slide = blankSlide(); slide.elements = [drawing];
    const deck = newDeck('Drawing controls', [slide]);
    const next = applyOperations(deck, [{op: 'update_element', slideId: slide.id, elementId: drawing.id, patch}]);
    assert.equal(next.slides[0].elements[0].opacity, .6);
    assert.equal(next.slides[0].elements[0].rotation, 30);
    assert.equal(deck.slides[0].elements[0].src, drawing.src);
    assert.doesNotThrow(() => validateDeck(JSON.parse(JSON.stringify(next))));
  }
});

test('paint edits protect source and locked artwork and reject invalid colors', () => {
  const drawing = drawingElement(points, DEFAULT_DRAWING, page);
  assert.equal(drawingColorPatch({...drawing, locked: true}, '#ffffff'), null);
  assert.equal(drawingColorPatch({...drawing, sourceId: 'source'}, '#ffffff'), null);
  assert.equal(drawingColorPatch(drawing, DEFAULT_DRAWING.color), null);
  assert.throws(() => drawingColorPatch(drawing, '"><script>'));
});

test('inspector drawing selection reports mixed paint and batch color edits skip protected objects', async () => {
  const {drawingSelection, drawingColorOperations} = await import('../src/core/drawing-properties');
  const {inspectorCapabilities} = await import('../src/core/inspector-properties');
  const {element} = await import('../src/core/model');
  const a = drawingElement(points, DEFAULT_DRAWING, page);
  const b = {...drawingElement(points, {...DEFAULT_DRAWING, brush:'highlighter', color:'#3e63dd'}, page), id:'second'};
  const locked = {...a, id:'locked', locked:true};
  const photo = element('image', {id:'photo', src:'https://example.com/photo.png'});
  const selected = drawingSelection([a,b]);
  assert.equal(selected.all,true); assert.equal(selected.mixedColor,true); assert.equal(selected.brush,null);
  assert.equal(drawingSelection([a,photo]).all,false); assert.equal(drawingSelection([a,photo]).any,true);
  assert.equal(drawingSelection([]).all,false);
  assert.equal(inspectorCapabilities([a]).radius,false);
  assert.equal(inspectorCapabilities([a,photo]).radius,false);
  assert.equal(inspectorCapabilities([photo]).radius,true);
  const slide = blankSlide(); slide.elements = [a,b,locked,photo];
  const deck = newDeck('Drawing inspector', [slide]);
  const operations = drawingColorOperations(slide, slide.elements.map(item=>item.id), '#e5484d');
  assert.deepEqual(operations.map(op=>'elementId' in op?op.elementId:''),[a.id,b.id]);
  const after = applyOperations(deck,operations);
  assert.equal(drawingSelection(after.slides[0].elements.slice(0,2)).mixedColor,false);
  assert.deepEqual(after.slides[0].elements[2],locked);
  assert.deepEqual(after.slides[0].elements[3],photo);
});
