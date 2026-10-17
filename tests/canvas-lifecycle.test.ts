import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {clearTextSizeCache,textSizeEpoch} from '../src/core/text-layout';
import {observeFontLoading} from '../src/core/font-events';

test('one font completion invalidates shared measurements once for every subscribed canvas', () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');
  let added=0,removed=0;
  class Faces extends EventTarget {
    override addEventListener(...args:Parameters<EventTarget['addEventListener']>){added++;super.addEventListener(...args);}
    override removeEventListener(...args:Parameters<EventTarget['removeEventListener']>){removed++;super.removeEventListener(...args);}
  }
  const fonts=new Faces(),updates=new Array(40).fill(0);
  Object.defineProperty(globalThis,'document',{configurable:true,value:{fonts}});
  const invalidate=observeFontLoading(fonts as unknown as FontFaceSet,clearTextSizeCache);
  const stops=updates.map((_,index)=>observeFontLoading(fonts as unknown as FontFaceSet,()=>updates[index]++));
  try {
    assert.equal(added,1);
    let epoch=textSizeEpoch();fonts.dispatchEvent(new Event('loadingdone'));
    assert.equal(textSizeEpoch(),epoch+1);assert(updates.every(count=>count===1));
    stops[0]();epoch=textSizeEpoch();fonts.dispatchEvent(new Event('loadingdone'));
    assert.equal(textSizeEpoch(),epoch+1);assert.equal(updates[0],1);assert(updates.slice(1).every(count=>count===2));
    stops.slice(1).forEach(stop=>stop());assert.equal(removed,0);invalidate();assert.equal(removed,1);
    epoch=textSizeEpoch();fonts.dispatchEvent(new Event('loadingdone'));assert.equal(textSizeEpoch(),epoch);
  } finally {invalidate();stops.forEach(stop=>stop());if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document');}
});

test('generated welcome covers match the canonical authored templates without runtime story generation', async () => {
  await promisify(execFile)(process.execPath,['--import','tsx','scripts/build-template-covers.ts','--check']);
});
