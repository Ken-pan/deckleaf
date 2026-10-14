import test from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage} from 'node:http';
import {requestBytes} from '../server/request-body';

function request(chunks:Buffer[],length?:string,failure?:Error):IncomingMessage{
  return {headers:length===undefined?{}:{'content-length':length},async *[Symbol.asyncIterator](){for(const chunk of chunks)yield chunk;if(failure)throw failure;}} as IncomingMessage;
}
test('known and streamed upload bodies preserve binary originals and UTF-8 split across chunks',async()=>{
  const bytes=Buffer.concat([Buffer.from('作品集 👋'),Buffer.from([0,255,0,128]),Buffer.alloc(150_000,73)]),chunks=[bytes.subarray(0,1),bytes.subarray(1,7),bytes.subarray(7,500),bytes.subarray(500)];
  assert.deepEqual(await requestBytes(request(chunks,String(bytes.length))),bytes);
  assert.deepEqual(await requestBytes(request(chunks)),bytes);
  assert.deepEqual(await requestBytes(request([],'0')),Buffer.alloc(0));
});
test('declared and streamed sizes are bounded and incomplete uploads cannot be accepted',async()=>{
  await assert.rejects(requestBytes(request([],'11'),10),(e:any)=>e.status===413);
  await assert.rejects(requestBytes(request([Buffer.alloc(6),Buffer.alloc(5)]),10),(e:any)=>e.status===413);
  await assert.rejects(requestBytes(request([Buffer.alloc(4)],'3')),(e:any)=>e.status===400);
  await assert.rejects(requestBytes(request([Buffer.alloc(3)],'4')),(e:any)=>e.status===400);
  const aborted=new Error('Request aborted');await assert.rejects(requestBytes(request([Buffer.alloc(3)],'4',aborted)),e=>e===aborted);
});
