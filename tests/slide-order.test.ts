import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedSlideOrder,reorderSelectedSlides,moveSelectedSlides} from '../src/core/slide-order';

const order=['a','b','c','d','e'];
test('discontinuous slides move as a stable block with explicit placement',()=>{
  assert.deepEqual(reorderSelectedSlides(order,['d','b','b'],'a'),['b','d','a','c','e']);
  assert.deepEqual(reorderSelectedSlides(order,['b','d'],'e',true),['a','c','e','b','d']);
  assert.deepEqual(reorderSelectedSlides(order,['b','d'],'c'),['a','b','d','c','e']);
  assert.deepEqual(reorderSelectedSlides(order,['b','d'],'d',true),order);
  assert.deepEqual(order,['a','b','c','d','e']);
});
test('keyboard and menu directions use the same block movement and bounded destinations',()=>{
  assert.deepEqual(moveSelectedSlides(order,['b','d'],'earlier'),['b','d','a','c','e']);
  assert.deepEqual(moveSelectedSlides(order,['b','d'],'later'),['a','c','e','b','d']);
  assert.deepEqual(moveSelectedSlides(order,['b','d'],'start'),['b','d','a','c','e']);
  assert.deepEqual(moveSelectedSlides(order,['b','d'],'end'),['a','c','e','b','d']);
  assert.deepEqual(moveSelectedSlides(order,['a','c'],'start'),['a','c','b','d','e']);
  assert.deepEqual(moveSelectedSlides(order,['c','e'],'end'),['a','b','d','c','e']);
  assert.deepEqual(moveSelectedSlides(order,['a','c'],'earlier'),order);
  assert.deepEqual(moveSelectedSlides(order,['c','e'],'later'),order);
  assert.deepEqual(moveSelectedSlides(order,order,'end'),order);
  assert.deepEqual(moveSelectedSlides(order,[],'earlier'),order);
  assert.throws(()=>selectedSlideOrder(order,['stale']),/no longer exists/);
  assert.throws(()=>reorderSelectedSlides(order,['a'],'stale'),/destination slide/);
});
test('every selection and drop preserves the page permutation and both internal orders',()=>{
  for(let mask=1;mask<32;mask++){
    const ids=order.filter((_,i)=>mask&(1<<i)),selected=new Set(ids);
    for(const target of order)for(const after of [false,true]){
      const result=reorderSelectedSlides(order,ids,target,after);
      assert.deepEqual([...result].sort(),[...order].sort());
      assert.deepEqual(result.filter(id=>selected.has(id)),ids);
      assert.deepEqual(result.filter(id=>!selected.has(id)),order.filter(id=>!selected.has(id)));
    }
  }
});
