import {test} from 'node:test';
import assert from 'node:assert/strict';
import {touchFrame,touchZoom} from '../src/core/touch-navigation';

test('two-finger navigation shares a midpoint and scale independent of pointer order',()=>{
  const a={x:80,y:160},b={x:200,y:320};
  assert.deepEqual(touchFrame([a,b]),{x:140,y:240,distance:200});
  assert.deepEqual(touchFrame([b,a]),touchFrame([a,b]));
  assert.equal(touchZoom(.25,200,400),.5);
  assert.equal(touchZoom(.5,200,100),.25);
});
test('touch zoom uses the same bounds as canvas controls and stays finite for coincident contacts',()=>{
  assert.equal(touchZoom(1,100,1000),4);
  assert.equal(touchZoom(1,100,1),.1);
  assert.equal(touchZoom(.5,0,0),.1);
  assert.deepEqual(touchFrame([{x:10,y:20}]),{x:10,y:20,distance:0});
});
