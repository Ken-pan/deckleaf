import {templateDeck,COLLECTIONS} from '../src/core/templates';
import {TEMPLATE_PAGES} from '../src/core/template-blueprints';
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,validateDeck} from '../src/core/model';
import {slideLabel,slideSearchText} from '../src/core/slide-label';
import {withoutSlideTitles,portableDeck} from '../src/core/portable-document';
import {OperationSchema,applyOperations} from '../src/core/operations';
import {exportBroadser} from '../src/core/export';
import {diffProposal} from '../src/core/proposal-copy';

test('legacy documents preserve metadata while new pages and delivery need no title',()=>{
 const old=blankSlide('Legacy metadata');old.elements=[element('text',{text:'Authored heading'})];
 const deck=newDeck('Document title',[old,blankSlide()]),before=JSON.stringify(deck);
 assert.equal(deck.slides[1].title,undefined);assert.equal(validateDeck(deck).slides[0].title,'Legacy metadata');
 const delivered=withoutSlideTitles(deck);assert.ok(delivered.slides.every(s=>!Object.hasOwn(s,'title')));
 assert.equal(delivered.title,deck.title);assert.equal(validateDeck(delivered).slides[0].elements[0].text,'Authored heading');
 assert.equal(JSON.stringify(deck),before);
 const board=exportBroadser(deck);assert.equal(board.cards[0].title,'Slide 1');assert.ok(!board.cards[0].text.includes('Legacy metadata'));assert.ok(board.cards[0].text.includes('Authored heading'));
});
test('slide title edits are rejected and numbered review follows page order',()=>{
 const a=blankSlide('Legacy A'),b=blankSlide('Legacy B'),deck=newDeck('Document',[a,b]);
 assert.equal(OperationSchema.safeParse({op:'update_slide',slideId:a.id,patch:{title:'New name'}}).success,false);
 const reordered=applyOperations(deck,[{op:'reorder_slides',ids:[b.id,a.id]}]);
 assert.equal(slideLabel(reordered.slides.findIndex(s=>s.id===a.id)),'Slide 2');
 const changes=diffProposal(reordered,{baseRevision:reordered.revision,summary:'Notes',operations:[{op:'update_slide',slideId:a.id,patch:{notes:'Speaker note'}}]});
 assert.equal(changes[0].slide,'Slide 2');assert.ok(!JSON.stringify(changes).includes('Legacy A'));
});
test('presentation search uses page numbers and visible authored text',()=>{
 const slide=blankSlide('Invisible metadata');slide.elements=[element('text',{text:'Visible heading'}),element('text',{text:'Hidden body',hidden:true})];
 assert.equal(slideSearchText(slide,2),'Slide 3 Visible heading');
});

test('numbered export retains old template intent after rebranding without retaining page titles',async()=>{
 const deck=templateDeck('review'),collection=COLLECTIONS.find(c=>c.id==='review')!;
 deck.slides.forEach((s,i)=>s.title=TEMPLATE_PAGES.review[collection.layouts[i]].name);
 delete deck.templateCollection;deck.designSystem!.name='Legacy custom brand';
 const before=JSON.stringify(deck),out=await portableDeck(deck);
 assert.equal(out.templateCollection,'review');assert.ok(out.slides.every(s=>s.title===undefined));assert.equal(JSON.stringify(deck),before);
 assert.deepEqual(out.slides.map(s=>s.elements),deck.slides.map(s=>s.elements));
});
