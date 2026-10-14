import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,validateDeck} from '../src/core/model';
import {pageLayout,contentBounds,columnBounds,pageLayoutOperations} from '../src/core/page-layout';
import {applyOperations} from '../src/core/operations';
import {alignElements,arrangementUnits,distributeElements} from '../src/core/arrangement-operations';
import {selectionBounds} from '../src/core/interactions';
const config={margins:{top:60,right:120,bottom:80,left:100},columns:3,gutter:20};
test('legacy documents open with derived guides without adding layout fields or changing content',()=>{
 const d=newDeck('Legacy',[blankSlide()],1000,700),before=JSON.stringify(d);assert.equal(pageLayout(d,d.slides[0]).columns,1);assert.equal(JSON.stringify(d),before);assert.equal(d.slides[0].layout,undefined);
});
test('asymmetric margins and columns produce precise content geometry',()=>{
 const d=newDeck('Layout',[blankSlide()],1000,700);d.slides[0].layout=config;
 assert.deepEqual(contentBounds(d,d.slides[0]),{x:100,y:60,w:780,h:560});const columns=columnBounds(d,d.slides[0]);assert.equal(columns.length,3);assert.equal(columns[0].w,740/3);assert.ok(Math.abs(columns[2].x+columns[2].w-880)<.0001);
});
test('page settings apply atomically to all pages without moving content or modifying source evidence',()=>{
 const s=blankSlide();s.elements=[element('text',{text:'Source preserved'})];s.source={provider:'Fixture',fidelity:'native',warnings:['Original']};const d=newDeck('Deck',[s,blankSlide()],1000,700),before=structuredClone(d);
 const next=applyOperations(d,pageLayoutOperations(d,s.id,config,true));assert.equal(next.revision,d.revision+1);assert.deepEqual(next.slides[0].elements,before.slides[0].elements);assert.deepEqual(next.slides[0].source,before.slides[0].source);assert.ok(next.slides.every(s=>JSON.stringify(s.layout)===JSON.stringify(config)));
 assert.deepEqual(validateDeck(JSON.parse(JSON.stringify(next))).slides[0].layout,config);assert.equal(pageLayoutOperations(next,s.id,config,true).length,0);
});
test('invalid margin and gutter operations reject atomically in the shared manual/AI transaction path',()=>{
 const d=newDeck('Deck',[blankSlide()],1000,700),before=JSON.stringify(d),id=d.slides[0].id;
 for(const value of [{...config,margins:{...config.margins,left:1000}},{...config,gutter:500},{...config,columns:1.5}])assert.throws(()=>applyOperations(d,[{op:'update_slide',slideId:id,patch:{layout:value}}] as any,d.revision,'ai'));
 assert.equal(JSON.stringify(d),before);assert.throws(()=>pageLayoutOperations(d,id,{...config,gutter:500}));
});
test('alignment respects visible transformed bounds and explicitly chosen page/content/selection reference',()=>{
 const s=blankSlide();s.layout=config;s.elements=[element('rect',{id:'one',x:200,y:200,w:120,h:40,rotation:45}),element('rect',{id:'two',x:400,y:300,w:100,h:80})];const d=newDeck('Align',[s],1000,700);
 let next=applyOperations(d,alignElements(d,s.id,['one'],'left','content'));assert.ok(Math.abs(selectionBounds([next.slides[0].elements[0]])!.x-100)<.001);
 next=applyOperations(d,alignElements(d,s.id,['two'],'right','page'));assert.equal(next.slides[0].elements[1].x,900);
 next=applyOperations(d,alignElements(d,s.id,['one','two'],'top','selection'));assert.ok(Math.abs(selectionBounds([next.slides[0].elements[0]])!.y-next.slides[0].elements[1].y)<.001);
});
test('group alignment translates every member while preserving relative offsets; locked/hidden elements stay fixed',()=>{
 const s=blankSlide();s.layout=config;s.elements=[element('rect',{id:'a',group:'g',x:200,y:200,w:100,h:80}),element('rect',{id:'b',group:'g',x:350,y:220,w:100,h:80}),element('rect',{id:'locked',x:600,y:200,locked:true}),element('rect',{id:'hidden',x:700,y:200,hidden:true})];const d=newDeck('Groups',[s],1000,700),ids=s.elements.map(e=>e.id);
 assert.equal(arrangementUnits(d,s.id,ids).length,1);const next=applyOperations(d,alignElements(d,s.id,ids,'left','content'));assert.equal(next.slides[0].elements[0].x,100);assert.equal(next.slides[0].elements[1].x,250);assert.equal(next.slides[0].elements[2].x,600);assert.equal(next.slides[0].elements[3].x,700);
});
test('equal-gap distribution supports unequal sizes and groups without moving the first and last units',()=>{
 const s=blankSlide();s.elements=[element('rect',{id:'a',x:100,y:200,w:80,h:80}),element('rect',{id:'b1',group:'g',x:270,y:200,w:60,h:80}),element('rect',{id:'b2',group:'g',x:350,y:200,w:40,h:80}),element('rect',{id:'c',x:600,y:200,w:100,h:80})];const d=newDeck('Distribute',[s],1000,700),ids=s.elements.map(e=>e.id),next=applyOperations(d,distributeElements(d,s.id,ids,'x'));
 assert.equal(next.slides[0].elements[0].x,100);assert.equal(next.slides[0].elements[3].x,600);assert.equal(next.slides[0].elements[2].x-next.slides[0].elements[1].x,80);
 const units=arrangementUnits(next,s.id,ids);assert.equal(units[1].bounds.x-units[0].bounds.x-units[0].bounds.w,units[2].bounds.x-units[1].bounds.x-units[1].bounds.w);
});
test('already aligned units make no extra operation and impossible spacing does not force overlap',()=>{
 const s=blankSlide();s.elements=[element('rect',{id:'a',x:0,y:0,w:300,h:80}),element('rect',{id:'b',x:100,y:0,w:300,h:80}),element('rect',{id:'c',x:200,y:0,w:300,h:80})];const d=newDeck('Overlap',[s]);assert.equal(alignElements(d,s.id,['a','b','c'],'top','selection').length,0);assert.throws(()=>distributeElements(d,s.id,['a','b','c'],'x'));assert.deepEqual(distributeElements(d,s.id,['a','b'],'x'),[]);
});
