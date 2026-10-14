import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import {newDeck,blankSlide,element} from '../src/core/model';
import {sendDocumentJson} from '../server/document-json-response';

function fixture(){
  let serialized=0;const image='data:image/png;base64,'+'A'.repeat(70000),deck=newDeck('Stream',[blankSlide('Source')]);
  deck.slides[0].elements=Array.from({length:100},()=>{const e=element('image');Object.defineProperty(e,'src',{enumerable:true,get:()=>{serialized++;return image;}});return e;});
  return {deck,count:()=>serialized,reset:()=>{serialized=0;}};
}
test('complete document responses start before full encoding and bound slow-client write queues',async()=>{
  const {deck,count,reset}=fixture(),expected=JSON.stringify(deck);reset();
  const chunks:Buffer[]=[],headers:any[]=[];let firstCount=0,maxQueued=0;
  const response=Object.assign(new Writable({highWaterMark:1,write(chunk,_encoding,done){
    if(!chunks.length)firstCount=count();chunks.push(Buffer.from(chunk));maxQueued=Math.max(maxQueued,this.writableLength);setTimeout(done,1);
  }}),{writeHead:(...args:any[])=>headers.push(args)});
  await sendDocumentJson(response as unknown as ServerResponse,deck);
  assert.equal(Buffer.concat(chunks).toString(),expected);assert(firstCount<20);assert(maxQueued<400000);
  assert.equal(headers[0][0],200);assert.equal(headers[0][1]['Content-Type'],'application/json; charset=utf-8');
});
test('disconnecting a document reader stops encoding and does not leak a rejected response promise',async()=>{
  const {deck,count}=fixture();let written=0;
  const response=Object.assign(new Writable({highWaterMark:1,write(_chunk,_encoding,done){written++;this.destroy(new Error('Synthetic reader disconnect'));done();}}),{writeHead:()=>{}});
  await sendDocumentJson(response as unknown as ServerResponse,deck);
  assert(response.destroyed);assert.equal(written,1);assert(count()<20);
});
