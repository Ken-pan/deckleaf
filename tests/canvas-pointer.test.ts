import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,type SlideElement} from '../src/core/model';
import {canvasMovableIds,canvasHoverTarget,canvasContainerRegions} from '../src/core/canvas-pointer';

const fixture=()=>{const s=blankSlide();s.groups=[{id:'root',name:'Root'},{id:'child',name:'Child',parent:'root'}];s.elements=[element('rect',{id:'a',group:'child'}),element('rect',{id:'b',group:'root',locked:true,hidden:true}),element('text',{id:'other'}),element('rect',{id:'pattern',designPattern:true})];return s;};
test('hover respects a complete container lock, including a hidden locked descendant',()=>{
 const s=fixture();assert.deepEqual([...canvasMovableIds(s,[])],['other']);assert.deepEqual([...canvasMovableIds(s,['a'],'root')],['other']);
});
test('drilled-in and explicit individual selection can move an unlocked child without unlocking its siblings',()=>{
 const s=fixture();assert.deepEqual([...canvasMovableIds(s,[],'','root')],['a','other']);assert.deepEqual([...canvasMovableIds(s,['a'],'a','child')],['a','other']);
 assert.deepEqual([...canvasMovableIds(s,[],'','',true)],['a','other']);assert.equal(s.elements[1].locked,true);
});
test('partial multi-selection only advertises members that its actual move can change',()=>{
 const s=fixture();s.elements[1].hidden=false;assert.deepEqual([...canvasMovableIds(s,['a','b','other'])],['other']);
 assert.deepEqual([...canvasMovableIds(s,['a','other'],'','root')],['a','other']);
});
test('all nine ordinary element types share move eligibility and decorative or hidden objects stay out',()=>{
 const s=blankSlide();s.elements=['text','rect','ellipse','diamond','line','image','table','chart','prototype'].map(type=>element(type as SlideElement['type'],{id:type}));
 assert.deepEqual([...canvasMovableIds(s,[])],s.elements.map(e=>e.id));s.elements[0].locked=true;s.elements[1].hidden=true;s.elements[2].designPattern=true;assert.deepEqual([...canvasMovableIds(s,[])],s.elements.slice(3).map(e=>e.id));
});
test('hover predicts the root, direct nested group or individual layer at each editing level',()=>{
 const s=fixture();assert.equal(canvasHoverTarget(s,'a'),'root');assert.equal(canvasHoverTarget(s,'a','root'),'child');assert.equal(canvasHoverTarget(s,'a','child'),'a');
 assert.equal(canvasHoverTarget(s,'a','root',true),'a');assert.equal(canvasHoverTarget(s,'other','child'),'other');
 s.groups!.push({id:'sibling',name:'Sibling'});s.elements.push(element('rect',{id:'sibling-leaf',group:'sibling'}));
 assert.equal(canvasHoverTarget(s,'sibling-leaf','child'),'sibling');assert.equal(canvasHoverTarget(s,'child','root'),'child');
});
test('container hit regions follow the editing scope and retain auto layout padding',()=>{
 const s=fixture();s.elements[1].locked=false;s.autoLayouts=[{id:'root',name:'Padded layout',x:40,y:60,w:600,h:360,direction:'horizontal',gap:16,padding:{top:40,right:40,bottom:40,left:40},align:'start',justify:'start',columns:1,widthMode:'fixed',heightMode:'fixed',order:['child','b']}];
 const [root]=canvasContainerRegions(s);assert.equal(root.id,'root');assert.deepEqual([root.x,root.y,root.w,root.h],[40,60,600,360]);
 assert.deepEqual(canvasContainerRegions(s,'root',['child']).map(g=>g.id),['child']);assert.deepEqual(canvasContainerRegions(s,'root'),[]);assert.deepEqual(canvasContainerRegions(s,'child'),[]);
 assert.equal(s.autoLayouts[0].padding.left,40);
});
test('empty or decorative containers have no hit region and hidden locks still protect a container',()=>{
 const s=fixture();assert.equal(canvasContainerRegions(s,'',['root'])[0].locked,true);
 s.elements[0].hidden=true;assert.deepEqual(canvasContainerRegions(s,'',['root']),[]);
 s.elements[0].hidden=false;s.elements[0].designPattern=true;assert.deepEqual(canvasContainerRegions(s,'',['root']),[]);
});
test('unselected plain group whitespace is free for marquee; selected group whitespace supports dragging',()=>{
 const s=fixture();s.elements[1].locked=false;assert.deepEqual(canvasContainerRegions(s),[]);
 assert.deepEqual(canvasContainerRegions(s,'',['root']).map(g=>g.id),['root']);
});

test('table sizing keeps finite readable row geometry when font measurement is unavailable',async()=>{
 const {tableRowHeights,fitTableElement}=await import('../src/core/table-fit');
 const e=element('table',{w:300,h:200,fontSize:24,cells:[['Item','Value'],['A','12']],tableFit:{padding:12,minimumFontSize:12}});
 assert.ok(tableRowHeights(e,24,()=>null).every(h=>Number.isFinite(h)&&h>=24*e.lineHeight));
 assert.ok(Number.isFinite(fitTableElement(e,()=>null).fontSize));
});
