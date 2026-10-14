import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDeck,blankSlide,element} from '../src/core/model';
import {createContainerTree} from '../src/core/container-tree';
import {layerRangeSelection,renameLayerOperations,type LayerRow} from '../src/core/layer-browser';
import {documentStylePreview} from '../src/core/document-style-preview';
import {applyDeckDesignSystem,deckDesignSystem} from '../src/core/deck-design-system';
import {applyOperations} from '../src/core/operations';

test('range selection uses visible order, collapsed group contents and no duplicate members',()=>{
 const slide=blankSlide();slide.groups=[{id:'g',name:'Group'}];slide.elements=[element('rect',{id:'a',group:'g'}),element('rect',{id:'b',group:'g',hidden:true}),element('rect',{id:'c'})];const tree=createContainerTree(slide);
 const rows:LayerRow[]=[{id:'g',depth:0,group:slide.groups[0]},{id:'a',depth:1,layer:slide.elements[0]},{id:'c',depth:0,layer:slide.elements[2]}];
 assert.deepEqual(layerRangeSelection(rows,'g','c',tree),['a','c']);assert.deepEqual(layerRangeSelection(rows,'c','g',tree),['a','c']);assert.deepEqual(layerRangeSelection(rows,'missing','c',tree),['c']);
});
test('rename operations preserve group membership, support undo snapshots, and protect locked objects',()=>{
 const slide=blankSlide();slide.groups=[{id:'g',name:'Group'}];slide.elements=[element('rect',{id:'a',group:'g'}),element('rect',{id:'locked',locked:true})];const deck=newDeck('Layers',[slide]),tree=createContainerTree(slide),before=JSON.stringify(deck);
 const next=applyOperations(deck,renameLayerOperations(slide.id,'g',' Renamed ',tree));assert.equal(next.slides[0].groups![0].name,'Renamed');assert.equal(next.slides[0].elements[0].group,'g');assert.equal(JSON.stringify(deck),before);
 assert.deepEqual(renameLayerOperations(slide.id,'locked','Changed',tree),[]);assert.deepEqual(renameLayerOperations(slide.id,'a','  ',tree),[]);
});
test('draft preview styles at most three pages, matches full apply there, and shares untouched pages',()=>{
 const slides=Array.from({length:80},(_,i)=>{const s=blankSlide();s.elements=[element('text',{id:'text-'+i,text:'Body',design:{text:'body'}})];return s;}),base=newDeck('Large document',slides),system=structuredClone(deckDesignSystem(base));system.colors.ink='#112233';system.typography.body.fontSize=45;
 const before=JSON.stringify(base),preview=documentStylePreview(base,system,40),full=applyDeckDesignSystem(base,system);
 const changed=preview.slides.flatMap((s,i)=>s!==base.slides[i]?[i]:[]);assert.deepEqual(changed,[39,40,41]);for(const i of changed)assert.deepEqual(preview.slides[i],full.slides[i]);assert.equal(JSON.stringify(base),before);
 assert.equal(documentStylePreview(base,system,0).slides.filter((s,i)=>s!==base.slides[i]).length,3);assert.equal(documentStylePreview(base,system,79).slides.filter((s,i)=>s!==base.slides[i]).length,2);
});

test('renaming auto layout updates both names in one atomic transaction',()=>{
 const slide=blankSlide();slide.groups=[{id:'g',name:'Group'}];slide.elements=[element('rect',{id:'a',group:'g'})];slide.autoLayouts=[{id:'g',name:'Row',direction:'horizontal',gap:8,padding:{top:0,right:0,bottom:0,left:0},align:'start',justify:'start',columns:1,x:96,y:200,w:500,h:100,widthMode:'fixed',heightMode:'fixed',order:['a']}];const deck=newDeck('Auto layout',[slide]);
 const ops=renameLayerOperations(slide.id,'g','New row',createContainerTree(slide)),after=applyOperations(deck,ops);assert.equal(ops.length,2);assert.equal(after.slides[0].groups![0].name,'New row');assert.equal(after.slides[0].autoLayouts![0].name,'New row');assert.equal(deck.slides[0].autoLayouts![0].name,'Row');
});
test('adoption is resolved against original rules before rendering the preview window',()=>{
 const slides=Array.from({length:8},()=>{const s=blankSlide();s.elements=[element('text',{fontFamily:'Manrope',fontSize:32,fill:'#26362c'}),element('text',{fontSize:17,fontFamily:'Georgia',fill:'#ff00aa'})];return s;}),base=newDeck('Adopt',[...slides]);
 const previous=deckDesignSystem(base),next=structuredClone(previous);next.typography.body.fontFamily='Inter';next.colors.ink='#112233';const adopted=applyDeckDesignSystem(base,previous,true),preview=documentStylePreview(adopted,next,4),full=applyDeckDesignSystem(base,next,true);
 for(const i of [3,4,5])assert.deepEqual(preview.slides[i],full.slides[i]);assert.equal(preview.slides[4].elements.find(e=>e.fontFamily==='Georgia')!.fill,'#ff00aa');
});
