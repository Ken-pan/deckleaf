import {GoogleSourceSchema} from '../model';
import {importGoogleBundle} from '../../importers/google-native';
import {keynoteState} from '../keynote-source';
import {googleTextEdits,googleEditRequests,googleVisibilityRequests} from '../google-source';
import {googleFingerprint,exportGoogle} from '../google-export';
import {readWebSource,writeWebRecord} from './store';
import {sha256} from './media';

export async function preserveBrowserGoogleSource(bundle:any){
  const presentationId=bundle?.presentation?.presentationId;
  if(bundle?.kind!=='google-rest'||! /^[\w-]{10,200}$/.test(presentationId??'')||!bundle.presentation.slides?.length||bundle.presentation.slides.length>100)throw new Error('Import a native Google Slides export with its presentation ID.');
  const deck=await importGoogleBundle(bundle),presentation=structuredClone(bundle.presentation);
  const strip=(value:any)=>{if(!value||typeof value!=='object')return;delete value.contentUrl;for(const child of Object.values(value))strip(child);};strip(presentation);
  const raw=JSON.stringify({kind:'google-rest',presentation,url:`https://docs.google.com/presentation/d/${presentationId}/edit`});
  const source=GoogleSourceSchema.parse({id:crypto.randomUUID(),sha256:await sha256(new TextEncoder().encode(raw)),presentationId});
  await writeWebRecord('sources',{id:source.id,raw,baseline:await keynoteState(deck)});
  return {googleSource:source};
}
export async function browserGooglePlan(input:unknown,state:unknown){
  const source=GoogleSourceSchema.parse(input),record=await readWebSource<{raw:string;baseline:any}>(source.id);
  if(!record)throw new Error('The Google source is not stored in this browser. Import the original Google bundle again, or export PowerPoint.');
  if(await sha256(new TextEncoder().encode(record.raw))!==source.sha256)throw new Error('The preserved Google source failed validation.');
  const bundle=JSON.parse(record.raw);
  if(bundle.presentation.presentationId!==source.presentationId)throw new Error('The preserved source does not match this document.');
  const edits=googleTextEdits(record.baseline,state),visibility=googleVisibilityRequests(state,bundle.presentation);
  return {source,sourceFingerprint:googleFingerprint(bundle.presentation),requests:[...googleEditRequests(edits,bundle.presentation),...visibility],edits:edits.length+visibility.length};
}
export async function browserGoogleExport(path:string,body:any){
  return path.endsWith('/plan')?browserGooglePlan(body.source,body.state):exportGoogle(body,fetch,browserGooglePlan);
}
