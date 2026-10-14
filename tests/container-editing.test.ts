import {test} from 'node:test';import assert from 'node:assert/strict';
import {blankSlide,element} from '../src/core/model';import {selectionTarget,selectionRoots,groupMarquee} from '../src/core/container-tree';
const fixture=()=>{const s=blankSlide();s.groups=[{id:'outer',name:'Outer'},{id:'child',name:'Child',parent:'outer'}];s.elements=[element('rect',{id:'a',group:'child',x:100,y:100,w:80,h:50}),element('rect',{id:'b',group:'child',x:220,y:100,w:80,h:50}),element('rect',{id:'c',group:'outer',x:100,y:220,w:200,h:50}),element('rect',{id:'hidden',group:'child',hidden:true,x:40,y:40,w:20,h:20})];return s;};
test('direct editing targets descend exactly one container while explicit leaves remain independent',()=>{const s=fixture();assert.equal(selectionTarget(s,'a'),'outer');assert.equal(selectionTarget(s,'a','outer'),'child');assert.equal(selectionTarget(s,'a','child'),'a');assert.equal(selectionTarget(s,'a','outer',true),'a');assert.equal(selectionTarget(s,'child','outer'),'child');s.elements[1].hidden=true;assert.deepEqual(selectionRoots(s,['a'],'a'),['a']);assert.deepEqual(selectionRoots(s,['a'],'child'),['child']);});
test('a marquee inside a group selects direct leaves or touched child containers without escaping to the outer root',()=>{const s=fixture();assert.deepEqual(groupMarquee(s,'child',{x:90,y:90,w:100,h:70}),['a']);assert.deepEqual(groupMarquee(s,'outer',{x:90,y:90,w:220,h:70}),['a','b']);assert.deepEqual(groupMarquee(s,'',{x:90,y:90,w:220,h:70}),['a','b','c']);assert.deepEqual(groupMarquee(s,'',{x:90,y:90,w:220,h:70},[],{mode:'contain'}),[]);assert.deepEqual(groupMarquee(s,'child',{x:90,y:90,w:1000,h:1000}),['a','b']);s.elements[1].locked=true;assert.deepEqual(groupMarquee(s,'outer',{x:90,y:90,w:220,h:70}),[]);});
test('deep marquee keeps explicitly selected leaves independent and additive selection preserves its base',async()=>{
  const s=fixture();s.elements.push(element('rect',{id:'outside',x:500,y:300,w:30,h:30}));
  assert.deepEqual(groupMarquee(s,'',{x:90,y:90,w:220,h:70},[],{individual:true}),['a','b']);
  assert.deepEqual(selectionRoots(s,['a','b'],'@leaves'),['a','b']);
  assert.deepEqual(groupMarquee(s,'child',{x:90,y:90,w:100,h:70},['outside']),['outside','a']);
  const {selectionMembers}=await import('../src/core/selection-transform');
  assert.deepEqual(selectionMembers(s,['a','b'],false,'@leaves').map(e=>e.id),['a','b']);
  s.elements.find(e=>e.id==='hidden')!.locked=true;
  assert.deepEqual(groupMarquee(s,'',{x:90,y:90,w:220,h:70}),[]);
  assert.deepEqual(groupMarquee(s,'',{x:90,y:90,w:220,h:70},[],{individual:true}),['a','b']);
});
