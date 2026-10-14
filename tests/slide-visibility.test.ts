import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {blankSlide, element, newDeck, validateDeck} from '../src/core/model';
import {applyOperations, ProposalSchema} from '../src/core/operations';
import {slideVisibilityOperations,visibleSlideIndices, adjacentVisibleSlide, presentationStartIndex, visibleDeliveryDeck} from '../src/core/slide-visibility';
import {navigatePresentationCue} from '../src/core/presentation-session';
import {buildPptx} from '../src/core/pptx-export';
import {importPptx} from '../src/importers/pptx';
import {importGoogle} from '../src/importers/google';
import {keynoteState} from '../src/core/keynote-source';
import {googleTextEdits, googleVisibilityRequests} from '../src/core/google-source';
import {verifyGoogleExport} from '../src/core/google-export';
import {nativeKeynoteEdits} from '../server/keynote-source';
import {buildHtml} from '../src/core/export';

function fixture() {
  return newDeck('Visibility acceptance', Array.from({length:5},(_,i)=>({
    ...blankSlide(), notes:`Notes ${i+1}`, elements:[element('text',{text:`Page ${i+1}`,fontFamily:'Arial'})],
  })));
}

test('mixed batch hide and restore use one atomic revision and never invert individual flags',()=>{
  const deck=fixture();deck.slides[1].hidden=true;const before=structuredClone(deck),ids=[deck.slides[1].id,deck.slides[2].id,deck.slides[2].id,deck.slides[4].id];
  const operations=slideVisibilityOperations(deck,ids,true);assert.equal(operations.length,2);
  const hidden=applyOperations(deck,operations);assert.equal(hidden.revision,1);assert.deepEqual(hidden.slides.map(s=>Boolean(s.hidden)),[false,true,true,false,true]);
  assert.deepEqual(deck,before);assert.deepEqual(slideVisibilityOperations(hidden,ids,true),[]);
  const restored=applyOperations(hidden,slideVisibilityOperations(hidden,ids,false));assert.equal(restored.revision,2);assert(restored.slides.every(s=>!s.hidden));
  assert.throws(()=>slideVisibilityOperations(deck,[deck.slides[0].id,'stale'],true),/no longer exists/);assert.deepEqual(deck,before);
});

test('batch states drive the same presentation and audience/full-document export contracts',async()=>{
  const deck=fixture(),ids=[deck.slides[1].id,deck.slides[2].id,deck.slides[4].id];
  const hidden=applyOperations(deck,slideVisibilityOperations(deck,ids,true));
  assert.deepEqual(navigatePresentationCue(hidden.slides,0,0,1,[0,0,0,0,0]),{index:3,step:0});
  assert.equal(presentationStartIndex(hidden.slides,4),3);assert.deepEqual(visibleSlideIndices(hidden.slides),[0,3]);
  const html=await (await buildHtml(hidden,true)).text();
  const audience=JSON.parse(html.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/)![1]);assert.equal(audience.slides.length,2);
  const roundTrip=validateDeck(JSON.parse(JSON.stringify(hidden)));assert.equal(roundTrip.slides.length,5);assert.deepEqual(roundTrip.slides.map(s=>Boolean(s.hidden)),[false,true,true,false,true]);
  const zip=await JSZip.loadAsync(await buildPptx(hidden));
  for(let i=0;i<5;i++){const xml=await zip.file(`ppt/slides/slide${i+1}.xml`)!.async('string');assert.equal(/<p:sld\b[^>]*show="0"/.test(xml),[1,2,4].includes(i));}
  const restored=applyOperations(hidden,slideVisibilityOperations(hidden,ids,false));assert.equal(visibleDeliveryDeck(restored).slides.length,5);assert.deepEqual(navigatePresentationCue(restored.slides,0,0,1,[0,0,0,0,0]),{index:1,step:0});
});

test('hide is a revisioned, atomic operation that preserves editable content and source references',()=>{
  const deck=fixture();deck.slides[1].source={provider:'Fixture',fidelity:'source-render',render:'data:image/png;base64,AA==',warnings:[]};
  deck.slides[1].elements[0].locked=true;
  const before=structuredClone(deck),slide=deck.slides[1];
  const proposal=ProposalSchema.parse({baseRevision:deck.revision,summary:'Keep backup page',operations:[{op:'update_slide',slideId:slide.id,patch:{hidden:true}}]});
  const hidden=applyOperations(deck,proposal.operations,proposal.baseRevision,'ai');
  assert.equal(hidden.revision,1);assert.equal(hidden.slides.length,5);assert.deepEqual(deck,before);
  assert.deepEqual(hidden.slides[1],{...before.slides[1],hidden:true});
  assert.deepEqual(hidden.slides.filter((_,i)=>i!==1),before.slides.filter((_,i)=>i!==1));
  assert.equal(validateDeck(JSON.parse(JSON.stringify(hidden))).slides[1].hidden,true);
  const shown=applyOperations(hidden,[{op:'update_slide',slideId:slide.id,patch:{hidden:false}}]);
  assert.equal(shown.slides[1].hidden,false);assert.deepEqual(shown.slides[1].elements,slide.elements);
  assert.throws(()=>applyOperations(hidden,proposal.operations,proposal.baseRevision),/document has changed/);
  assert.throws(()=>applyOperations(deck,[...proposal.operations,{op:'update_slide',slideId:'missing',patch:{hidden:true}}]),/no longer exists/);
  assert.deepEqual(deck,before);
});

test('ordinary navigation skips consecutive and boundary backup slides but preserves builds',()=>{
  const slides=fixture().slides;[0,2,4].forEach(i=>slides[i].hidden=true);
  assert.deepEqual(visibleSlideIndices(slides),[1,3]);
  assert.equal(presentationStartIndex(slides,0),1);assert.equal(presentationStartIndex(slides,2),3);assert.equal(presentationStartIndex(slides,4),3);
  assert.equal(adjacentVisibleSlide(slides,1,-1),null);assert.equal(adjacentVisibleSlide(slides,1,1),3);
  const counts=[2,2,3,1,2];
  assert.deepEqual(navigatePresentationCue(slides,1,1,1,counts),{index:1,step:2});
  assert.deepEqual(navigatePresentationCue(slides,1,2,1,counts),{index:3,step:0});
  assert.deepEqual(navigatePresentationCue(slides,3,0,-1,counts),{index:1,step:2});
  assert.deepEqual(navigatePresentationCue(slides,1,0,-1,counts),{index:1,step:0});
  assert.deepEqual(navigatePresentationCue(slides,3,1,1,counts),{index:3,step:1});
  // A backup page shown explicitly returns to the normal sequence in either direction.
  assert.deepEqual(navigatePresentationCue(slides,2,3,1,counts),{index:3,step:0});
  assert.deepEqual(navigatePresentationCue(slides,2,0,-1,counts),{index:1,step:2});
  slides.forEach(s=>s.hidden=true);assert.equal(presentationStartIndex(slides),null);
});

test('audience exports omit hidden slides, preserve the document and reject an empty delivery',async()=>{
  const deck=fixture();deck.slides[1].hidden=true;deck.slides[3].hidden=true;
  const before=structuredClone(deck),visible=visibleDeliveryDeck(deck);
  assert.deepEqual(visible.slides.map(s=>s.id),[deck.slides[0].id,deck.slides[2].id,deck.slides[4].id]);
  const html=await (await buildHtml(deck,true)).text();
  const exported=JSON.parse(html.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/)![1]);
  assert.deepEqual(exported.slides.map((s:any)=>s.id),visible.slides.map(s=>s.id));assert(!html.includes(deck.slides[1].id));
  assert.deepEqual(deck,before);
  deck.slides.forEach(s=>s.hidden=true);assert.throws(()=>visibleDeliveryDeck(deck),/Unhide a slide/);await assert.rejects(()=>buildHtml(deck,true),/Unhide a slide/);
});

test('PPTX keeps hidden pages, notes and native skip flags through export and reimport',async()=>{
  const deck=fixture();deck.slides[1].hidden=true;deck.slides[4].hidden=true;
  for(const original of [false,true]){
    const bytes=await buildPptx(deck,original),zip=await JSZip.loadAsync(bytes);
    const hidden=await zip.file('ppt/slides/slide2.xml')!.async('string');assert.match(hidden,/<p:sld\b[^>]*show="0"/);
    const visible=await zip.file('ppt/slides/slide1.xml')!.async('string');assert(!/<p:sld\b[^>]*show="0"/.test(visible));
    const imported=await importPptx(bytes,'hidden.pptx');assert.equal(imported.slides.length,5);assert.equal(imported.slides[1].hidden,true);assert.equal(imported.slides[4].hidden,true);
    assert.equal(Boolean(imported.slides[0].hidden),false);assert.equal(imported.slides[1].notes,'Notes 2');assert.equal(imported.slides[1].elements[0].text,'Page 2');
  }
});

test('native Google preserves skip state and verifies visibility changes on original page IDs',async()=>{
  const presentation={presentationId:'source_google_123',pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},slides:[{objectId:'page1',pageElements:[],slideProperties:{isSkipped:true}},{objectId:'page2',pageElements:[],slideProperties:{isSkipped:false}}]};
  const deck=importGoogle({presentation}),baseline=await keynoteState(deck);assert.equal(deck.slides[0].hidden,true);
  const edited=applyOperations(deck,[{op:'update_slide',slideId:deck.slides[0].id,patch:{hidden:false}},{op:'update_slide',slideId:deck.slides[1].id,patch:{hidden:true}}]);
  const state=await keynoteState(edited);assert.deepEqual(googleTextEdits(baseline,state),[]);
  const requests=googleVisibilityRequests(state,presentation);assert.deepEqual(requests,[
    {updateSlideProperties:{objectId:'page1',slideProperties:{isSkipped:false},fields:'isSkipped'}},
    {updateSlideProperties:{objectId:'page2',slideProperties:{isSkipped:true},fields:'isSkipped'}},
  ]);
  const result=structuredClone(presentation);result.slides[0].slideProperties.isSkipped=false;result.slides[1].slideProperties={isSkipped:true};
  assert.doesNotThrow(()=>verifyGoogleExport(presentation,result,requests));
  assert.throws(()=>verifyGoogleExport(presentation,presentation,requests),/visibility verification failed/);
});

test('native Keynote falls back to conversion for visibility changes instead of silently losing them',async()=>{
  const deck=fixture(),baseline=await keynoteState(deck);
  const hidden=applyOperations(deck,[{op:'update_slide',slideId:deck.slides[1].id,patch:{hidden:true}}]);
  assert.equal(nativeKeynoteEdits(baseline,await keynoteState(hidden)),null);
  assert.equal(nativeKeynoteEdits(baseline,baseline)?.changed,0);
});
