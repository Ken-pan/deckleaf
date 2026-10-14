import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createPlaybackGestures } from '../src/core/player-gestures';

test('mobile gestures share direction, exclude prototype controls and suppress swipe clicks', () => {
  const directions:number[]=[], gestures=createPlaybackGestures(n=>directions.push(n),()=>{});
  const event=(x:number,y:number,patch:Record<string,unknown>={})=>({clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true,target:{closest:()=>null},currentTarget:{},...patch}) as unknown as PointerEvent;
  gestures.pointerdown(event(200,100));gestures.pointerup(event(100,110));gestures.click(event(100,110) as unknown as MouseEvent);assert.deepEqual(directions,[1]);
  gestures.pointerdown(event(100,100));gestures.pointerup(event(230,105));assert.deepEqual(directions,[1,-1]);
  gestures.pointerdown(event(100,100));gestures.pointerup(event(120,240));
  gestures.pointerdown(event(200,100));gestures.pointercancel();gestures.pointerup(event(20,100));
  gestures.pointerdown(event(200,100,{target:{closest:()=>({})}}));gestures.pointerup(event(20,100));
  gestures.pointerdown(event(200,100));gestures.pointerdown(event(220,100,{isPrimary:false,pointerId:2}));gestures.pointerup(event(20,100));
  gestures.pointerdown(event(200,100));gestures.pointerup(event(20,100,{pointerId:2}));assert.deepEqual(directions,[1,-1]);
});
test('gesture factory runs verbatim in downloaded HTML and ordinary clicks remain immediate', () => {
  const factory=runInNewContext(`(${createPlaybackGestures.toString()})`,{__name:(f:Function)=>f});let moves=0,focuses=0;
  const gestures=factory(()=>moves++,()=>focuses++),ev={target:{closest:()=>null},currentTarget:{}};
  gestures.click(ev);assert.equal(moves,1);assert.equal(focuses,1);
  gestures.click({...ev,defaultPrevented:true});gestures.click({...ev,target:{closest:()=>({})}});assert.equal(moves,1);
});
test('short drags, a returning finger, long holds and cancellation never become a tap',()=>{
  const directions:number[]=[],gestures=createPlaybackGestures(n=>directions.push(n),()=>{});
  const event=(x:number,y:number,timeStamp:number,patch={})=>({clientX:x,clientY:y,timeStamp,pointerId:1,pointerType:'touch',isPrimary:true,detail:1,target:{closest:()=>null},currentTarget:{},...patch}) as unknown as PointerEvent;
  for(const [dx,dy] of [[30,0],[2,30],[0,0]]){
    gestures.pointerdown(event(100,100,0));gestures.pointermove(event(100+dx,100+dy,100));gestures.pointerup(event(100+dx,100+dy,600));gestures.click(event(100+dx,100+dy,600) as unknown as MouseEvent);
  }
  gestures.pointerdown(event(100,100,0));gestures.pointermove(event(130,100,20));gestures.pointerup(event(100,100,50));gestures.click(event(100,100,50) as unknown as MouseEvent);
  gestures.pointerdown(event(100,100,0));gestures.pointercancel();gestures.click(event(100,100,20) as unknown as MouseEvent);
  assert.deepEqual(directions,[]);
  gestures.pointerdown(event(100,100,800));gestures.pointerup(event(100,100,900));gestures.click(event(100,100,900) as unknown as MouseEvent);assert.deepEqual(directions,[1]);
  gestures.pointerdown(event(200,100,1000));gestures.pointermove(event(180,100,1100));gestures.pointerup(event(100,100,1800));gestures.click(event(100,100,1800) as unknown as MouseEvent);assert.deepEqual(directions,[1,1]);
});
