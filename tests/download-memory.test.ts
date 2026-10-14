import {test} from 'node:test';import assert from 'node:assert/strict';import {download} from '../src/core/download';

test('downloads release their URL after the startup grace and page exit without holding the Blob in JS',()=>{
 const originals={document:globalThis.document,window:globalThis.window,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout,clear:globalThis.clearTimeout};
 const revoked:string[]=[],timers:{run:()=>void;delay:number}[]=[];let hide!:()=>void,sequence=0;
 globalThis.document={createElement:()=>({href:'',download:'',click(){}})} as unknown as Document;globalThis.window={addEventListener:(_name:string,run:()=>void)=>{hide=run;}} as unknown as Window & typeof globalThis;
 URL.createObjectURL=()=>`blob:download-${++sequence}`;URL.revokeObjectURL=url=>revoked.push(url);
 globalThis.setTimeout=((run:()=>void,delay:number)=>{timers.push({run,delay});return timers.length;}) as unknown as typeof setTimeout;globalThis.clearTimeout=(()=>{}) as typeof clearTimeout;
 try{download(new Blob(['protected export']),'one.json');assert.equal(timers[0].delay,1000);timers[0].run();assert.deepEqual(revoked,['blob:download-1']);download('two','two.json');hide();assert.deepEqual(revoked,['blob:download-1','blob:download-2']);}
 finally{globalThis.document=originals.document;globalThis.window=originals.window;URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke;globalThis.setTimeout=originals.timer;globalThis.clearTimeout=originals.clear;}
});
