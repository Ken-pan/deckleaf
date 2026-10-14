import test from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,newDeck,element} from '../src/core/model';
import {draftRecord} from '../src/core/drafts';
import {saveDraftInBackground} from '../src/core/background-draft-save';
import {restoreDraft} from '../src/core/draft-media-transport';
import {writeStoredDraft} from '../src/core/draft-store';

test('draft routing avoids worker copies for unique/small media and commits factored media before acknowledging',async()=>{
  const originalWorker=globalThis.Worker,originalIDB=globalThis.indexedDB;
  let created=0,writes=0,last:unknown,transportBytes=0;const database:any={close(){},transaction(){
    const tx:any={objectStore(){return {put(record:unknown){last=structuredClone(record);writes++;queueMicrotask(()=>tx.oncomplete());}};}};return tx;
  }};
  globalThis.indexedDB={open(){const request:any={result:database};queueMicrotask(()=>request.onsuccess());return request;}} as unknown as IDBFactory;
  globalThis.Worker=class{
    onmessage:any;onerror:any;onmessageerror:any;
    constructor(){created++;queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}
    postMessage(message:any){const captured=structuredClone(message);transportBytes=JSON.stringify(captured.body).length;
      void writeStoredDraft(restoreDraft(captured.body)).then(()=>this.onmessage({data:{type:'result',id:captured.id}}));}
    terminate(){}
  } as unknown as typeof Worker;
  try{
    const slide=blankSlide();slide.elements=[element('image',{src:'data:image/png;base64,'+'A'.repeat(5_000_000)})];
    const unique=draftRecord(newDeck('Unique',[slide]),0);await saveDraftInBackground(unique);
    assert.equal(created,0);assert.equal(writes,1);assert.deepEqual(last,unique);
    const small=blankSlide();small.elements=[element('image',{src:'data:image/png;base64,'+'B'.repeat(70_000)}),element('image',{src:'data:image/png;base64,'+'B'.repeat(70_000)})];
    await saveDraftInBackground(draftRecord(newDeck('Small repeated',[small]),0));assert.equal(created,0);
    slide.elements=[...slide.elements,{...slide.elements[0],id:'second-image'}];const repeated=draftRecord(newDeck('Repeated',[slide]),0);
    await saveDraftInBackground(repeated);assert.equal(created,1);assert.equal(writes,3);assert.deepEqual(last,repeated);
    assert(transportBytes<6_000_000,'Repeated original media must cross the worker boundary once');
  }finally{globalThis.Worker=originalWorker;globalThis.indexedDB=originalIDB;database.onversionchange?.();}
});
