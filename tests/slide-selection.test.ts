import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedSlideSelection,selectSlideRange} from '../src/core/slide-selection';

const order=['a','b','c','d','e'];
test('slide selection toggles discontinuous pages and follows deck order without duplicates',()=>{
  let selection={ids:['a'],anchor:'a'};
  selection=selectSlideRange(order,selection,'e',{toggle:true});
  selection=selectSlideRange(order,selection,'c',{toggle:true});
  assert.deepEqual(selection,{ids:['a','c','e'],anchor:'c'});
  selection=selectSlideRange(order,selection,'c',{toggle:true});
  assert.deepEqual(selection.ids,['a','e']);
  assert.deepEqual(orderedSlideSelection(['e','c','a'],['a','e','a','missing']),['e','a']);
});
test('range selection keeps its anchor when extending, shrinking and reversing',()=>{
  let selection={ids:['c'],anchor:'c'};
  selection=selectSlideRange(order,selection,'e',{range:true});assert.deepEqual(selection.ids,['c','d','e']);
  selection=selectSlideRange(order,selection,'d',{range:true});assert.deepEqual(selection.ids,['c','d']);
  selection=selectSlideRange(order,selection,'a',{range:true});assert.deepEqual(selection.ids,['a','b','c']);assert.equal(selection.anchor,'c');
  assert.deepEqual(selectSlideRange(order,{ids:['e'],anchor:'b'},'c',{range:true,additive:true}).ids,['b','c','e']);
  assert.deepEqual(selectSlideRange(order,{ids:['a'],anchor:'missing'},'d',{range:true}),{ids:['d'],anchor:'d'});
});
test('ordinary selection replaces a batch and stale targets cannot select absent pages',()=>{
  assert.deepEqual(selectSlideRange(order,{ids:['a','c'],anchor:'a'},'b'),{ids:['b'],anchor:'b'});
  assert.deepEqual(selectSlideRange(order,{ids:['a','missing'],anchor:'a'},'missing'),{ids:['a'],anchor:'a'});
});
