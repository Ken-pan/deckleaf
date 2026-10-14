import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,validateDeck,type GroupLayout} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {groupExitOptions} from '../src/core/group-exit';
import {editingSelectionScope,individualSelectionScope} from '../src/core/container-tree';

const flow=(id:string,order:string[],patch:Partial<GroupLayout>={}):GroupLayout=>({id,name:id,order,x:100,y:100,w:600,h:240,direction:'horizontal',gap:20,padding:{top:20,right:20,bottom:20,left:20},align:'start',justify:'start',columns:2,widthMode:'fixed',heightMode:'fixed',...patch});
function fixture(){
  const s=blankSlide();s.id='s';s.groups=[{id:'outer',name:'Outer'},{id:'inner',name:'Inner',parent:'outer'}];
  s.elements=[element('rect',{id:'a',group:'inner',x:180,y:220,w:120,h:100}),element('text',{id:'b',group:'inner',x:320,y:220,w:220,h:100,fontSize:24,text:'Keep source text',textSizing:'fixed'}),element('rect',{id:'hidden',group:'inner',hidden:true,x:80,y:600,w:30,h:30}),element('rect',{id:'c',group:'outer',x:800,y:220,w:180,h:100}),element('rect',{id:'outside',x:1000,y:500,w:150,h:100})];
  s.source={provider:'Fixture',fidelity:'converted',render:'data:image/png;base64,iVBORw0KGgo=',warnings:[]};return newDeck('Exit group',[s]);
}
test('moving a member out one level retains geometry, content, hidden siblings and provenance',()=>{
  const d=fixture(),s=d.slides[0],before=structuredClone(d),options=groupExitOptions(s,['b'],'b');
  assert(options.available&&options.nested);assert.equal(options.out.parent,'outer');
  const next=applyOperations(d,options.out.operations);const b=next.slides[0].elements.find(e=>e.id==='b')!;
  assert.deepEqual(b,{...s.elements[1],group:'outer'});assert.deepEqual(next.slides[0].elements.find(e=>e.id==='hidden'),s.elements[2]);
  assert.deepEqual(next.slides[0].source,s.source);assert.deepEqual(d,before);assert.equal(next.revision,d.revision+1);validateDeck(next);
});
test('moving a nested container to Slide preserves its whole subtree and independent layout frame',()=>{
  let d=fixture();d=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:flow('inner',['a','b','hidden'],{x:180,y:220,w:380,h:140})}]);
  const s=d.slides[0],options=groupExitOptions(s,['a','b'],'inner'),next=applyOperations(d,options.slide.operations).slides[0];
  assert.equal(next.groups!.find(g=>g.id==='inner')!.parent,undefined);assert.equal(next.groups!.find(g=>g.id==='outer')!.parent,undefined);
  assert.deepEqual(next.autoLayouts,s.autoLayouts);assert.deepEqual(next.elements.find(e=>e.id==='b'),s.elements.find(e=>e.id==='b'));assert.deepEqual(next.elements.find(e=>e.id==='hidden'),s.elements.find(e=>e.id==='hidden'));
  assert.equal(next.elements.length,s.elements.length);assert.equal(options.slide.ids.length,1);
});
test('leaving Auto layout preserves the allocated Fill size and reflows only remaining members',()=>{
  let d=fixture();d.slides[0].groups![1].parent=undefined;d.slides[0].elements[0].layoutItem={widthMode:'fill',heightMode:'fixed',basisW:120};
  d=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:flow('inner',['a','b','hidden'])}]);const s=d.slides[0],old=s.elements.find(e=>e.id==='a')!,options=groupExitOptions(s,['a'],'a');
  const next=applyOperations(d,options.out.operations).slides[0],a=next.elements.find(e=>e.id==='a')!,b=next.elements.find(e=>e.id==='b')!;
  assert.equal(a.group,undefined);assert.equal(a.layoutItem,undefined);assert.deepEqual([a.x,a.y,a.w,a.h],[old.x,old.y,old.w,old.h]);
  assert.deepEqual(next.autoLayouts![0].order,['b','hidden']);assert.equal(b.x,120);assert.equal(b.fontSize,24);assert.deepEqual(next.elements.find(e=>e.id==='hidden'),s.elements.find(e=>e.id==='hidden'));
});
test('selecting all direct members lifts those members and cleans only their empty wrapper',()=>{
  const d=fixture(),s=d.slides[0];s.elements=s.elements.filter(e=>e.id!=='hidden');
  const options=groupExitOptions(s,['a','b'],editingSelectionScope('inner'));assert.deepEqual(options.out.ids.sort(),['a','b']);
  const next=applyOperations(d,options.out.operations);assert(!next.slides[0].groups!.some(g=>g.id==='inner'));assert(next.slides[0].groups!.some(g=>g.id==='outer'));assert(next.slides[0].elements.filter(e=>['a','b'].includes(e.id)).every(e=>e.group==='outer'));validateDeck(next);
});
test('locked selections, hidden locked subtrees and locked affected flows block exit atomically',()=>{
  const d=fixture(),s=d.slides[0];s.elements[2].locked=true;
  assert.match(groupExitOptions(s,['a','b'],'inner').out.reason!,/Unlock/);
  assert.equal(groupExitOptions(s,['a'],'a').out.reason,undefined);
  s.autoLayouts=[flow('inner',['a','b','hidden'])];const before=structuredClone(s),options=groupExitOptions(s,['a'],'a');
  assert.match(options.out.reason!,/Unlock/);assert.deepEqual(options.out.operations,[]);assert.deepEqual(s,before);
});
test('mixed parent selections offer Move to slide, while top-level selections offer no exit command',()=>{
  const d=fixture(),s=d.slides[0],mixed=groupExitOptions(s,['a','c'],individualSelectionScope);
  assert(mixed.available&&mixed.showSlide);assert.match(mixed.out.reason!,/one group/);assert.equal(mixed.slide.reason,undefined);
  const next=applyOperations(d,mixed.slide.operations).slides[0];assert(next.elements.filter(e=>['a','c'].includes(e.id)).every(e=>!e.group));
  assert.equal(groupExitOptions(s,['outside'],'outside').available,false);assert.equal(groupExitOptions(s,['a','b','c'],'outer').available,false);
});
