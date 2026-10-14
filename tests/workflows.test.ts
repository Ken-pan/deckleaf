import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {newDeck,blankSlide,element} from '../src/core/model';
import {publicationDocument} from '../src/core/publication';
import {WorkflowStore} from '../server/workflows';
import {workflowTools,validateWorkflow,WorkflowActionSchema} from '../src/core/workflows';
import {strictToolSchema} from '../src/core/ai-tools';
import {runAI} from '../server/ai';
import {requestAI} from '../src/core/ai-client';

test('workflow requests are revision-bound, deduplicated and leased across editor windows',async()=>{
 const root=await mkdtemp(join(tmpdir(),'deck-workflows-'));let deck=newDeck('Actions fixture',[blankSlide()]);const store=new WorkflowStore(root,async()=>deck);
 try{const action={kind:'export' as const,format:'json' as const,version:'editable' as const};const [a,b]=await Promise.all([store.request(deck,action),store.request(deck,action)]);assert.equal(a.id,b.id);assert.equal(a.status,'pending');
  await assert.rejects(()=>store.resolve(a.id,crypto.randomUUID(),'completed',{message:'not executed'}),/Claim/);
  const client=crypto.randomUUID();await store.claim(a.id,client);await assert.rejects(()=>store.claim(a.id,crypto.randomUUID()),/running/);assert.equal((await store.request(deck,action)).id,a.id);
  await assert.rejects(()=>store.resolve(a.id,crypto.randomUUID(),'completed',{message:'wrong window'}),/another/);await store.resolve(a.id,client,'completed',{message:'File prepared',fileName:'fixture.deck.json',state:'download_started'});assert.equal((await store.read(a.id)).status,'completed');assert.equal((await store.list(deck.id)).length,0);
  const next=await store.request(deck,{kind:'presentation',command:'start',version:'editable'});deck={...deck,revision:1};await assert.rejects(()=>store.claim(next.id,client),/changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('workflow schemas reject credentials and unavailable source export/navigation before execution',()=>{
 const deck=newDeck('Fixture',[blankSlide()]);assert.throws(()=>WorkflowActionSchema.parse({kind:'account',provider:'netlify',command:'connect',token:'secret'}));
 for(const url of ['https://user:secret@figma.com/file/id','https://figma.com/file/id?token=secret','https://figma.com/file/id?api_key=secret'])assert.throws(()=>validateWorkflow(deck,{kind:'import',source:'figma',url}),/credentials/);
 assert.throws(()=>validateWorkflow(deck,{kind:'export',format:'html',version:'reference'}),/source reference/);assert.throws(()=>validateWorkflow(deck,{kind:'presentation',command:'go_to'}),/slide ID/);assert.throws(()=>validateWorkflow(deck,{kind:'publish',target:'google',includeNotes:false}),/Google Slides source/);
 assert.equal(validateWorkflow(deck,{kind:'publish',target:'web'}).kind,'publish');
});

test('AI batches real workflow requests and returns queued receipts without claiming completion',async()=>{
 const deck=newDeck('Workflow fixture',[blankSlide()]);const requests:any[]=[];
 const request=async(_deck:any,action:any)=>{const d=new Date().toISOString(),value={id:crypto.randomUUID(),deckId:deck.id,baseRevision:0,action,status:'pending' as const,createdAt:d,updatedAt:d};requests.push(value);return value;};
 const transport:typeof fetch=async()=>Response.json({output:[{type:'function_call',call_id:'export',name:'request_export',arguments:JSON.stringify({format:'html',version:'editable'})},{type:'function_call',call_id:'publish',name:'request_publish',arguments:JSON.stringify({target:'web',includeNotes:false})}]});
 const result=await runAI(deck,'Export HTML then prepare its website',{slideIds:deck.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture'},{transport,workflowServices:{request,read:async id=>requests.find(r=>r.id===id),connections:async()=>({netlify:{connected:false}})}});
 assert('kind' in result);assert.equal(result.kind,'workflow');assert.equal(result.request.status,'pending');assert.equal(result.additionalRequests?.length,1);assert.equal(deck.revision,0);
 const defs=workflowTools(async()=>deck,{request,read:async id=>requests.find(r=>r.id===id),connections:async()=>({})});assert(defs.some(t=>t.name==='request_presentation'));assert(defs.some(t=>t.name==='request_workspace_action'));
});

test('streamed AI client accepts durable workflow outcomes and still validates document proposals',async()=>{
 const deck=newDeck('Stream fixture',[blankSlide()]),d=new Date().toISOString();const outcome={kind:'workflow',request:{id:crypto.randomUUID(),deckId:deck.id,baseRevision:0,action:{kind:'publish',target:'web',includeNotes:false},status:'pending' as const,createdAt:d,updatedAt:d}};
 const result=await requestAI({deck,prompt:'Prepare the website',scope:{slideIds:[deck.slides[0].id],elementIds:[]},settings:{provider:'compatible',baseUrl:'',model:'fixture'}},{},async()=>new Response(`data: ${JSON.stringify({type:'workflow',data:outcome})}\n\n`,{headers:{'Content-Type':'text/event-stream'}}));
 assert('kind' in result);assert.equal(result.kind,'workflow');assert.equal(result.request.action.kind,'publish');
});


test('workflow wire schemas stay within strict provider formats and keep runtime URL validation',()=>{
 const deck=newDeck('Schemas',[blankSlide()]);const tools=workflowTools(async()=>deck,{request:async()=>{throw Error('unused');},read:async()=>{throw Error('unused');},connections:async()=>({})});
 for(const tool of tools){const schema=strictToolSchema(tool.schema);const walk=(value:any)=>{if(!value||typeof value!=='object')return;if(typeof value.format==='string')assert(['date-time','time','date','duration','email','hostname','ipv4','ipv6','uuid'].includes(value.format));Object.values(value).forEach(walk);};walk(schema);assert.equal(schema.additionalProperties,false);}
 assert.throws(()=>tools.find(t=>t.name==='request_import')!.schema.parse({source:'figma',url:'http://unsafe.test?token=fixture'}));
});


test('AI final envelope separates status answers from editing and loads genuine receipts',async()=>{
 const deck=newDeck('Status fixture',[blankSlide()]),date=new Date().toISOString();const receipt={id:crypto.randomUUID(),deckId:deck.id,baseRevision:0,action:{kind:'export' as const,format:'html' as const,version:'editable' as const},status:'pending' as const,createdAt:date,updatedAt:date};let requested=0;
 const transport:typeof fetch=async(_url,init)=>{const input=JSON.parse(String(init!.body));assert.equal(input.text.format.name,'deck_ai_result');return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({resultJson:JSON.stringify({kind:'information',message:'Awaiting editor execution',requestId:receipt.id,receipt:{status:'completed'}})})}]}]});};
 const value=await runAI(deck,'Check status',{slideIds:[deck.slides[0].id],elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture'},{transport,workflowServices:{request:async()=>{requested++;return receipt;},read:async()=>receipt,connections:async()=>({})}});assert('kind' in value&&value.kind==='information');assert.equal(value.receipt!.status,'pending');assert.equal(requested,0);assert.equal(deck.revision,0);
});


test('public website packages omit import archives, hidden content and optional notes without changing sources',()=>{
 const deck=newDeck('Public fixture',[blankSlide()]);deck.slides[0].notes='Private speaker notes';deck.slides[0].source={provider:'Original',fidelity:'native',render:'data:image/png;base64,AAAA',warnings:['Private evidence']};deck.slides[0].elements=[element('text',{text:'Visible'}),element('text',{text:'Hidden draft',hidden:true})];
 (deck as any).googleSource={raw:'Private speaker notes in archive'};(deck as any).nativeSource={data:'Private original bytes'};(deck as any).provenance={private:'Import metadata'};const before=JSON.stringify(deck);const published=publicationDocument(deck);assert.equal(published.slides[0].notes,'');assert.equal(published.slides[0].elements.length,1);assert(!JSON.stringify(published).includes('Private'));assert.equal(published.slides[0].source,undefined);assert.equal(publicationDocument(deck,true).slides[0].notes,'Private speaker notes');assert.equal(JSON.stringify(deck),before);
});

test('MCP reads session metadata only from the matching editor and returns unknown for foreign/offline sessions',async()=>{
 const {mcpWorkflowServices}=await import('../server/mcp-workflows');let matching=true;const transport:typeof fetch=async()=>Response.json({workspaceId:matching?'fixture':'other',netlify:{connected:true,source:'session'}});const service=mcpWorkflowServices(transport,4322,'fixture');const live=await service.connections() as any;assert.equal(live.netlify.connected,true);matching=false;const foreign=await service.connections() as any;assert.equal(foreign.netlify.connected,null);assert.equal(foreign.editorReachable,false);const offline=await mcpWorkflowServices(async()=>{throw Error('offline');},4322,'fixture').connections() as any;assert.equal(offline.google.connected,null);
});

test('MCP photo tools reuse verified editor sessions without forwarding credentials or hiding provider errors',async()=>{
 const {mcpEditingServices}=await import('../server/mcp-workflows');let fallbackCalls=0,matching=true,error=false;const inputs:any[]=[];const page={items:[],total:0,page:1,hasMore:false};const fallback={resourceCatalog:async()=>({}),searchResources:async()=>{fallbackCalls++;return page;},importResource:async()=>{fallbackCalls++;return {src:'data:image/png;base64,AAAA',resource:{} as any};}};
 const transport:typeof fetch=async(url,init)=>{inputs.push({url,body:init?.body,headers:init?.headers});if(String(url).includes('/connections'))return Response.json({workspaceId:matching?'fixture':'foreign'});return Response.json(error?{error:'Fixture provider authorization expired'}:String(url).includes('/import')?{src:'https://images.unsplash.com/fixture',resource:{id:'unsplash:fixture'}}:page,{status:error?409:200});};const services=mcpEditingServices(fallback,transport,4322,'fixture');await services.searchResources(new URLSearchParams({kind:'photo',source:'unsplash'}));await services.importResource({id:'unsplash:fixture'});assert.equal(fallbackCalls,0);assert(!JSON.stringify(inputs).includes('Authorization'));error=true;await assert.rejects(()=>services.importResource({id:'unsplash:fixture'}),/authorization expired/);assert.equal(fallbackCalls,0);matching=false;await services.importResource({id:'pexels:123'});assert.equal(fallbackCalls,1);
});
