import {test} from 'node:test';import assert from 'node:assert/strict';
import {newDeck,blankSlide,element,validateDeck} from '../src/core/model';
import {packDocumentMedia,restoreDocumentMedia} from '../src/core/document-media-transport';
const image='data:image/png;base64,'+'A'.repeat(70000);
test('worker media transport shares repeated bytes without changing documents, sources or posters',()=>{
 const slide=blankSlide();slide.source={provider:'PDF',render:image,warnings:['Original'],fidelity:'source-render'};slide.elements=[element('image',{src:image,crop:{left:.1,right:0,top:0,bottom:0}}),element('prototype',{prototype:{url:'https://example.com',poster:image,scaling:'contain',responsive:true,chrome:false,deviceFrame:false}})];
 const deck=newDeck('Source',[slide]),before=JSON.stringify(deck);deck.provenance={provider:'Original',filename:'original.pptx'};
 const packed=packDocumentMedia(deck);assert.equal(packed.assets.length,1);assert.equal(packed.references.length,3);assert.equal(packed.deck.slides[0].elements[0].src,undefined);assert.equal(deck.slides[0].elements[0].src,image);
 const received=structuredClone(packed);const restored=restoreDocumentMedia(received);assert.deepEqual(validateDeck(restored),deck);assert.equal(restored.slides[0].source!.render,image);assert.equal(restored.slides[0].elements[1].prototype!.poster,image);assert.equal(JSON.stringify({...deck,provenance:undefined}),before);
 restored.slides[0].elements[0].name='Worker-owned';assert.notEqual(restored.slides[0].elements[0].name,deck.slides[0].elements[0].name);
});
test('unique media and small values keep their ordinary document transport',()=>{
 const s=blankSlide();s.elements=[element('image',{src:image}),element('image',{src:'data:image/png;base64,AA=='})];const d=newDeck('Unique',[s]);const p=packDocumentMedia(d);assert.equal(p.deck,d);assert.equal(p.assets.length,0);assert.deepEqual(restoreDocumentMedia(structuredClone(p)),d);
});
test('missing transport media rejects before producing a partial output',()=>{
 const s=blankSlide();s.elements=[element('image',{src:image}),element('image',{src:image})];const p=packDocumentMedia(newDeck('Invalid',[s]));p.assets=[];assert.throws(()=>restoreDocumentMedia(p),/media transport/);
});
