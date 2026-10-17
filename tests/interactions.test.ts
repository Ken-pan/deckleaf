import { test } from 'node:test';
import assert from 'node:assert/strict';
import { element } from '../src/core/model';
import {keepsAspectRatio, resizedDimensions, passedDragThreshold, resizeCursor, resizeFromCorner, chooseSelection, marqueeSelection, selectionBounds, type Corner, type ResizeHandle} from '../src/core/interactions';
import {hitElements} from '../src/core/hit-testing';

test('resize cursors follow screen axes under rotation and flips', () => {
  const box = element('rect', {w: 600, h: 40});
  assert.equal(resizeCursor(box, 'nw'), 'nwse-resize');
  assert.equal(resizeCursor(box, 'ne'), 'nesw-resize');
  assert.equal(resizeCursor({...box, rotation: 45}, 'se'), 'ns-resize');
  assert.equal(resizeCursor({...box, rotation: 45}, 'ne'), 'ew-resize');
  assert.equal(resizeCursor({...box, rotation: 90}, 'nw'), 'nesw-resize');
  assert.equal(resizeCursor({...box, flipX: true}, 'se'), 'nesw-resize');
  assert.equal(resizeCursor({...box, flipY: true}, 'nw'), 'nesw-resize');
  assert.equal(resizeCursor({...box, flipX: true, flipY: true}, 'nw'), 'nwse-resize');
  for (const angle of [-450, -135, -45, 0, 45, 90, 135, 360]) for (const corner of ['nw', 'ne', 'sw', 'se'] as Corner[]) {
    assert.equal(resizeCursor({...box, rotation: angle}, corner), resizeCursor({...box, rotation: angle + 180}, corner));
  }
});

test('line endpoint cursors follow thin and transformed line directions', () => {
  const line = element('line', {w: 600, h: 1});
  assert.equal(resizeCursor(line, 'nw'), 'ew-resize');
  assert.equal(resizeCursor({...line, rotation: 90}, 'se'), 'ns-resize');
  assert.equal(resizeCursor({...line, w: 1, h: 600}, 'se'), 'ns-resize');
  assert.equal(resizeCursor({...line, w: 80, h: 80}, 'se'), 'nwse-resize');
  assert.equal(resizeCursor({...line, w: 80, h: 80, flipY: true}, 'se'), 'nesw-resize');
});

test('side cursors follow the edge normal after rotation and flips', () => {
  const e=element('rect');
  for(const flipX of [false,true])for(const flipY of [false,true]){
    const box={...e,flipX,flipY};
    assert.equal(resizeCursor(box,'w'),'ew-resize');assert.equal(resizeCursor(box,'n'),'ns-resize');
    assert.equal(resizeCursor({...box,rotation:90},'e'),'ns-resize');
    assert.equal(resizeCursor({...box,rotation:45},'e'),'nwse-resize');
    assert.equal(resizeCursor({...box,rotation:45},'s'),'nesw-resize');
  }
});

test('side resize ignores tangential motion and fixes the opposite midpoint, including ratio and minimum clamping', () => {
  for(const rotation of [0,37,90,-120])for(const flipX of [false,true])for(const flipY of [false,true])for(const edge of ['n','e','s','w'] as ResizeHandle[])for(const proportional of [false,true]){
    const e=element('image',{x:100,y:70,w:240,h:120,rotation,flipX,flipY}),a=rotation*Math.PI/180;
    const horizontal=edge==='e'||edge==='w',sign=edge==='e'||edge==='s'?1:-1;
    const normal={x:horizontal?Math.cos(a)*(flipX?-1:1): -Math.sin(a)*(flipY?-1:1),y:horizontal?Math.sin(a)*(flipX?-1:1):Math.cos(a)*(flipY?-1:1)};
    const anchor=(v:typeof e)=>[v.x+v.w/2-normal.x*sign*(horizontal?v.w:v.h)/2,v.y+v.h/2-normal.y*sign*(horizontal?v.w:v.h)/2];
    for(const amount of [40,-1000]){
      const dx=normal.x*sign*amount-normal.y*93,dy=normal.y*sign*amount+normal.x*93;
      const next={...e,...resizeFromCorner(e,dx,dy,edge,proportional)};
      assert.ok(next.w>=20&&next.h>=20);
      anchor(e).forEach((n,i)=>assert.ok(Math.abs(n-anchor(next)[i])<1e-8));
      if(proportional)assert.ok(Math.abs(next.w/next.h-2)<1e-8);
      else assert.equal(horizontal?next.h:next.w,horizontal?e.h:e.w);
      const straight=resizeFromCorner(e,normal.x*sign*amount,normal.y*sign*amount,edge,proportional);
      for(const key of ['x','y','w','h'] as const)assert.ok(Math.abs(next[key]-straight[key])<1e-8);
    }
  }
});

test('selection jitter stays a click in screen pixels, with a larger touch threshold', () => {
  assert.equal(passedDragThreshold(2, 2, 'mouse'), false);
  assert.equal(passedDragThreshold(4, 0, 'mouse'), true);
  assert.equal(passedDragThreshold(4, 4, 'touch'), false);
  assert.equal(passedDragThreshold(8, 0, 'touch'), true);
});

test('group selection and Shift toggling preserve visible units, with explicit individual selection', () => {
  const a=element('rect',{id:'a',group:'g'}),b=element('rect',{id:'b',group:'g'}),hidden=element('rect',{id:'hidden',group:'g',hidden:true}),c=element('rect',{id:'c'});
  const es=[a,b,hidden,c];assert.deepEqual(chooseSelection(es,[],'a'),['a','b']);
  assert.deepEqual(chooseSelection(es,['c'],'a',true),['c','a','b']);
  assert.deepEqual(chooseSelection(es,['c','a','b'],'b',true),['c']);
  assert.deepEqual(chooseSelection(es,[],'b',false,true),['b']);
  assert.deepEqual(chooseSelection(es,[],'hidden'),['hidden']);
});
test('marquee requires full rotated bounds, treats groups as units and excludes hidden or locked units', () => {
  const es=[element('rect',{id:'a',x:20,y:20,w:40,h:20,rotation:45}),element('rect',{id:'g1',group:'g',x:80,y:20,w:20,h:20}),element('rect',{id:'g2',group:'g',x:110,y:20,w:20,h:20}),element('rect',{id:'locked',x:0,y:0,w:10,h:10,locked:true}),element('rect',{id:'hidden',x:0,y:0,w:10,h:10,hidden:true})];
  assert.deepEqual(marqueeSelection(es,{x:0,y:0,w:100,h:70},[],[],{mode:'contain'}),['a']);
  assert.deepEqual(marqueeSelection(es,{x:0,y:0,w:150,h:70}),['a','g1','g2']);
  assert.deepEqual(marqueeSelection(es,{x:0,y:0,w:150,h:70},['locked']),['locked','a','g1','g2']);
  const groupedLock=[...es,element('rect',{id:'g3',group:'g',locked:true,x:140,y:20,w:10,h:10})];
  assert.deepEqual(marqueeSelection(groupedLock,{x:0,y:0,w:160,h:70}),['a']);
});
test('intersection marquee selects touched groups but does not select their empty space',()=>{
  const es=[element('rect',{id:'a',group:'g',x:20,y:20,w:20,h:20}),element('rect',{id:'b',group:'g',x:180,y:20,w:20,h:20}),element('rect',{id:'pattern',x:0,y:0,w:300,h:200,designPattern:true})];
  assert.deepEqual(marqueeSelection(es,{x:10,y:10,w:15,h:15}),['a','b']);
  assert.deepEqual(marqueeSelection(es,{x:70,y:20,w:60,h:20}),[]);
  assert.deepEqual(marqueeSelection(es,{x:10,y:10,w:40,h:40},[],[],{mode:'contain'}),[]);
  assert.deepEqual(marqueeSelection(es,{x:10,y:10,w:40,h:40},[],[],{individual:true}),['a']);
  assert.deepEqual(marqueeSelection([...es,element('rect',{id:'hidden-lock',group:'g',hidden:true,locked:true})],{x:10,y:10,w:15,h:15}),[]);
});
test('intersection marquee uses transformed rectangles and remains symmetric in both drag directions',()=>{
  const es=[element('rect',{id:'diamond-frame',x:50,y:50,w:100,h:100,rotation:45})];
  assert.deepEqual(marqueeSelection(es,{x:29,y:29,w:5,h:5}),[]);
  assert.deepEqual(marqueeSelection(es,{x:28,y:98,w:8,h:4}),['diamond-frame']);
  assert.deepEqual(marqueeSelection(es,{x:0,y:0,w:200,h:200},[],[],{mode:'contain'}),['diamond-frame']);
});
test('point picking respects stacking, transformed shapes and line distance rather than bounding boxes', () => {
  const es=[element('rect',{id:'back',x:0,y:0,w:100,h:100}),element('rect',{id:'rotated',x:25,y:25,w:50,h:50,rotation:45}),element('ellipse',{id:'ellipse',x:20,y:20,w:60,h:60}),element('rect',{id:'hidden',x:0,y:0,w:100,h:100,hidden:true})];
  assert.deepEqual(hitElements(es,{x:50,y:50}).map(e=>e.id),['ellipse','rotated','back']);
  assert.deepEqual(hitElements(es,{x:22,y:22}).map(e=>e.id),['back']);
  const line=element('line',{x:0,y:0,w:100,h:100,strokeWidth:2});
  assert.equal(hitElements([line],{x:50,y:53},4).length,1);
  assert.equal(hitElements([line],{x:15,y:80},4).length,0);
});
test('thin line resize does not thicken or jump to 20 pixels and transformed selection bounds are exact', () => {
  const line=element('line',{x:10,y:20,w:100,h:1});const patch=resizeFromCorner(line,20,0,'se');assert.equal(patch.h,1);assert.equal(patch.w,120);
  const rotated=element('rect',{x:0,y:0,w:100,h:40,rotation:90});const b=selectionBounds([rotated])!;
  assert.ok(Math.abs(b.x-30)<1e-8&&Math.abs(b.y+30)<1e-8&&Math.abs(b.w-40)<1e-8&&Math.abs(b.h-100)<1e-8);
});

test('shape picking excludes empty corners and follows the visible thin line with a constant tolerance',()=>{
  for(const type of ['ellipse','diamond'] as const){const e=element(type,{x:0,y:0,w:100,h:100});assert.equal(hitElements([e],{x:10,y:85}).length,0);assert.equal(hitElements([e],{x:50,y:50}).length,1);assert.equal(hitElements([{...e,rotation:45,flipX:true}],{x:50,y:50}).length,1);}
  const diagonal=element('line',{x:0,y:0,w:100,h:100,strokeWidth:3});assert.equal(hitElements([diagonal],{x:10,y:85},8).length,0);assert.equal(hitElements([diagonal],{x:50,y:57},8).length,1);
  const thin=element('line',{x:0,y:0,w:100,h:1,strokeWidth:0});assert.equal(hitElements([thin],{x:50,y:.5}).length,1);assert.equal(hitElements([thin],{x:50,y:7},8).length,1);
});

function opposite(e: ReturnType<typeof element>, corner: Corner) {
  const sx = corner.endsWith('e') ? -1 : 1, sy = corner.startsWith('s') ? -1 : 1;
  const a = e.rotation * Math.PI / 180;
  const x = sx * e.w / 2 * (e.flipX ? -1 : 1), y = sy * e.h / 2 * (e.flipY ? -1 : 1);
  return [e.x + e.w / 2 + Math.cos(a) * x - Math.sin(a) * y, e.y + e.h / 2 + Math.sin(a) * x + Math.cos(a) * y];
}
test('all resize corners preserve the opposite anchor under rotation and flips', () => {
  for (const rotation of [0, 37, 90, -120]) for (const flipX of [false, true]) for (const flipY of [false, true]) for (const corner of ['nw', 'ne', 'sw', 'se'] as Corner[]) {
    const e = element('rect', {x: 100, y: 70, w: 240, h: 120, rotation, flipX, flipY});
    const next = {...e, ...resizeFromCorner(e, 38, -17, corner)};
    opposite(e, corner).forEach((n, i) => assert.ok(Math.abs(n - opposite(next, corner)[i]) < 1e-8));
  }
});
test('proportional resize and minimum size keep the anchor fixed', () => {
  const e = element('rect', {x: 100, y: 70, w: 240, h: 120, rotation: 30});
  for (const [dx, dy] of [[40, 100], [-1000, -1000]]) {
    const next = {...e, ...resizeFromCorner(e, dx, dy, 'se', true)};
    assert.ok(next.w >= 20 && next.h >= 20);
    assert.ok(Math.abs(next.w / next.h - 2) < 1e-8);
    opposite(e, 'se').forEach((n, i) => assert.ok(Math.abs(n - opposite(next, 'se')[i]) < 1e-8));
  }
});


test('image frames preserve proportions by default with explicit and temporary overrides', () => {
  const image = element('image', {w: 480, h: 310});
  assert.equal(keepsAspectRatio(image), true);
  assert.equal(keepsAspectRatio(image, true), false);
  assert.equal(keepsAspectRatio({...image, aspectRatioLocked: false}), false);
  assert.equal(keepsAspectRatio({...image, aspectRatioLocked: false}, true), true);
  assert.equal(keepsAspectRatio(element('rect')), false);
  assert.equal(keepsAspectRatio(element('rect'), true), true);
  assert.equal(keepsAspectRatio(element('rect', {aspectRatioLocked: true})), true);
});
test('linked dimensions use each object current proportions and preserve unrelated properties', () => {
  const image = element('image', {w: 480, h: 320, rotation: 37, flipX: true});
  assert.deepEqual(resizedDimensions(image, 'w', 600), {w: 600, h: 400});
  assert.deepEqual(resizedDimensions(image, 'h', 160), {w: 240, h: 160});
  assert.deepEqual(resizedDimensions({...image, aspectRatioLocked: false}, 'h', 160), {h: 160});
  assert.deepEqual(resizedDimensions(element('text', {w: 480, h: 40}), 'w', 600), {w: 600});
  assert.equal(image.rotation, 37); assert.equal(image.w, 480);
});
