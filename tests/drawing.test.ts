import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingElement, drawingMarkup, DEFAULT_DRAWING, type DrawingPoint} from '../src/core/drawing';
import {DeckSchema, newDeck, blankSlide, ElementSchema} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {prepareDrawingStroke, drawingStrokeHit} from '../src/core/drawing-eraser';

const page = {width: 1440, height: 810};
const points: DrawingPoint[] = [{x: 100, y: 150, pressure: .2}, {x: 150, y: 100, pressure: .7}, {x: 220, y: 150, pressure: 1}];
const svg = (src: string) => atob(src.split(',')[1]);

test('strokes use portable SVG objects, keep color and geometry through the document transaction', () => {
  const stroke = drawingElement(points, {...DEFAULT_DRAWING, color: '#3e63dd'}, page);
  assert.equal(stroke.name, 'Pen drawing');
  assert.ok(stroke.x <= 100 && stroke.y <= 100 && stroke.x + stroke.w >= 220 && stroke.y + stroke.h >= 150);
  assert.match(svg(stroke.src!), /stroke="#3e63dd"/);
  assert.doesNotThrow(() => ElementSchema.parse(stroke));
  const deck = newDeck('Drawing test', [blankSlide()]);
  const result = applyOperations(deck, [{op: 'add_element', slideId: deck.slides[0].id, element: stroke}]);
  const restored = DeckSchema.parse(JSON.parse(JSON.stringify(result)));
  assert.equal(restored.slides[0].elements.at(-1)?.src, stroke.src);
  assert.equal(deck.slides[0].elements.length, 0);
});

test('pen, pressure brush and highlighter produce distinct strokes, including single taps', () => {
  const pen = drawingMarkup(points, DEFAULT_DRAWING);
  const brush = drawingMarkup(points, {...DEFAULT_DRAWING, brush: 'brush', size: 12});
  const highlighter = drawingMarkup(points, {...DEFAULT_DRAWING, brush: 'highlighter', size: 24});
  assert.match(pen, /stroke-linecap="round"/);
  assert.match(brush, / Z" fill=/);
  assert.notEqual(brush, drawingMarkup(points.map(p => ({...p, pressure: .1})), {...DEFAULT_DRAWING, brush: 'brush', size: 12}));
  assert.match(highlighter, /opacity="0.35"/);
  assert.match(highlighter, /stroke-linecap="square"/);
  assert.match(drawingMarkup([points[0]], DEFAULT_DRAWING), /<circle /);
  assert.match(drawingMarkup([points[0]], {...DEFAULT_DRAWING, brush: 'highlighter'}), /<rect /);
});

test('page-edge strokes have valid nonzero bounds and malformed input cannot create SVG markup', () => {
  for (const point of [{x: 0, y: 0, pressure: .5}, {x: 1440, y: 810, pressure: .5}]) {
    const stroke = drawingElement([point], {...DEFAULT_DRAWING, size: 64}, page);
    assert.ok(stroke.w >= 1 && stroke.h >= 1 && stroke.x >= 0 && stroke.y >= 0);
    assert.ok(stroke.x + stroke.w <= page.width && stroke.y + stroke.h <= page.height);
    assert.doesNotThrow(() => ElementSchema.parse(stroke));
  }
  assert.equal(drawingMarkup([{x: NaN, y: 1, pressure: 1}], DEFAULT_DRAWING), '');
  assert.throws(() => drawingElement([], DEFAULT_DRAWING, page));
  assert.throws(() => drawingMarkup(points, {...DEFAULT_DRAWING, color: '"><script>'}));
  assert.throws(() => drawingMarkup(points, {...DEFAULT_DRAWING, size: Infinity}));
});

test('eraser sweeps actual strokes, preserves empty frame space and supports all brushes and dots', () => {
  const line = [{x:100,y:100,pressure:.7},{x:200,y:200,pressure:.7}];
  for (const brush of ['pen','brush','highlighter'] as const) {
    const stroke = prepareDrawingStroke(drawingElement(line,{...DEFAULT_DRAWING,brush,size:12},page))!;
    assert.ok(stroke);
    assert.equal(drawingStrokeHit(stroke,{x:100,y:200},{x:200,y:100},3),true,'fast crossing hits');
    assert.equal(drawingStrokeHit(stroke,{x:105,y:190},{x:105,y:190},3),false,'blank part of image frame is safe');
    const dot = prepareDrawingStroke(drawingElement([line[0]],{...DEFAULT_DRAWING,brush,size:12},page))!;
    assert.equal(drawingStrokeHit(dot,line[0],line[0],3),true);
  }
});

test('eraser protects ordinary images, locked/source/hidden drawings and recognizes renamed and legacy strokes', () => {
  const drawing = drawingElement(points,DEFAULT_DRAWING,page);
  assert.ok(prepareDrawingStroke({...drawing,name:'My sketch'}));
  const legacy = {...drawing,src:`data:image/svg+xml;base64,${btoa(svg(drawing.src!).replace(' data-deck-drawing="1"',''))}`};
  assert.ok(prepareDrawingStroke(legacy));
  for (const patch of [{locked:true},{hidden:true},{opacity:0},{sourceId:'original'},{sourceRegion:{left:0,top:0,right:.5,bottom:.5}},{src:'https://example.com/photo.png'},{src:'data:image/svg+xml;base64,broken'},{src:legacy.src,name:'Photo'}]) assert.equal(prepareDrawingStroke({...drawing,...patch}),null);
});

test('erasing follows resized, rotated and flipped strokes and commits deletions atomically', () => {
  const drawing = drawingElement([{x:100,y:100,pressure:1},{x:200,y:100,pressure:1}],DEFAULT_DRAWING,page);
  const moved = {...drawing,x:300,y:200,w:drawing.w*2,h:drawing.h*2,rotation:90,flipX:true};
  const stroke = prepareDrawingStroke(moved)!;
  const middle={x:moved.x+moved.w/2,y:moved.y+moved.h/2};
  assert.equal(drawingStrokeHit(stroke,middle,middle,3),true);
  assert.equal(drawingStrokeHit(stroke,{x:150,y:100},{x:150,y:100},3),false);
  const deck=newDeck('Erase test',[blankSlide()]);
  deck.slides[0].elements=[drawing,{...drawing,id:'locked-stroke',locked:true}];
  const result=applyOperations(deck,[{op:'delete_element',slideId:deck.slides[0].id,elementId:drawing.id}]);
  assert.equal(result.slides[0].elements.length,1);
  assert.equal(result.slides[0].elements[0].id,'locked-stroke');
  assert.equal(deck.slides[0].elements.length,2,'undo snapshot remains intact');
});
