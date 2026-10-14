import type {ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {Deck} from '../src/core/model';
import {boundedDocumentJsonParts} from '../src/core/document-json-parts';

// Complete document responses follow network backpressure instead of keeping
// a full JSON string and a full encoded response in the server's write queue.
export async function sendDocumentJson(res:ServerResponse,deck:Deck,status=200){
  if(res.headersSent||res.destroyed||res.writableEnded)return;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  try{await pipeline(Readable.from(boundedDocumentJsonParts(deck),{objectMode:false,highWaterMark:262_144}),res);}
  catch{res.destroy();} // A disconnected client must stop producing more parts.
}
