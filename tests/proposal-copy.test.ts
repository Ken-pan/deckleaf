import test from 'node:test';
import assert from 'node:assert/strict';
import { blankSlide, element, newDeck } from '../src/core/model';
import { diffProposal } from '../src/core/proposal-copy';
import type { Operation } from '../src/core/operations';

const preview = (deck: ReturnType<typeof newDeck>, operations: Operation[]) => diffProposal(deck,{baseRevision:deck.revision,summary:'Review changes',operations});

test('speaker note review compares notes rather than the slide title and preserves original content',()=>{
  const slide=blankSlide('Project overview');slide.notes='原始备注';const deck=newDeck('Source',[slide]);const original=structuredClone(deck);
  const [change]=preview(deck,[{op:'update_slide',slideId:slide.id,patch:{notes:'Review the key evidence.'}}]);
  assert.equal(change.target,'Speaker notes');assert.equal(change.before,slide.notes);assert.equal(change.after,'Review the key evidence.');assert.deepEqual(deck,original);
});

test('review retains both text and style changes, dimensions, units and one-based motion order',()=>{
  const slide=blankSlide();const text=element('text',{text:'Original',fontSize:20,x:40});slide.elements=[text];const deck=newDeck('Style review',[slide]);
  const [change]=preview(deck,[{op:'update_element',slideId:slide.id,elementId:text.id,patch:{text:'Revised',fontSize:28,x:96,animation:{effect:'fade',trigger:'click',duration:500,delay:0,order:0,easing:'smooth'}}}]);
  assert.match(change.before,/Original/);assert.match(change.before,/Font size: 20 px/);
  for(const expected of ['Text: Revised','Font size: 28 px','X: 96 px','Duration: 500 ms','Order: 1'])assert.ok(change.after.includes(expected));
});

test('image and imported-font previews keep binary payloads out of interface text',()=>{
  const slide=blankSlide();const image=element('image',{src:'data:image/png;base64,AAAA'});slide.elements=[image];const deck=newDeck('Media',[slide]);
  const changes=preview(deck,[{op:'update_element',slideId:slide.id,elementId:image.id,patch:{src:'data:image/png;base64,BBBB'}},{op:'register_local_font',font:{family:'Example Sans',name:'Example Sans',weight:'400',style:'normal',data:'data:font/woff2;base64,CCCC'}}]);
  const copy=changes.map(c=>`${c.target}\n${c.before}\n${c.after}`).join('\n');assert.ok(copy.includes('Updated image'));assert.ok(copy.includes('Example Sans'));assert.ok(!copy.includes('base64'));assert.ok(!copy.includes('update_element'));assert.ok(!copy.includes('register_local_font'));
});

test('slide reorder review identifies the proposed order using original page numbers',()=>{
  const a=blankSlide('Overview'),b=blankSlide('Evidence');const deck=newDeck('Order',[a,b]);
  const [change]=preview(deck,[{op:'reorder_slides',ids:[b.id,a.id]}]);
  assert.equal(change.target,'Slide order');assert.equal(change.before,'1. Slide 1\n2. Slide 2');assert.equal(change.after,'1. Slide 2\n2. Slide 1');
});

test('container changes produce complete previews with readable parent names',()=>{
  const slide=blankSlide();slide.groups=[{id:'root-group',name:'Evidence workspace'},{id:'child-group',name:'Research',parent:'root-group'}];
  slide.elements=[element('rect',{group:'child-group',name:'Finding'})];const deck=newDeck('Container review',[slide]),original=structuredClone(deck);
  const changes=preview(deck,[{op:'set_group',slideId:slide.id,group:{id:'child-group',name:'Research'}},{op:'remove_group',slideId:slide.id,groupId:'child-group'}]);
  assert.equal(changes.length,2);assert.ok(changes.every(change=>change&&change.before&&change.after));
  assert.match(changes[0].before,/Evidence workspace/);assert.match(changes[0].after,/Parent: Slide/);assert.match(changes[1].before,/Research/);
  assert.ok(!JSON.stringify(changes).includes('root-group'));assert.ok(!JSON.stringify(changes).includes('child-group'));assert.deepEqual(deck,original);
});

test('stored asset replacements disclose removal of old crop and resource credit',()=>{
  const slide=blankSlide(),image=element('image',{src:'data:image/png;base64,AAAA',crop:{left:.1,right:.1,top:0,bottom:0},resource:{id:'fixture',kind:'photo',title:'Prior image',creator:'Author',provider:'Fixture',sourceUrl:'https://example.com/source',license:'CC0',licenseUrl:'https://example.com/license',attribution:'Author',attributionRequired:false}});slide.elements=[image];const deck=newDeck('Replace',[slide]);const change=preview(deck,[{op:'update_element',slideId:slide.id,elementId:image.id,patch:{src:'data:image/png;base64,BBBB'},unset:['crop','resource']}])[0];assert.match(change.before,/Crop: Left: 10%/);assert.match(change.before,/Resource credit: Prior image/);assert.match(change.after,/Crop: Not set/);assert.match(change.after,/Resource credit: Not set/);assert(!JSON.stringify(change).includes('base64'));
});
