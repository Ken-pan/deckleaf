import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {newDeck,blankSlide} from '../src/core/model';

test('a static directory read failure returns JSON before headers and leaves the resource server running', async () => {
  const directory=await mkdtemp(resolve(tmpdir(),'deck-resource-server-'));
  const reservation=createServer();await new Promise<void>(ok=>reservation.listen(0,'127.0.0.1',ok));
  const port=(reservation.address() as any).port;await new Promise<void>(ok=>reservation.close(()=>ok()));
  await mkdir(resolve(directory,'dist/resources'),{recursive:true});await writeFile(resolve(directory,'dist/index.html'),'<!doctype html><title>Fixture</title>');
  const processPath=resolve('server/index.ts');
  const child=spawn(process.execPath,['--import',import.meta.resolve('tsx'),processPath],{cwd:directory,env:{...process.env,NODE_ENV:'production',PORT:String(port),DECK_STUDIO_DATA:resolve(directory,'data')},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',data=>stderr+=data.toString());
  try {
    await new Promise<void>((ok,no)=>{const timer=setTimeout(()=>no(new Error('Server startup timed out: '+stderr)),10000);child.stdout.on('data',data=>{if(data.toString().includes('Decksprig')){clearTimeout(timer);ok();}});child.once('exit',code=>{clearTimeout(timer);no(new Error(`Server exited ${code}: ${stderr}`));});});
    const response=await fetch(`http://127.0.0.1:${port}/resources/`);assert.equal(response.status,404);assert.equal((await response.json()).error,'File not found.');
    const decks=await fetch(`http://127.0.0.1:${port}/api/decks`);assert.equal(decks.status,200);assert.deepEqual(await decks.json(),[]);
    const blank=newDeck('Explicit blank',[blankSlide()]);
    const created=await fetch(`http://127.0.0.1:${port}/api/decks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(blank)});assert.equal(created.status,200);
    const opened=await fetch(`http://127.0.0.1:${port}/api/decks/${blank.id}`);assert.equal(opened.status,200);assert.deepEqual(await opened.json(),blank);
    assert(!stderr.includes('ERR_HTTP_HEADERS_SENT'));
  } finally { child.kill('SIGTERM');await new Promise<void>(ok=>{if(child.exitCode!==null)ok();else child.once('exit',()=>ok());});await rm(directory,{recursive:true,force:true}); }
});
