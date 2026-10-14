import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasWheel,pagesWithWheel,SlideWheelPager} from '../src/canvas-wheel';
const viewport={width:900,height:600};
const wheel={deltaX:0,deltaY:100,deltaMode:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false};
test('mouse, trackpad and Shift scrolling retain their axes and system direction',()=>{
  assert.deepEqual(canvasWheel(wheel,viewport),{kind:'pan',x:0,y:100});
  assert.deepEqual(canvasWheel({...wheel,deltaX:-24,deltaY:12},viewport),{kind:'pan',x:-24,y:12});
  assert.deepEqual(canvasWheel({...wheel,shiftKey:true},viewport),{kind:'pan',x:100,y:0});
  assert.deepEqual(canvasWheel({...wheel,deltaX:-24,deltaY:12,shiftKey:true},viewport),{kind:'pan',x:-24,y:12});
});
test('Mac Command, Ctrl and trackpad pinch use the same zoom direction',()=>{
  for(const modifier of ['metaKey','ctrlKey'] as const){
    assert.deepEqual(canvasWheel({...wheel,[modifier]:true,deltaY:-25},viewport),{kind:'zoom',delta:-25});
    assert.deepEqual(canvasWheel({...wheel,[modifier]:true},viewport),{kind:'zoom',delta:100});
  }
});
test('line and page wheel units normalize by the appropriate dimension',()=>{
  assert.deepEqual(canvasWheel({...wheel,deltaX:2,deltaY:-3,deltaMode:1},viewport),{kind:'pan',x:32,y:-48});
  assert.deepEqual(canvasWheel({...wheel,deltaX:1,deltaY:-1,deltaMode:2},viewport),{kind:'pan',x:900,y:-600});
  assert.deepEqual(canvasWheel({...wheel,ctrlKey:true,deltaY:-1,deltaMode:2},viewport),{kind:'zoom',delta:-600});
});
test('zero, horizontal-only zoom, Alt and malformed inputs do not claim navigation',()=>{
  assert.equal(canvasWheel({...wheel,deltaY:0},viewport),undefined);
  assert.equal(canvasWheel({...wheel,deltaX:10,deltaY:0,metaKey:true},viewport),undefined);
  assert.equal(canvasWheel({...wheel,altKey:true},viewport),undefined);
  assert.equal(canvasWheel({...wheel,deltaY:NaN},viewport),undefined);
});
test('whole-page vertical scrolling pages; zoom, horizontal scroll and active editing keep their own scope',()=>{
  const pan=canvasWheel(wheel,viewport)!;
  assert.equal(pagesWithWheel(pan,{fits:true,blocked:false,shift:false}),true);
  for(const state of [{fits:false,blocked:false,shift:false},{fits:true,blocked:true,shift:false},{fits:true,blocked:false,shift:true}])assert.equal(pagesWithWheel(pan,state),false);
  assert.equal(pagesWithWheel({kind:'pan',x:100,y:20},{fits:true,blocked:false,shift:false}),false);
  assert.equal(pagesWithWheel({kind:'zoom',delta:100},{fits:true,blocked:false,shift:false}),false);
});
test('a high-resolution wheel gesture accumulates intent and consumes momentum after one page',()=>{
  const pager=new SlideWheelPager();
  assert.equal(pager.take(12,0),0);assert.equal(pager.take(12,16),0);assert.equal(pager.take(16,32),1);
  for(const time of [48,64,96,150,280])assert.equal(pager.take(100,time),0);
  assert.equal(pager.take(100,500),1);
});
test('direction reversal pages back immediately and a reset cannot reuse partial movement',()=>{
  const pager=new SlideWheelPager();
  assert.equal(pager.take(100,0),1);assert.equal(pager.take(-100,40),-1);
  pager.reset();assert.equal(pager.take(20,50),0);pager.reset();assert.equal(pager.take(20,60),0);
  assert.equal(pager.take(NaN,70),0);assert.equal(pager.take(0,80),0);
});
