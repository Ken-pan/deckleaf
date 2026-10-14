import {test} from 'node:test';import assert from 'node:assert/strict';import {DocumentFontRegistry} from '../src/core/document-fonts';
const font=(family:string,data='AAAA')=>({family,name:'Original.woff2',data:'data:font/woff2;base64,'+data,weight:'400',style:'normal' as const});
function fixture(){const held=new Set<FontFace>(),created:any[]=[];const registry=new DocumentFontRegistry({add:f=>{held.add(f);return held as unknown as FontFaceSet;},delete:f=>held.delete(f)},f=>{let complete!:()=>void;const ready=new Promise<void>(ok=>complete=ok);const face={family:f.family,load:()=>ready.then(()=>face)};created.push({font:f,face,complete});return face as unknown as FontFace;});return {registry,held,created};}
test('document font ownership releases closed-document faces and reloads equal-length replacements',async()=>{
 const {registry,held,created}=fixture();const first=registry.sync([font('Owned')]);created[0].complete();await first;assert.equal(held.size,1);
 const replacement=registry.sync([font('Owned','BBBB')]);assert.equal(created.length,2);assert(!held.has(created[0].face));created[1].complete();await replacement;await registry.sync([]);assert.equal(held.size,0);
});
test('in-flight readers pin only their fonts until released, including a late font completion',async()=>{
 const {registry,held,created}=fixture();const lease=registry.retain([font('Captured')]);await registry.sync([]);assert.equal(held.size,1);created[0].complete();await lease.ready;lease.release();lease.release();assert.equal(held.size,0);
 const pending=registry.sync([font('Closed before load')]);await registry.sync([]);created[1].complete();await pending;assert.equal(held.size,0);
});
test('busy exports defer retired-face cleanup until the captured work finishes',async()=>{
 const {registry,held,created}=fixture();const a=registry.sync([font('A')]);created[0].complete();await a;
 const b=registry.sync([font('B')],true);created[1].complete();await b;assert.equal(held.size,2);await registry.sync([font('B')]);assert.equal(held.size,1);registry.dispose();assert.equal(held.size,0);
});
