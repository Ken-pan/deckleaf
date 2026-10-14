import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {blankSlide,newDeck,element} from '../src/core/model';
import {writeDocumentJsonFile} from '../server/document-json-file';

test('bounded disk encoding preserves exact compact JSON, original assets and private file mode',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'deck-json-file-'));
  try{
    const deck=newDeck('中文 🐈',[blankSlide('Original')]);
    deck.slides[0].elements=Array.from({length:12},(_,i)=>element('image',{name:'Asset '+i,src:'data:image/png;base64,'+'A'.repeat(300000)}));
    deck.slides[0].notes='\nQuoted " <source> 🐈';
    deck.slides[0].source={provider:'Original PDF',render:'data:image/png;base64,'+'B'.repeat(300000),fidelity:'source-render',warnings:['Preserved']};
    const before=JSON.stringify(deck),path=join(directory,'document.json');
    await writeDocumentJsonFile(path,deck);
    assert.equal(await readFile(path,'utf8'),before);assert.equal(JSON.stringify(deck),before);
    assert.equal((await stat(path)).mode&0o777,0o600);assert.deepEqual(await readdir(directory),['document.json']);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('partial encoding failure retains the original file and releases the temporary file',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'deck-json-failure-'));
  try{
    const path=join(directory,'document.json');await writeFile(path,'original bytes');
    const deck=newDeck('Failure',[blankSlide('Source')]);
    deck.slides[0].elements=[element('image',{src:'data:image/png;base64,'+'A'.repeat(300000)}),{toJSON(){throw new Error('Synthetic encoding failure');}} as any];
    await assert.rejects(writeDocumentJsonFile(path,deck),/Synthetic encoding failure/);
    assert.equal(await readFile(path,'utf8'),'original bytes');assert.deepEqual(await readdir(directory),['document.json']);
  }finally{await rm(directory,{recursive:true,force:true});}
});
