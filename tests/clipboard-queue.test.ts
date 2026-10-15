import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClipboardQueue} from '../src/core/clipboard-queue';

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}
test('rapid paste requests serialize and advance only through their own committed contexts',async()=>{
  const queue=new ClipboardQueue(),gate=deferred();let revision=0;const commits:number[]=[];
  const run=()=>queue.run(String(revision),()=>String(revision),async current=>{if(!commits.length)await gate.promise;assert.equal(current,String(revision));commits.push(++revision);return String(revision);});
  const first=run(),second=run(),third=run();gate.resolve();await Promise.all([first,second,third]);assert.deepEqual(commits,[1,2,3]);
  await run();assert.deepEqual(commits,[1,2,3,4]);
});
test('a manual context change cancels stale queued requests and a fresh request still works',async()=>{
  const queue=new ClipboardQueue(),gate=deferred();let context='original',commits=0;
  const action=async(current:string)=>{await gate.promise;if(context!==current)throw Error('changed');commits++;return context='paste';};
  const first=queue.run(context,()=>context,action),second=queue.run(context,()=>context,action);await Promise.resolve();context='manual edit';gate.resolve();
  const results=await Promise.allSettled([first,second]);assert(results.every(r=>r.status==='rejected'));assert.equal(commits,0);assert.equal(context,'manual edit');
  await queue.run(context,()=>context,async()=>{commits++;return context='fresh paste';});assert.equal(commits,1);
});
test('a failed paste does not poison later requests or merge their undo boundaries',async()=>{
  const queue=new ClipboardQueue();let context='0',commits=0;
  const bad=queue.run(context,()=>context,async()=>{throw Error('Invalid clipboard');});
  const good=queue.run(context,()=>context,async()=>{commits++;return context='1';});
  const result=await Promise.allSettled([bad,good]);assert.equal(result[0].status,'rejected');assert.equal(result[1].status,'fulfilled');assert.equal(commits,1);
});
test('paste, history and another paste preserve the arrival order during a cold load',async()=>{
  const queue=new ClipboardQueue(),gate=deferred();let context='0';const order:string[]=[];
  const run=(name:string,wait=false)=>queue.run(context,()=>context,async()=>{if(wait)await gate.promise;order.push(name);return context=String(Number(context)+1);});
  const paste=run('paste',true),undo=run('undo'),pasteAgain=run('paste again'),redo=run('redo');
  assert.equal(queue.busy,true);gate.resolve();await Promise.all([paste,undo,pasteAgain,redo]);
  assert.deepEqual(order,['paste','undo','paste again','redo']);assert.equal(queue.busy,false);
});
test('a pending container edit and its Undo are both rejected after changing documents',async()=>{
  const queue=new ClipboardQueue('Context changed'),gate=deferred();let context='document one';const order:string[]=[];
  const first=queue.run(context,()=>context,async current=>{await gate.promise;if(context!==current)throw Error('Context changed');order.push('group');return context;});
  const undo=queue.run(context,()=>context,async()=>{order.push('undo');return context;});
  await Promise.resolve();context='document two';gate.resolve();const result=await Promise.allSettled([first,undo]);
  assert(result.every(r=>r.status==='rejected'));assert.deepEqual(order,[]);assert.equal(queue.busy,false);
});
