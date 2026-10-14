import {exportGoogle as exportGoogleWithPlan} from '../src/core/google-export';
import {googleFingerprint as canonicalGoogleSource} from '../src/core/google-export';
export function googleFingerprint(presentation:any){return sha(canonicalGoogleSource(presentation));}
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DATA} from './store';
import {GoogleSourceSchema} from '../src/core/model';
import {importGoogleBundle} from '../src/importers/google-native';
import {keynoteState} from '../src/core/keynote-source';
import {googleTextEdits,googleEditRequests,googleVisibilityRequests} from '../src/core/google-source';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function preserveGoogleSource(bundle:any){
 const presentationId=bundle?.presentation?.presentationId;
 if(bundle?.kind!=='google-rest'||! /^[\w-]{10,200}$/.test(presentationId??'')||!bundle.presentation.slides?.length||bundle.presentation.slides.length>100)throw new Error('Import a native Google Slides export with its presentation ID.');
 const deck=await importGoogleBundle(bundle),presentation=JSON.parse(JSON.stringify(bundle.presentation));
 const strip=(value:any)=>{if(!value||typeof value!=='object')return;delete value.contentUrl;for(const child of Object.values(value))strip(child);};strip(presentation);
 const source=JSON.stringify({kind:'google-rest',presentation,url:`https://docs.google.com/presentation/d/${presentationId}/edit`}),id=randomUUID(),dir=resolve(DATA,'imports',id);
 await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'google-source.json'),source,{mode:0o600});
 await writeFile(resolve(dir,'google-state.json'),JSON.stringify(await keynoteState(deck)),{mode:0o600});
 return GoogleSourceSchema.parse({id,sha256:sha(source),presentationId});
}
export async function googleExportPlan(sourceInput:unknown,state:unknown){
 const source=GoogleSourceSchema.parse(sourceInput),dir=resolve(DATA,'imports',source.id),raw=await readFile(resolve(dir,'google-source.json'),'utf8');
 if(sha(raw)!==source.sha256)throw new Error('The preserved Google source has changed.');
 const bundle=JSON.parse(raw);if(bundle.presentation.presentationId!==source.presentationId)throw new Error('The preserved Google source does not match this document.');
 const baseline=JSON.parse(await readFile(resolve(dir,'google-state.json'),'utf8'));
 const edits=googleTextEdits(baseline,state),visibility=googleVisibilityRequests(state,bundle.presentation);
 return {source,sourceFingerprint:googleFingerprint(bundle.presentation),requests:[...googleEditRequests(edits,bundle.presentation),...visibility],edits:edits.length+visibility.length};
}
export {verifyGoogleExport} from '../src/core/google-export';
export const exportGoogle=(input:any,transport:typeof fetch=fetch,planFactory=googleExportPlan)=>exportGoogleWithPlan(input,transport,planFactory,googleFingerprint);
