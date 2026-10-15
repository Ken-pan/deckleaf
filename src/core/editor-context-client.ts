import {jsonRequest} from './json-request';
import {isBrowserEdition} from './runtime';
import {workflowClientId} from './workflow-session';
import type {EditorContext} from './editor-context';
let signature='',lastSent=0,pending=false,timer:ReturnType<typeof setTimeout>|undefined,latest:Omit<EditorContext,'clientId'>|undefined;
export function publishEditorContext(value:Omit<EditorContext,'clientId'>){if(isBrowserEdition)return;latest=value;if(!timer)timer=setTimeout(()=>void flushContext(),150);}
async function flushContext(){timer=undefined;if(pending||!latest)return;const value=latest,encoded=JSON.stringify(value);if(encoded===signature&&Date.now()-lastSent<5000)return;pending=true;try{await jsonRequest('/api/agent/context','POST',{clientId:workflowClientId,...value});signature=encoded;lastSent=Date.now();}catch{/* An unavailable observer never blocks editing. */}finally{pending=false;if(latest&&JSON.stringify(latest)!==encoded&&!timer)timer=setTimeout(()=>void flushContext(),150);}}
