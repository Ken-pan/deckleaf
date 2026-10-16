import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {arrangementIntent,validateArrangementIntent,notesOnlyOnAddedSlides,validateAddedSlideNotes} from '../src/core/ai-arrangement-intent';
import {distributeElements} from '../src/core/arrangement-operations';
import {resolvePageRequest} from '../src/core/ai-page-request';
import {createAIBase} from '../src/core/ai-story-builder';
import {authoredTemplatePages} from '../src/core/ai-templates';

test('explicit distribution is checked against proposed geometry, independent of a model success claim',()=>{
 const slide=blankSlide();slide.elements=['Card one','Card two','Card three'].map((name,i)=>element('rect',{name,x:[100,330,800][i],y:300,w:150,h:80}));const deck=newDeck('Arrangement',[slide]),scope={slideIds:[slide.id],elementIds:[]};
 const intents=arrangementIntent(deck,'Evenly distribute Card one, Card two and Card three horizontally.',scope);assert.equal(intents.length,1);
 assert.throws(()=>validateArrangementIntent(deck,{baseRevision:0,summary:'Claimed distribution',operations:[{op:'rename_deck',title:'Claimed complete'}]},intents),/distribution is missing/);
 assert.doesNotThrow(()=>validateArrangementIntent(deck,{baseRevision:0,summary:'Actual distribution',operations:distributeElements(deck,slide.id,slide.elements.map(e=>e.id),'x')},intents));
 assert.deepEqual(arrangementIntent(deck,'Do not evenly distribute Card one, Card two and Card three horizontally.',scope),[]);
 assert.deepEqual(arrangementIntent(deck,'Evenly distribute unknown objects horizontally.',scope),[]);
});

test('unique live heading addresses bind exact layout requirements; duplicate names and authored quotes do not',async()=>{
 const base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'insights','review',{heading:'Service principles',items:[['Clarity','Visible action'],['Ownership','Named team']]}))[0],deck={...base,slides:[slide]};
 const request=resolvePageRequest(deck,'Make Service principles a reading-density content layout, preserving every point.');assert.equal(request.pages.length,1);assert.equal(request.pages[0].layout,'content');assert.equal(request.pages[0].density,'reading');
 assert.equal(resolvePageRequest(deck,'Change title to "Service principles".').pages.length,0);
 assert.equal(resolvePageRequest({...deck,slides:[slide,{...structuredClone(slide),id:'another'}]},'Make Service principles a content layout.').pages.length,0);
});


test('notes explicitly scoped to newly added slides do not leak into existing slides',()=>{
 const original=blankSlide(),added=blankSlide();added.notes='Explain dependencies.';const deck=newDeck('Scope',[original]);
 assert(notesOnlyOnAddedSlides('Put context in each added slide notes. Also change the original title.'));assert(!notesOnlyOnAddedSlides('Improve notes throughout the presentation.'));assert(!notesOnlyOnAddedSlides('Put notes in each added slide notes. Also update original slide notes.'));
 const valid={baseRevision:0,summary:'Add the requested slide',operations:[{op:'add_slide' as const,slide:added,afterId:original.id}]};assert.doesNotThrow(()=>validateAddedSlideNotes(deck,valid));
 assert.throws(()=>validateAddedSlideNotes(deck,{...valid,operations:[...valid.operations,{op:'update_slide',slideId:original.id,patch:{notes:'Unrequested'}}]}),/only for added slides/);
});
