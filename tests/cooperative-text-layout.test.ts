import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankSlide, element, newDeck } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { resolveActiveTextSizing, resolveDeckTextSizing, resolveDeckTextSizingAsync, yieldForInput } from '../src/core/text-layout';

function fixture() {
  const slides = Array.from({length: 4}, (_, i) => {
    const s = blankSlide(`Page ${i}`);
    s.elements = Array.from({length: 6}, (_, n) => element('text', {text: `Original ${i}:${n}`, textSizing: 'auto-height', h: 30}));
    return s;
  });
  return newDeck('Measured document', slides);
}

test('editing measures the active page only, preserving every offscreen object and source document', () => {
  const deck = fixture(), seen: string[] = [];
  const after = resolveActiveTextSizing(deck, deck.slides[2].id, e => {seen.push(e.id); return {w:e.w,h:90};});
  assert.deepEqual(seen, deck.slides[2].elements.map(e => e.id));
  assert.equal(after.slides[0], deck.slides[0]); assert.equal(after.slides[3], deck.slides[3]);
  assert.equal(after.slides[2].elements[0].h,90); assert.equal(deck.slides[2].elements[0].h,30);
  assert.equal(resolveActiveTextSizing(deck, deck.slides[0].id, e => ({w:e.w,h:e.h})),deck);
});

test('cooperative full-document sizing yields within one large slide and matches synchronous output', async () => {
  const deck = fixture(); let time=0, yields=0, measured=0;
  const measure = (e: typeof deck.slides[0]['elements'][0]) => ({w:e.w,h:e.fontSize*3});
  const after = await resolveDeckTextSizingAsync(deck, {measure:e=>{time+=3;measured++;return measure(e);},now:()=>time,budgetMs:8,yieldControl:async()=>{yields++;assert(measured<24 || yields>0);}});
  assert.equal(yields,8); assert.equal(measured,24);
  assert.deepEqual(after,resolveDeckTextSizing(deck,measure));
  assert.equal(deck.slides[0].elements[0].h,30);
});

test('canceled background measurement stops promptly and never returns a partial document', async () => {
  const deck=fixture(); let measured=0,active=true,time=0;
  const result=await resolveDeckTextSizingAsync(deck,{measure:e=>{measured++;time+=4;return {w:e.w,h:120};},now:()=>time,budgetMs:8,shouldContinue:()=>active,yieldControl:async()=>{active=false;}});
  assert.equal(measured,2); assert.equal(result,deck); assert.equal(result.slides[0].elements[0].h,30);
});

test('saving a captured revision stays independent of edits made while measurement yields', async () => {
  const captured=fixture(),id=captured.slides[0].elements[0].id;let current=captured,time=0;
  const measured=await resolveDeckTextSizingAsync(captured,{measure:e=>{time+=4;return {w:e.w,h:100};},now:()=>time,budgetMs:8,yieldControl:async()=>{if(current===captured)current=applyOperations(current,[{op:'update_element',slideId:captured.slides[0].id,elementId:id,patch:{text:'New revision'}}]);}});
  assert.equal(measured.revision,0); assert.equal(current.revision,1);
  assert.equal(measured.slides[0].elements[0].text,'Original 0:0'); assert.equal(current.slides[0].elements[0].text,'New revision');
});

test('unchanged full-document measurement preserves identity and scheduler fallback allows a timer to run', async () => {
  const deck=fixture(),measure=(e: typeof deck.slides[0]['elements'][0])=>({w:e.w,h:e.h});
  assert.equal(resolveDeckTextSizing(deck,measure),deck);
  assert.equal(await resolveDeckTextSizingAsync(deck,{measure}),deck);
  let inputRan=false;setTimeout(()=>{inputRan=true;},0);await yieldForInput();assert.equal(inputRan,true);
});
