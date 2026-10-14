import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element} from '../src/core/model';
import {createContainerTree,descendants,ancestorIds,selectionRoots} from '../src/core/container-tree';
test('container index preserves paint order, legacy parents, hidden membership and nested selection',()=>{
  const s=blankSlide();s.groups=[{id:'outer',name:'Outer'},{id:'inner',name:'Inner',parent:'outer'}];s.elements=[element('rect',{id:'a',group:'inner'}),element('rect',{id:'b',group:'outer',hidden:true}),element('rect',{id:'c',group:'inner',locked:true}),element('rect',{id:'legacy-a',group:'legacy'})];
  const tree=createContainerTree(s);
  for(const g of tree.groups){assert.deepEqual(tree.descendants(g.id),descendants(s,g.id));assert.deepEqual(tree.ancestors(g.id),ancestorIds(s,g.id));}
  for(const e of s.elements)assert.deepEqual(tree.ancestors(e.id),ancestorIds(s,e.id));
  assert.deepEqual(tree.descendants('outer').map(e=>e.id),['a','b','c']);assert.deepEqual(tree.stats.get('outer'),{count:3,visible:2,locked:true});assert.equal(tree.rank.get('outer'),2);assert.deepEqual(selectionRoots(s,['a','c']),['outer']);assert.equal(tree.childGroups.get('outer')![0].id,'inner');
  const changed={...s,elements:s.elements.map(e=>e.id==='a'?{...e,group:'legacy'}:e)};assert.deepEqual(createContainerTree(changed).descendants('outer').map(e=>e.id),['b','c']);assert.deepEqual(tree.descendants('outer').map(e=>e.id),['a','b','c']);
});
