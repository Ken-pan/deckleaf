import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {validateAIProposal} from '../src/core/ai-editing';

function fixture(){const slide=blankSlide();slide.elements=[element('text',{id:'subtitle',text:'Original subtitle',x:76,y:476,w:650,h:90,textSizing:'auto-height',layoutItem:{widthMode:'fill',heightMode:'fixed'}})];return newDeck('Existing document',[slide]);}
test('AI text replacement with an echoed frame preserves automatic text and member sizing',()=>{
  const deck=fixture(),slide=deck.slides[0],before=slide.elements[0];
  const result=validateAIProposal(deck,{baseRevision:0,summary:'Replace subtitle',operations:[{op:'update_element',slideId:slide.id,elementId:before.id,patch:{text:'A new subtitle',x:before.x,y:before.y,w:before.w,h:before.h}}]});
  const after=result.deck.slides[0].elements[0];
  assert.equal(after.text,'A new subtitle');assert.equal(after.textSizing,'auto-height');assert.deepEqual(after.layoutItem,before.layoutItem);
  assert.deepEqual((result.proposal.operations[0] as any).patch,{text:'A new subtitle'});
  assert.equal(deck.slides[0].elements[0].text,'Original subtitle');
});
test('AI explicit fixed sizing and an actual resize remain intentional changes',()=>{
  const deck=fixture(),slide=deck.slides[0],before=slide.elements[0];
  const fixed=validateAIProposal(deck,{baseRevision:0,summary:'Fix text box',operations:[{op:'update_element',slideId:slide.id,elementId:before.id,patch:{text:'Fixed subtitle',w:before.w,h:before.h,textSizing:'fixed',layoutItem:{widthMode:'fixed',heightMode:'fixed'}}}]});
  assert.equal(fixed.deck.slides[0].elements[0].textSizing,'fixed');assert.equal(fixed.deck.slides[0].elements[0].layoutItem?.widthMode,'fixed');
  const resized=validateAIProposal(deck,{baseRevision:0,summary:'Resize subtitle',operations:[{op:'update_element',slideId:slide.id,elementId:before.id,patch:{text:'Resized subtitle',w:700}}]});
  assert.equal(resized.deck.slides[0].elements[0].w,700);assert.equal(resized.deck.slides[0].elements[0].layoutItem?.widthMode,'fixed');
});
