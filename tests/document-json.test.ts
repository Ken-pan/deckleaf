import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,newDeck,element} from '../src/core/model';
import {documentJsonBlob} from '../src/core/document-json';

test('chunked document downloads preserve every JSON value, embedded asset and source field',async()=>{
 const slide=blankSlide('中文 <source>');slide.notes='Line one\nLine two';slide.elements=[element('image',{src:'data:image/png;base64,AA==',name:'Original image'}),element('text',{text:'</script> & "中文"',runs:[{text:'Bold',bold:true}]})];
 slide.source={provider:'PDF',render:'data:image/png;base64,AA==',fidelity:'source-render',warnings:['Original warning']};
 const deck=newDeck('Portable',[slide]);deck.provenance={provider:'PPTX',filename:'original.pptx'};deck.fonts=[{family:'Owned',name:'owned.woff2',data:'data:font/woff2;base64,AA==',weight:'400',style:'normal'}];
 const before=JSON.stringify(deck);
 for(const space of [0,2]){const blob=await documentJsonBlob(deck,{space});assert.equal(blob.type,'application/json');assert.deepEqual(JSON.parse(await blob.text()),JSON.parse(before));}
 const html=await (await documentJsonBlob(deck,{escapeHtml:true})).text();assert(!html.includes('<'));assert.deepEqual(JSON.parse(html),JSON.parse(before));assert.equal(JSON.stringify(deck),before);
});

test('large downloads yield without changing the captured document or joining its complete JSON',async()=>{
 const deck=newDeck('Large',Array.from({length:30},(_,i)=>{const s=blankSlide('Page '+i);s.elements=[element('image',{src:'data:image/png;base64,'+'A'.repeat(300000)})];return s;}));
 let time=0,yields=0;const blob=await documentJsonBlob(deck,{now:()=>time+=3,yieldTask:async()=>{yields++;}});
 assert(yields>10);assert.equal(JSON.parse(await blob.text()).slides.length,30);assert.equal(deck.slides[0].elements[0].src!.length,300022);
});
