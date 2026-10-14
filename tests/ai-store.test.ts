import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blankSlide, element, newDeck } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { proposeAI } from '../server/ai';
import {createGroupLayout} from '../src/core/group-commands';

test('AI transport produces validated proposals, preserves rich text and rejects edits outside scope', async () => {
  const s = blankSlide('Source'), e = element('text', {text: 'Original', runs: [{text: 'Original', bold: true}]}); s.elements.push(e);
  const deck = newDeck('Source deck', [s, blankSlide('Other slide')]);
  let received: any, outside = false;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); received = JSON.parse(Buffer.concat(chunks).toString());
    res.setHeader('Content-Type', 'application/json');
    const proposal = {baseRevision: 0, summary: 'Fixture model response', operations: [{op: 'update_element', slideId: outside ? deck.slides[1].id : s.id, elementId: e.id, patch: {text: 'Edited'}}]};
    res.end(JSON.stringify({choices: [{message: {content: JSON.stringify(proposal)}}]}));
  });
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as any).port;
  try {
    const settings = {provider: 'compatible' as const, baseUrl: `http://127.0.0.1:${port}/v1`, model: 'fixture'};
    const scope = {slideIds: [s.id], elementIds: [e.id]};
    const proposal = await proposeAI(deck, 'Edit selected text', scope, settings);
    assert.equal(proposal.operations.length, 1);
    assert.equal(applyOperations(deck, proposal.operations, proposal.baseRevision, 'ai').slides[0].elements[0].runs?.[0].text, 'Edited');
    const input = JSON.parse(received.messages[1].content); assert.equal(input.deck.slides.length, 1); assert.equal(input.scope.elementIds[0], e.id);
    assert.equal(Object.hasOwn(input.deck.slides[0],'title'),false);assert.equal(input.deck.title,'Source deck');assert.deepEqual(input.pages,[{id:s.id,number:1}]);
    outside = true; await assert.rejects(() => proposeAI(deck, 'Edit selected text', scope, settings), /outside the selected scope/);
    assert.equal(deck.slides[0].elements[0].text, 'Original');
  } finally { await new Promise<void>(ok => server.close(() => ok())); }
});
test('concurrent disk saves reject stale writers and preserve the winner', async () => {
  process.env.DECK_STUDIO_DATA = await mkdtemp(join(tmpdir(), 'deck-studio-store-test-'));
  const store = await import('../server/store'); await store.initStore();
  const s = blankSlide('Versioned'); const deck = newDeck('Concurrency fixture', [s]); await store.saveDeck(deck, null);
  const first = applyOperations(deck, [{op: 'update_slide', slideId: s.id, patch: {notes: 'A'}}]);
  const second = applyOperations(deck, [{op: 'update_slide', slideId: s.id, patch: {notes: 'B'}}]);
  const writes = await Promise.allSettled([store.saveDeck(first, 0), store.saveDeck(second, 0)]);
  assert.equal(writes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(writes.filter(x => x.status === 'rejected').length, 1);
  assert.equal((await store.readDeck(deck.id)).slides[0].notes, 'A');
});
test('nested AI proposals respect complete subtree scope and reject indirect movement outside the selection',async()=>{
  const s=blankSlide();s.elements=[element('rect',{id:'ai-a',x:0,y:0,w:80,h:40}),element('rect',{id:'ai-b',x:0,y:120,w:80,h:40})];
  let deck=newDeck('Nested scope',[s]);deck=applyOperations(deck,createGroupLayout(deck.slides[0],['ai-a']));const child=deck.slides[0].autoLayouts![0].id;
  deck=applyOperations(deck,createGroupLayout(deck.slides[0],['ai-a','ai-b']));const parent=deck.slides[0].groups!.find(g=>!g.parent)!.id;
  let operations:any[]=[{op:'set_group',slideId:s.id,group:{...deck.slides[0].groups!.find(g=>g.id===child),name:'Renamed child'}}];
  const server=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({baseRevision:deck.revision,summary:'Nested fixture',operations})}}]}));});
  await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));
  const settings={provider:'compatible' as const,baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,model:'fixture'},scope={slideIds:[s.id],elementIds:['ai-a']};
  try{
    assert.equal((await proposeAI(deck,'Rename this child',scope,settings)).operations.length,1);
    operations=[{op:'set_group_layout',slideId:s.id,layout:{...deck.slides[0].autoLayouts!.find(l=>l.id===parent),gap:200}}];await assert.rejects(()=>proposeAI(deck,'Edit parent',scope,settings),/outside the selected scope/);
    operations=[{op:'update_element',slideId:s.id,elementId:'ai-a',patch:{h:250}}];await assert.rejects(()=>proposeAI(deck,'Grow child',scope,settings),/outside the selected scope/);
    assert.equal(deck.slides[0].elements[0].h,40);
  }finally{await new Promise<void>(ok=>server.close(()=>ok()));}
});
