import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDeck,blankSlide,element} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {exactTextProposal} from '../server/ai-exact-text';
import {runAI} from '../server/ai';
const fixture=()=>{const slide=blankSlide();slide.elements=[element('text',{text:'Old subtitle'})];slide.notes='Source stays intact.';return newDeck('Example',[slide]);};

test('exact bilingual replacements produce one reviewable revision-bound edit without a provider call',async()=>{
 for(const prompt of ['Replace exact text "Old subtitle" with "Only observations, no causal conclusion.".','将文字“Old subtitle”替换为“这是观察结果，不能证明因果。”。']){const deck=fixture(),before=JSON.stringify(deck),scope={slideIds:[deck.slides[0].id],elementIds:[]};const result=await runAI(deck,prompt,scope,{provider:'openai',baseUrl:'',model:'selected-model'},{transport:async()=>{throw Error('An exact literal replacement must not need prose generation.');}});assert(!('kind' in result));if('kind' in result)continue;assert.equal(result.baseRevision,deck.revision);assert.equal(result.operations.length,1);const updated=applyOperations(deck,result.operations,result.baseRevision,'ai');assert.equal(updated.slides[0].notes,deck.slides[0].notes);assert.equal(updated.slides[0].elements[0].text,prompt.includes('将文字')?'这是观察结果，不能证明因果。':'Only observations, no causal conclusion.');assert.equal(JSON.stringify(deck),before);}
});

test('extra instructions retain interpretation while ambiguous literal targets require selection',()=>{
 const deck=fixture(),scope={slideIds:[deck.slides[0].id],elementIds:[]};for(const prompt of ['Replace "Old subtitle" with "New" and delete the slide.','Explain whether to replace "Old subtitle" with "New".','Do not replace "Old subtitle" with "New".','Explain "subtitle" with "New".'])assert.equal(exactTextProposal(deck,prompt,scope),undefined);deck.slides[0].elements.push(element('text',{text:'Old subtitle'}));assert.throws(()=>exactTextProposal(deck,'Replace "Old subtitle" with "New".',scope),/Several objects/);assert(exactTextProposal(deck,'Replace "Old subtitle" with "New".',{...scope,elementIds:[deck.slides[0].elements[1].id]}));
});

test('exact text proposals retain canonical lock protection and cannot escape selected objects',()=>{
 const deck=fixture(),scope={slideIds:[deck.slides[0].id],elementIds:[]};deck.slides[0].elements[0].locked=true;assert.throws(()=>exactTextProposal(deck,'Replace "Old subtitle" with "New".',scope),/locked|unlock/i);deck.slides[0].elements[0].locked=false;const other=element('text',{text:'Another field'});deck.slides[0].elements.push(other);assert.throws(()=>exactTextProposal(deck,'Replace "Old subtitle" with "New".',{...scope,elementIds:[other.id]}),/not found/);
});
