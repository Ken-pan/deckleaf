import {createHash} from 'node:crypto';
import {DATA} from './store';
import {workflows} from './workflows';
import type {EditingServices} from '../src/core/ai-tools';
import {WorkflowRequestSchema,type WorkflowServices} from '../src/core/workflows';

export const workspaceIdentity=createHash('sha256').update(DATA).digest('hex').slice(0,32);
/** Read session metadata from the matching editor; never import its credentials. */
export function mcpWorkflowServices(transport:typeof fetch=fetch,port=Number(process.env.DECK_STUDIO_EDITOR_PORT||4310),identity=workspaceIdentity):WorkflowServices {
 const origin=Number.isInteger(port)&&port>0&&port<=65535?`http://127.0.0.1:${port}`:undefined;
 const readEditor=async(path:string)=>{if(!origin)return undefined;try{const response=await transport(origin+path,{signal:AbortSignal.timeout(1500),redirect:'error'});return response.ok?await response.json():undefined;}catch{return undefined;}};
 const connection=async()=>{const value=await readEditor('/api/workflows/connections');return value?.workspaceId===identity?{...value,google:{...value.google,connected:null,sessionStatus:'Checked in the editor browser'}}:undefined;};
 return {
  list:(deckId,input)=>workflows.page(deckId,input),
  request:(deck,action)=>workflows.request(deck,action),
  read:async id=>{const request=await workflows.read(id);if(await connection()){const live=await readEditor(`/api/workflows/${id}`);if(live?.deckId===request.deckId)return WorkflowRequestSchema.parse(live);}return request;},
  connections:async()=>await connection()??{runtime:'mcp',editorReachable:false,sessionStatus:'Unknown. Open the matching editor to inspect or connect browser/server sessions.',google:{browserScoped:true,connected:null},netlify:{configured:Boolean(process.env.NETLIFY_AUTH_TOKEN),connected:null},figma:{browserScoped:true,connected:null},ai:{configured:Boolean(process.env.OPENAI_API_KEY||process.env.DECK_AI_KEY)},photos:{sessionScoped:true,connected:null}},
 };
}


/** Photo services share the editor's verified session without sharing any key. */
export function mcpEditingServices(fallback:EditingServices,transport:typeof fetch=fetch,port=Number(process.env.DECK_STUDIO_EDITOR_PORT||4310),identity=workspaceIdentity):EditingServices {
 const origin=Number.isInteger(port)&&port>0&&port<=65535?`http://127.0.0.1:${port}`:undefined;
 const remote=async(path:string,body?:unknown)=>{
  if(!origin)return undefined;
  try{const status=await transport(origin+'/api/workflows/connections',{signal:AbortSignal.timeout(1500),redirect:'error'});if(!status.ok||(await status.json()).workspaceId!==identity)return undefined;}catch{return undefined;}
  const response=await transport(origin+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000),redirect:'error'});const value=await response.json();if(!response.ok)throw new Error(value.error||'The editor could not retrieve this resource.');return value;
 };
 return {resourceCatalog:fallback.resourceCatalog,searchResources:async params=>['unsplash','pexels'].includes(params.get('source')??'')?await remote('/api/resources/search?'+params)??fallback.searchResources(params):fallback.searchResources(params),importResource:async input=>/^(unsplash|pexels):/.test(input.id)?await remote('/api/resources/import',input)??fallback.importResource(input):fallback.importResource(input)};
}


export async function mcpEditorContext(deckId?:string,transport:typeof fetch=fetch,port=Number(process.env.DECK_STUDIO_EDITOR_PORT||4310),identity=workspaceIdentity){
 if(Number.isInteger(port)&&port>0&&port<=65535)try{const response=await transport(`http://127.0.0.1:${port}/api/agent/context${deckId?'?deckId='+encodeURIComponent(deckId):''}`,{signal:AbortSignal.timeout(1500),redirect:'error'});if(response.ok){const value=await response.json();if(value.workspaceId===identity){delete value.workspaceId;return value;}}else{const status=await transport(`http://127.0.0.1:${port}/api/workflows/connections`,{signal:AbortSignal.timeout(1500),redirect:'error'});if(status.ok&&(await status.json()).workspaceId===identity)return {state:'context_unavailable',editorReachable:true,next:'The matching editor is reachable, but its document context is unavailable. Preserve the local draft, then save or reopen it, or use list_decks to select a saved document. Do not guess the current selection.'};}}catch{/* Unknown editor state never chooses a document. */}
 return {state:'editor_unavailable',editorReachable:false,next:'Open the matching editor or use list_decks to choose a saved document. Do not guess the current selection.'};
}
