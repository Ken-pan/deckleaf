import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import JSZip from 'jszip';
import {NetlifyPublisher} from '../server/publishing';
import {newDeck,blankSlide} from '../src/core/model';
const html='<!doctype html><html><body>Original presentation evidence</body></html>';

test('website package is concrete, source-preserving and published once to its own site',async()=>{
 const root=await mkdtemp(join(tmpdir(),'deck-publish-'));const deck=newDeck('Publish fixture',[blankSlide()]),calls:string[]=[];let zip:JSZip|undefined;
 const transport:typeof fetch=async(url,init)=>{const path=new URL(String(url)).pathname;calls.push(path);assert.equal((init?.headers as any).Authorization,'Bearer fixture-secret');if(path.endsWith('/user'))return Response.json({id:'account'});if(path==='/api/v1/sites')return Response.json({id:'dedicated-site'});if(path==='/api/v1/sites/dedicated-site/deploys'){zip=await JSZip.loadAsync(init!.body as Uint8Array);return Response.json({id:'deploy-1',state:'processing'});}if(path==='/api/v1/deploys/deploy-1')return Response.json({id:'deploy-1',state:'ready',ssl_url:'https://presentation-fixture.netlify.app'});throw new Error(`Unexpected endpoint ${path}`);};
 const publisher=new NetlifyPublisher(root,transport,async()=>deck,()=>''),before=JSON.stringify(deck);
 try{await publisher.connect('fixture-secret');const draft=await publisher.prepare(deck.id,0,html);assert.equal(draft.state,'prepared');assert.equal(await (await publisher.html(draft.id)).toString(),html);assert(!JSON.stringify(draft).includes('fixture-secret'));
  await assert.rejects(()=>publisher.publish(draft.id,{deckId:deck.id,revision:0,sha256:'wrong'}),/package changed/);assert.equal(calls.length,1);
  const confirmation={deckId:deck.id,revision:0,sha256:draft.sha256};const [a,b]=await Promise.all([publisher.publish(draft.id,confirmation),publisher.publish(draft.id,confirmation)]);assert.equal(a.url,b.url);assert.equal(a.state,'published');assert.equal(calls.filter(p=>p==='/api/v1/sites').length,1);assert.equal(calls.filter(p=>p.endsWith('/deploys')).length,1);assert.equal(await zip!.file('index.html')!.async('string'),html);assert.equal(JSON.stringify(deck),before);
  assert(!String(await readFile(join(root,draft.id,'metadata.json'))).includes('fixture-secret'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('publication rejects stale revisions and preserves unknown network outcomes instead of repeating writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'deck-publish-unknown-'));let deck=newDeck('Fixture',[blankSlide()]),writes=0;
 const publisher=new NetlifyPublisher(root,async(url)=>{const path=new URL(String(url)).pathname;if(path.endsWith('/sites')){writes++;throw new TypeError('Network disconnected');}return Response.json({id:'user'});},async()=>deck,()=> 'fixture-key');
 try{const draft=await publisher.prepare(deck.id,0,html);deck={...deck,revision:1};await assert.rejects(()=>publisher.publish(draft.id,{deckId:deck.id,revision:0,sha256:draft.sha256}),/document changed/);assert.equal(writes,0);deck={...deck,revision:0};await assert.rejects(()=>publisher.publish(draft.id,{deckId:deck.id,revision:0,sha256:draft.sha256}),/Network/);assert.equal((await publisher.read(draft.id)).state,'unknown');await assert.rejects(()=>publisher.publish(draft.id,{deckId:deck.id,revision:0,sha256:draft.sha256}),/unknown result/);assert.equal(writes,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('provider processing is never labeled published before ready and token errors remain recoverable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'deck-publish-processing-'));const deck=newDeck('Fixture',[blankSlide()]);let ready=false;
 const publisher=new NetlifyPublisher(root,async(url)=>{const p=new URL(String(url)).pathname;if(p.endsWith('/user'))return Response.json({error:'fixture-secret'},{status:401});if(p==='/api/v1/sites')return Response.json({id:'site'});if(p.endsWith('/sites/site/deploys'))return Response.json({id:'deploy'});return Response.json({state:ready?'ready':'processing',ssl_url:'https://fixture.netlify.app'});},async()=>deck,()=> 'server-key');
 try{await assert.rejects(()=>publisher.connect('fixture-secret'),e=>e instanceof Error&&!e.message.includes('fixture-secret'));const draft=await publisher.prepare(deck.id,0,html);const processing=await publisher.publish(draft.id,{deckId:deck.id,revision:0,sha256:draft.sha256});assert.equal(processing.state,'processing');assert.equal(processing.url,undefined);ready=true;assert.equal((await publisher.status(draft.id)).state,'published');
 }finally{await rm(root,{recursive:true,force:true});}
});
