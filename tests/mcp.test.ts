import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {blankSlide,element,newDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';

test('real stdio MCP exposes discovery, scoped reads, local resources, atomic proposals and retry deduplication',async()=>{
 const data=await mkdtemp(join(tmpdir(),'deck-mcp-')),slide=blankSlide();slide.elements=[element('text',{text:'Original'}),element('rect',{locked:true}),element('image',{id:'artwork',src:'data:image/png;base64,AAAA',x:20,y:30,w:64,h:64,crop:{left:.1,right:.1,top:.1,bottom:.1}})];const deck=newDeck('MCP fixture',[slide]);
 await mkdir(join(data,'decks'));await writeFile(join(data,'decks',`${deck.id}.json`),JSON.stringify(deck));
 const client=new Client({name:'deck-test',version:'1.0'}),transport=new StdioClientTransport({command:process.execPath,args:[resolve('node_modules/tsx/dist/cli.mjs'),resolve('server/mcp.ts')],cwd:data,env:{...process.env,DECK_STUDIO_DATA:data} as Record<string,string>});
 try{
  await client.connect(transport);const listed=await client.listTools();assert(listed.tools.length>=16);for(const tool of listed.tools){assert(tool.annotations);assert.equal(tool.annotations.destructiveHint,false);}
  const call=async(name:string,args:any={})=>await client.callTool({name,arguments:args}) as any;
  const context=await call('read_deck',{id:deck.id,limit:1});assert(context.structuredContent);assert.equal(context.structuredContent.revision,0);assert.equal(context.structuredContent.slides[0].elements[0].id,slide.elements[0].id);
  const schema=await call('get_edit_schema',{operation:'update_element'});assert(JSON.stringify(schema.structuredContent).includes('crop'));
  const invalid=await call('read_deck',{id:'missing'});assert.equal(invalid.isError,true);assert(JSON.parse(invalid.content[0].text).recovery);
  const resource=await call('prepare_resource',{deckId:deck.id,id:'iconify:lucide:circle',color:'#112233'});assert.equal(resource.isError,undefined,JSON.stringify(resource));assert(!JSON.stringify(resource).includes('base64'));assert(resource.structuredContent.src.startsWith('deck-studio-media:'));assert.equal(resource.structuredContent.resource.license.includes('ISC'),true);
  const proposal={baseRevision:0,summary:'Edit the fixture title',operations:[{op:'update_element',slideId:slide.id,elementId:slide.elements[0].id,patch:{text:'Changed'}}]};
  const a=await call('propose_edit',{deckId:deck.id,proposal}),b=await call('propose_edit',{deckId:deck.id,proposal});assert.equal(a.isError,undefined);assert.equal(a.structuredContent.id,b.structuredContent.id);
  const pending=await call('list_proposals',{deckId:deck.id});assert.equal(pending.structuredContent.items.length,1);
  const locked=await call('propose_edit',{deckId:deck.id,proposal:{...proposal,operations:[{op:'update_element',slideId:slide.id,elementId:slide.elements[1].id,patch:{locked:false}}]}});assert.equal(locked.isError,true);
  const assets=await call('read_assets',{deckId:deck.id,slideIds:null,elementIds:null,kind:null,query:null,offset:null,limit:1});assert.equal(assets.structuredContent.items[0].elementId,'artwork');assert(!JSON.stringify(assets).includes('base64'));
  const prepared=await call('prepare_asset_replacements',{deckId:deck.id,baseRevision:0,replacements:[{slideId:slide.id,elementId:'artwork',resourceId:'iconify:lucide:rocket',color:'#112233',graphic:null,fit:null,sourceSlideId:null,sourceElementId:null,characterRecipeJson:null}]});assert.equal(prepared.isError,undefined,JSON.stringify(prepared));assert.equal(prepared.structuredContent.replacements[0].fit,'contain');
  const assetProposal=await call('propose_prepared_edits',{deckId:deck.id,baseRevision:0,summary:'Replace artwork',recipeIds:[prepared.structuredContent.recipeId],adjustmentsJson:null});assert.equal(assetProposal.structuredContent.status,'pending');const storedAsset=JSON.parse(await readFile(join(data,'proposals',assetProposal.structuredContent.id+'.json'),'utf8'));const applied=applyOperations(deck,storedAsset.proposal.operations,0,'ai');assert.equal(applied.slides[0].elements[2].resource!.id,'iconify:lucide:rocket');assert.equal(applied.slides[0].elements[2].crop,undefined);assert.equal(applied.slides[0].elements[2].x,20);
  const stored=JSON.parse(await readFile(join(data,'decks',`${deck.id}.json`),'utf8'));assert.equal(stored.slides[0].elements[0].text,'Original');assert.equal(stored.revision,0);
  const guide=await client.readResource({uri:'deck-studio://guide'});assert((guide.contents[0] as any).text.includes('get_edit_schema'));
  const prompts=await client.listPrompts();assert(prompts.prompts.some(p=>p.name==='edit_document'));
 }finally{await client.close();await rm(data,{recursive:true,force:true});}
});

test('AI-facing MCP supports typed/null-friendly calls, bounded search, recovery metadata and revision-bound recipes',async()=>{
 const data=await mkdtemp(join(tmpdir(),'deck-mcp-agent-')),slide=blankSlide();slide.elements=[element('text',{id:'title',text:'标题 Evidence',runs:[{text:'标题 Evidence',bold:true}]}),element('rect',{id:'locked',locked:true})];const deck=newDeck('Agent SDK fixture',[slide]);await mkdir(join(data,'decks'));await writeFile(join(data,'decks',deck.id+'.json'),JSON.stringify(deck));
 const client=new Client({name:'agent-ergonomics-test',version:'1.0'}),transport=new StdioClientTransport({command:process.execPath,args:[resolve('node_modules/tsx/dist/cli.mjs'),resolve('server/mcp.ts')],cwd:data,env:{...process.env,DECK_STUDIO_DATA:data} as Record<string,string>});
 try{await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,38);for(const name of ['search_document','propose_updates','prepare_elements','get_editor_context','list_workflows','read_template','prepare_template_update','read_assets','prepare_asset_replacements'])assert(tools.tools.some(tool=>tool.name===name));assert(tools.tools.find(t=>t.name==='search_document')!.outputSchema);
  const call=async(name:string,args:any={})=>await client.callTool({name,arguments:args}) as any;
  const list=await call('list_decks',{query:'SDK',offset:null,limit:1});assert.equal(list.structuredContent.total,1);const ctx=await call('get_editor_context',{});assert.equal(ctx.structuredContent.state,'editor_unavailable');assert.equal(ctx.structuredContent.deckId,undefined);
  const found=await call('search_document',{deckId:deck.id,query:'Evidence',kind:null,offset:null,limit:1});assert.equal(found.structuredContent.items[0].elementId,'title');const changed=await call('propose_updates',{deckId:deck.id,baseRevision:0,summary:'Clarify',updates:[{slideId:slide.id,elementId:'title',text:'标题 Clear evidence',box:null,style:{fontSize:32,fill:null}}]});assert.equal(changed.structuredContent.status,'pending');
  const blocked=await call('propose_updates',{deckId:deck.id,baseRevision:0,summary:'Keep evidence',updates:[{slideId:slide.id,elementId:'locked',text:null,style:{fill:'#000000'}}]});assert.equal(blocked.isError,true);assert.equal(blocked._meta.deckStudioError.code,'LOCKED_CONTENT');assert.equal(JSON.parse(blocked.content[0].text).next.action,'choose_editable_objects');
  const batch=await call('prepare_elements',{deckId:deck.id,slideId:slide.id,elements:[{type:'text',name:null,text:'New block',box:{x:0,y:0,w:400,h:100},style:null},{type:'rect',text:null,box:{x:0,y:130,w:400,h:8},style:{fill:'#112233'}}]});assert.equal(batch.structuredContent.objects.length,2);assert.equal(batch.structuredContent.baseRevision,0);
  const action=await call('request_export',{deckId:deck.id,format:'html',version:null});const history=await call('list_workflows',{deckId:deck.id,status:'all',offset:null,limit:1});assert.equal(history.structuredContent.items[0].id,action.structuredContent.request.id);assert.equal(history.structuredContent.items[0].next.resend,false);
  const original=JSON.parse(await readFile(join(data,'decks',deck.id+'.json'),'utf8'));assert.equal(original.slides[0].elements[0].text,'标题 Evidence');await writeFile(join(data,'decks',deck.id+'.json'),JSON.stringify({...original,revision:1}));const stale=await call('propose_prepared_edits',{deckId:deck.id,baseRevision:1,summary:'Do not rebase',recipeIds:[batch.structuredContent.recipeId]});assert.equal(stale.isError,true);assert.equal(stale._meta.deckStudioError.code,'STALE_REVISION');
 }finally{await client.close();await rm(data,{recursive:true,force:true});}
});
