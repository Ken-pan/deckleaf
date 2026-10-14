import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck} from '../src/core/model';
import {defaultAnimation} from '../src/core/motion';
import {motionPropertyState} from '../src/core/motion-properties';
import {entranceSequence,moveEntranceGroup} from '../src/core/motion-authoring';
import {proposalReviewChanges,proposalReviewRange} from '../src/core/proposal-review';
import {applyOperations,type Proposal} from '../src/core/operations';

test('editable motion states ignore locked differences and distinguish independent options',()=>{
 const a=element('rect',{animation:{...defaultAnimation,effect:'fade',duration:300}}),b=element('rect',{animation:{...defaultAnimation,effect:'fade',duration:600}}),locked=element('rect',{locked:true,animation:{...defaultAnimation,effect:'rise',duration:800}});
 assert.deepEqual(motionPropertyState([a,b,locked],'effect'),{value:'fade',mixed:false});
 assert.deepEqual(motionPropertyState([a,b,locked],'duration'),{value:300,mixed:true});
 assert.deepEqual(motionPropertyState([a,locked],'duration'),{value:300,mixed:false});
 assert.equal(motionPropertyState([locked],'duration').value,800);
});

test('sequence move availability agrees with actual transactions across locked and boundary groups',()=>{
 const slide=blankSlide();slide.elements=Array.from({length:75},(_,i)=>element('rect',{locked:i%7===0,animation:{...defaultAnimation,effect:'fade',trigger:'click',order:i}}));
 const sequence=entranceSequence(slide,'click');
 for(const group of sequence){assert.equal(group.canMoveEarlier,moveEntranceGroup(slide,'click',group.order,-1).length>0);assert.equal(group.canMoveLater,moveEntranceGroup(slide,'click',group.order,1).length>0);}
 assert.equal(sequence.length,75);
});

test('paged proposal review keeps every operation in original order and applies the complete proposal',()=>{
 const slide=blankSlide();slide.elements=Array.from({length:65},(_,i)=>element('text',{id:`text-${i}`,name:`Text ${i}`,text:`Before ${i}`}));const deck=newDeck('Review',[slide]);
 const proposal:Proposal={baseRevision:deck.revision,summary:'Update copy',operations:slide.elements.map((e,i)=>({op:'update_element',slideId:slide.id,elementId:e.id,patch:{text:`After ${i}`}}))};
 const before=JSON.stringify(deck),rows=[];
 for(let p=0;p<proposalReviewRange(proposal.operations.length,0).pages;p++){const page=proposalReviewChanges(deck,proposal,p);assert(page.length<=20);rows.push(...page);}
 assert.deepEqual(rows.map(row=>row.after),Array.from({length:65},(_,i)=>`After ${i}`));
 assert.equal(JSON.stringify(deck),before);assert.equal(proposal.operations.length,65);
 const after=applyOperations(deck,proposal.operations,proposal.baseRevision,'ai');assert.deepEqual(after.slides[0].elements.map(e=>e.text),rows.map(row=>row.after));
 assert.equal(proposalReviewRange(65,Infinity).end,65);
});
