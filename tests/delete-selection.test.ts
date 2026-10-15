import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {deleteSelection} from '../src/core/delete-selection';
import {applyOperations} from '../src/core/operations';
import {individualSelectionScope} from '../src/core/container-tree';

function fixture(){
  const slide=blankSlide();
  slide.groups=[{id:'group',name:'Group'},{id:'nested',name:'Nested',parent:'group'}];
  slide.elements=[element('rect',{id:'visible',group:'group'}),element('rect',{id:'hidden',group:'nested',hidden:true}),element('text',{id:'outside',text:'Keep me'})];
  return slide;
}
test('deleting a complete visible group also deletes hidden nested members and cleans wrappers',()=>{
  const slide=fixture(),before=newDeck('Delete',[slide]),saved=structuredClone(before);
  const plan=deleteSelection(slide,['visible']);
  assert.equal(plan.blocked,0);
  assert.deepEqual(plan.operations.map(op=>'elementId' in op?op.elementId:''),['visible','hidden']);
  const after=applyOperations(before,plan.operations);
  assert.deepEqual(after.slides[0].elements.map(e=>e.id),['outside']);
  assert.equal(after.slides[0].groups?.length??0,0);
  assert.deepEqual(before,saved);
});
test('a locked hidden descendant protects the whole group while independent objects can be deleted',()=>{
  const slide=fixture();slide.elements[1].locked=true;
  const plan=deleteSelection(slide,['visible','outside']);
  assert.equal(plan.blocked,2);
  assert.deepEqual(plan.operations,[{op:'delete_element',slideId:slide.id,elementId:'outside'}]);
  const after=applyOperations(newDeck('Locked',[slide]),plan.operations);
  assert.deepEqual(after.slides[0].elements,slide.elements.slice(0,2));
});
test('individual selection deletes only that member and preserves hidden siblings',()=>{
  const slide=fixture(),plan=deleteSelection(slide,['visible'],individualSelectionScope);
  assert.deepEqual(plan.operations,[{op:'delete_element',slideId:slide.id,elementId:'visible'}]);
  const after=applyOperations(newDeck('Individual',[slide]),plan.operations);
  assert.deepEqual(after.slides[0].elements.map(e=>e.id),['hidden','outside']);
});
test('locked-only and empty selections produce no transaction',()=>{
  const slide=fixture();slide.elements[2].locked=true;
  assert.deepEqual(deleteSelection(slide,['outside']),{operations:[],blocked:1});
  assert.deepEqual(deleteSelection(slide,[]),{operations:[],blocked:0});
});
