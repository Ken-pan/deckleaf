import {open,rename,unlink} from 'node:fs/promises';
import type {Deck} from '../src/core/model';
import {boundedDocumentJsonParts} from '../src/core/document-json-parts';

// Keep only one bounded encoding batch, then atomically replace the file. A
// single embedded object can exceed the batch size; no full deck string or Blob
// is built. Failure leaves the existing document/history file untouched.
export async function writeDocumentJsonFile(path:string,deck:Deck) {
  const temp=`${path}.${crypto.randomUUID()}.tmp`;
  try{
    const file=await open(temp,'wx',0o600);
    try{
      for(const part of boundedDocumentJsonParts(deck))await file.writeFile(part,'utf8');
    }finally{await file.close();}
    await rename(temp,path);
  }catch(error){await unlink(temp).catch(()=>{});throw error;}
}
