import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPptxImage} from '../src/core/pptx-image';

test('embedded PNG bytes export even when worker network reads are blocked',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,255]);
  const src='data:image/png;base64,'+Buffer.from(bytes).toString('base64');
  const blob=await loadPptxImage(src,'Embedded image',async()=>{throw new Error('Network blocked by policy');});
  assert.equal(blob.type,'image/png');assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes);
});
test('invalid embedded media fails without issuing a network request',async()=>{
  let calls=0;await assert.rejects(loadPptxImage('data:image/png;base64,@@@','Invalid',async()=>{calls++;return new Response();}));assert.equal(calls,0);
});
test('external images retain HTTP validation and their original bytes',async()=>{
  const blob=await loadPptxImage('/image.png','External',async input=>{assert.equal(input,'/image.png');return new Response(new Uint8Array([0,255]),{headers:{'Content-Type':'image/png'}});});assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),new Uint8Array([0,255]));
  await assert.rejects(loadPptxImage('/missing.png','Missing',async()=>new Response('',{status:404})),/Cannot read image: Missing/);
});
