import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck,validateDeck} from '../src/core/model';
import {createGroupLayout,groupElements} from '../src/core/group-commands';
import {resolveGroupLayouts} from '../src/core/object-layout';
import {applyOperations,moveElements} from '../src/core/operations';
import {diffProposal} from '../src/core/proposal-copy';
import {resolveSlideTextSizing,resolveDeckTextSizingAsync} from '../src/core/text-layout';
import {sameDocumentData} from '../src/core/document-data';
function fixture() {
  const slide=blankSlide();slide.elements=[element('rect',{id:'a',name:'A',x:100,y:80,w:100,h:40}),element('rect',{id:'b',name:'B',x:250,y:100,w:60,h:80}),element('rect',{id:'c',name:'C',x:400,y:90,w:80,h:30})];
  const original=newDeck('Layout',[slide]);const operations=createGroupLayout(slide,['a','b','c']);
  // Packing/movement cases use a deliberate 24 px rule. Default flow inference
  // is verified separately so an inferred gap does not change their fixture.
  for(const op of operations)if(op.op==='set_group_layout')op.layout={...op.layout,gap:24,align:'start'};
  const deck=applyOperations(original,operations);return {deck,original,slideId:slide.id};
}
test('new auto layouts infer spacing from the authored objects',()=>{
  const {original}=fixture(),slide=original.slides[0];
  const next=applyOperations(original,createGroupLayout(slide,['a','b','c']));
  assert.equal(next.slides[0].autoLayouts![0].gap,70);
  assert.deepEqual(next.slides[0].elements.map(e=>e.x),[100,270,400]);
  assert.equal(original.slides[0].elements[1].x,250);
});
test('auto layout groups objects atomically in reading order without changing content',()=>{
  const {deck,original}=fixture(),s=deck.slides[0],l=s.autoLayouts![0];
  assert.equal(deck.revision,1);assert.deepEqual(l.order,['a','b','c']);assert.deepEqual(s.elements.map(e=>[e.x,e.y]),[[100,80],[224,80],[308,80]]);assert.equal(l.w,288);assert.equal(l.h,80);
  assert(s.elements.every(e=>e.group===l.id));assert(original.slides[0].elements.every(e=>!e.group));assert.equal(sameDocumentData(validateDeck(JSON.parse(JSON.stringify(deck))),deck),true);
  assert.equal(resolveGroupLayouts(s),s);
});
test('column padding and cross-axis alignment update hug bounds and rotated object bounds',()=>{
  const {deck,slideId}=fixture(),l=deck.slides[0].autoLayouts![0];
  const next=applyOperations(deck,[{op:'set_group_layout',slideId,layout:{...l,direction:'vertical',gap:10,padding:{top:12,right:14,bottom:16,left:18},align:'center'}}]);
  assert.deepEqual(next.slides[0].elements.map(e=>[e.x,e.y]),[[118,92],[138,142],[128,232]]);assert.equal(next.slides[0].autoLayouts![0].w,132);assert.equal(next.slides[0].autoLayouts![0].h,198);
  const rotated=applyOperations(next,[{op:'update_element',slideId,elementId:'a',patch:{rotation:90}}]);assert.equal(rotated.slides[0].autoLayouts![0].w,112);assert.equal(rotated.slides[0].elements[1].y,202);
});
test('grid uses consistent tracks and reflows after a member resize',()=>{
  const {deck,slideId}=fixture(),l=deck.slides[0].autoLayouts![0];
  const grid=applyOperations(deck,[{op:'set_group_layout',slideId,layout:{...l,direction:'grid',gap:10,columns:2}}]);assert.deepEqual(grid.slides[0].elements.map(e=>[e.x,e.y]),[[100,80],[210,80],[100,170]]);
  const resized=applyOperations(grid,[{op:'update_element',slideId,elementId:'a',patch:{w:200,h:120}}]);assert.deepEqual(resized.slides[0].elements.map(e=>[e.x,e.y]),[[100,80],[310,80],[100,210]]);assert.equal(resized.slides[0].autoLayouts![0].w,270);
});
test('fixed main size supports packing and space between while hug stays content-sized',()=>{
  const {deck,slideId}=fixture(),l=deck.slides[0].autoLayouts![0];
  const fixed=applyOperations(deck,[{op:'set_group_layout',slideId,layout:{...l,widthMode:'fixed',w:400,justify:'space-between'}}]);assert.deepEqual(fixed.slides[0].elements.map(e=>e.x),[100,280,420]);
  const center=applyOperations(fixed,[{op:'set_group_layout',slideId,layout:{...fixed.slides[0].autoLayouts![0],justify:'center'}}]);assert.equal(center.slides[0].elements[0].x,156);
});
test('hide, show, add, remove, and regroup maintain order and clean up empty groups',()=>{
  const {deck,slideId}=fixture(),l=deck.slides[0].autoLayouts![0];
  const hidden=applyOperations(deck,[{op:'update_element',slideId,elementId:'b',patch:{hidden:true}}]);assert.equal(hidden.slides[0].elements[2].x,224);assert.deepEqual(hidden.slides[0].autoLayouts![0].order,['a','b','c']);
  const added=applyOperations(hidden,[{op:'add_element',slideId,element:element('rect',{id:'d',group:l.id,w:50,h:20})}]);assert.deepEqual(added.slides[0].autoLayouts![0].order,['a','b','c','d']);assert.equal(added.slides[0].elements[3].x,328);
  const shown=applyOperations(added,[{op:'update_element',slideId,elementId:'b',patch:{hidden:false}}]);assert.equal(shown.slides[0].elements[3].x,412);
  const removed=applyOperations(shown,[{op:'delete_element',slideId,elementId:'b'}]);assert.deepEqual(removed.slides[0].autoLayouts![0].order,['a','c','d']);
  const ungrouped=applyOperations(removed,groupElements(removed.slides[0],['a'],true));assert(!ungrouped.slides[0].autoLayouts);assert(ungrouped.slides[0].elements.every(e=>!e.group));
});
test('an existing layout absorbs a selected new object while preserving its settings',()=>{
  const {deck,slideId}=fixture(),l=deck.slides[0].autoLayouts![0];
  const extra=applyOperations(deck,[{op:'add_element',slideId,element:element('rect',{id:'extra',w:60,h:40})}]);
  const merged=applyOperations(extra,createGroupLayout(extra.slides[0],['a','extra']));assert.equal(merged.slides[0].autoLayouts![0].id,l.id);assert.deepEqual(merged.slides[0].autoLayouts![0].order,['a','b','c','extra']);
});
test('group movement translates its frame, while individual drag reorders without changing z order',()=>{
  const {deck,slideId}=fixture();const moved=applyOperations(deck,moveElements(deck,slideId,['a','b','c'],50,-20));assert.equal(moved.slides[0].autoLayouts![0].x,150);assert.equal(moved.slides[0].elements[1].x,274);
  const reorder=applyOperations(moved,moveElements(moved,slideId,['a'],350,0));assert.deepEqual(reorder.slides[0].autoLayouts![0].order,['b','c','a']);assert.deepEqual(reorder.slides[0].elements.map(e=>e.id),['a','b','c']);assert.equal(reorder.slides[0].elements[1].x,150);
});
test('text measurement resolves before layout in transactions, rendering, and async saving',async()=>{
  const {deck,slideId}=fixture();const s=deck.slides[0];s.elements[0]=element('text',{...s.elements[0],type:'text',text:'Text',textSizing:'auto-width'});
  const measure=()=>({w:180,h:60});const edited=applyOperations(deck,[{op:'update_element',slideId,elementId:'a',patch:{text:'Longer text'}}],deck.revision,'manual',measure);assert.equal(edited.slides[0].elements[1].x,304);
  assert.equal(resolveSlideTextSizing(s,deck,measure).elements[1].x,304);assert.equal((await resolveDeckTextSizingAsync(deck,{measure})).slides[0].elements[1].x,304);
});
test('locked siblings reject indirect movement and invalid rules roll back the whole transaction',()=>{
  const {deck,slideId}=fixture();const locked=applyOperations(deck,[{op:'update_element',slideId,elementId:'b',patch:{locked:true}}]);const frozen=JSON.stringify(locked);
  assert.throws(()=>applyOperations(locked,[{op:'update_element',slideId,elementId:'a',patch:{w:200}}]),/locked/);assert.equal(JSON.stringify(locked),frozen);
  assert.throws(()=>applyOperations(locked,[{op:'set_group_layout',slideId,layout:{...locked.slides[0].autoLayouts![0],gap:10}}]),/Unlock/);
  assert.throws(()=>groupElements(locked.slides[0],['a'],true),/Unlock/);
  assert.throws(()=>applyOperations(deck,[{op:'set_group_layout',slideId,layout:{...deck.slides[0].autoLayouts![0],order:['a','b']}}]),/each group member/);
  assert.throws(()=>applyOperations(deck,[{op:'rename_deck',title:'Bad'},{op:'set_group_layout',slideId,layout:{...deck.slides[0].autoLayouts![0],gap:-1}}]));assert.equal(deck.title,'Layout');
});
test('AI layout proposals share geometry validation, readable review and revision protection',()=>{
  const {deck,slideId}=fixture(),layout={...deck.slides[0].autoLayouts![0],direction:'vertical' as const};const proposal={baseRevision:deck.revision,summary:'Stack objects',operations:[{op:'set_group_layout' as const,slideId,layout}]};
  assert.equal(applyOperations(deck,proposal.operations,proposal.baseRevision,'ai').slides[0].elements[1].y,144);assert.match(diffProposal(deck,proposal)[0].after,/Vertical/);assert(!diffProposal(deck,proposal)[0].after.includes(layout.id));
  assert.throws(()=>applyOperations(deck,proposal.operations,0,'ai'),/document has changed/);
});
