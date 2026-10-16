import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {blankSlide,element} from '../src/core/model';
import {createAIBase} from '../src/core/ai-story-builder';
import {authoredTemplatePages} from '../src/core/ai-templates';
import {applyOperations} from '../src/core/operations';
import {EDIT_OPERATIONS} from '../src/core/ai-editing';
import {authoredFixture} from './helpers/ai-template-fixture';

test('every registered MCP tool succeeds through real SDK dispatch; writes remain staged and source is byte-identical',async()=>{
 const data=await mkdtemp(join(tmpdir(),'deck-all-tools-')),base=await createAIBase('review');
 const slide=(await authoredTemplatePages(base,'insights','review',authoredFixture('insights')))[0],canvas=blankSlide();
 canvas.elements=[element('text',{id:'a',text:'Find this evidence',x:80,y:80,w:400,h:70}),element('rect',{id:'b',x:100,y:200,w:100,h:80}),element('rect',{id:'c',x:400,y:340,w:100,h:80}),element('image',{id:'art',src:'data:image/svg+xml;base64,PHN2Zy8+',x:700,y:100,w:64,h:64})];
 const deck={...base,title:'All-tool fixture',slides:[slide,canvas]},before=JSON.stringify(deck);
 await mkdir(join(data,'decks'));await writeFile(join(data,'decks',deck.id+'.json'),before);
 const client=new Client({name:'full-tool-contract',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[resolve('node_modules/tsx/dist/cli.mjs'),resolve('server/mcp.ts')],cwd:data,env:{...process.env,DECK_STUDIO_DATA:data} as Record<string,string>});
 const covered=new Set<string>();
 try{
  await client.connect(transport);const listing=await client.listTools();
  const call=async(name:string,args:any={})=>{const result:any=await client.callTool({name,arguments:{...(listing.tools.find(t=>t.name===name)?.inputSchema.properties?.deckId?{deckId:deck.id}:{}),...args}});assert(!result.isError,`${name}: ${JSON.stringify(result)}`);covered.add(name);assert(!JSON.stringify(result).includes('PHN2Zy8+'),`${name} leaked media`);return result.structuredContent;};
  const submit=async(recipe:any,summary:string)=>{const receipt=await call('propose_prepared_edits',{baseRevision:0,summary,recipeIds:[recipe.recipeId]});assert.equal(receipt.status,'pending');const stored=JSON.parse(await readFile(join(data,'proposals',receipt.id+'.json'),'utf8'));return applyOperations(deck,stored.proposal.operations,0,'ai');};
  await call('list_decks',{query:'All-tool',limit:1});await call('get_editor_context');await call('get_capabilities',{detail:'full'});
  await call('read_deck',{detail:'content',slideIds:[canvas.id],limit:1});await call('search_document',{query:'evidence'});await call('review_presentation');
  for(const operation of EDIT_OPERATIONS){const schema=await call('get_edit_schema',{operation});assert(schema.properties);}
  await call('search_fonts',{query:'Inter'});await call('get_resource_catalog');
  const resources=await call('search_resources',{kind:'icon',query:'rocket',set:'lucide',style:'outline'});assert(resources.items.length);
  const resource=await call('prepare_resource',{id:resources.items[0].id});assert(resource.src.startsWith('deck-studio-media:'));
  const single=await call('prepare_element',{slideId:canvas.id,type:'image',propertiesJson:JSON.stringify({src:resource.src,resource:resource.resource,x:700,y:300,w:64,h:64})});assert.equal((await submit(single,'Add licensed artwork')).slides[1].elements.length,5);
  const batch=await call('prepare_elements',{slideId:canvas.id,elements:[{type:'text',text:'Second takeaway',box:{x:80,y:480,w:500,h:80},style:{fontSize:32}}]});await call('read_prepared_edit',{recipeId:batch.recipeId});await call('review_prepared_edit',{recipeIds:[batch.recipeId]});await submit(batch,'Add an authored takeaway');
  await call('discard_prepared_edits',{recipeIds:[batch.recipeId]});
  await call('read_assets',{slideIds:[canvas.id]});const asset=await call('prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:canvas.id,elementId:'art',resourceId:resources.items[0].id}]});assert.equal((await submit(asset,'Replace artwork')).slides[1].elements.find(e=>e.id==='art')!.resource!.id,resources.items[0].id);
  for(const args of [
   {action:'align',direction:'left',reference:'page'},{action:'distribute',axis:'y'},{action:'move',dx:24,dy:12},{action:'group'},{action:'auto-layout'},
  ]){const recipe=await call('prepare_arrangement',{slideId:canvas.id,elementIds:['a','b','c'],...args});await submit(recipe,`Arrange: ${args.action}`);}
  await call('list_templates',{collection:'review',query:'hierarchy'});const read=await call('read_template',{slideId:slide.id});assert.equal(read.number,1);
  const update=await call('prepare_template_update',{slideId:slide.id,content:{heading:'Revised evidence'},density:'reading'});assert((await submit(update,'Reflow with content')).slides[0].elements.some(e=>e.text==='Revised evidence'));
  const template=await call('prepare_template',{collection:'minimal',layout:'architecture',content:authoredFixture('architecture'),notes:'Explain actual responsibilities.'});assert.equal((await submit(template,'Add architecture')).slides.length,3);
  const story=await call('prepare_story',{title:'Authored story',slides:[{layout:'statement',heading:'A concrete premise',body:'Provided context'},{layout:'close',heading:'Agree the next action',body:'Review the evidence',notes:'Name a decision owner.'}]});assert.equal((await submit(story,'Add a complete story')).slides.length,4);
  const duplicate=await call('prepare_duplicate_slide',{slideId:slide.id});assert.equal((await submit(duplicate,'Duplicate for comparison')).slides.length,3);
  await call('propose_updates',{baseRevision:0,summary:'Change copy',updates:[{slideId:canvas.id,elementId:'a',text:'A clearer takeaway'}]});
  await call('propose_page_edits',{baseRevision:0,summary:'Edit the current first page',pages:[{number:1,heading:'A page-level takeaway'}]});
  await call('propose_edit',{proposal:{baseRevision:0,summary:'Prepare speaker notes',operations:[{op:'update_slide',slideId:canvas.id,patch:{notes:'Provide context, then advance.'}}]}});
  const pending=await call('list_proposals');assert(pending.items.length>10);await call('list_history');
  await call('get_workflow_capabilities');await call('get_connection_status');
  for(const [name,args] of [
   ['request_import',{source:'file'}],['request_export',{format:'html'}],['request_presentation',{command:'go_to',slideId:slide.id}],['request_account_connection',{provider:'google'}],['request_publish',{target:'web'}],['request_workspace_action',{command:'notes'}],
  ] as const){const outcome=await call(name,args);assert.equal(outcome.request.status,'pending');const status=await call('get_workflow_status',{requestId:outcome.request.id});assert.equal(status.status,'pending');assert.equal(status.next.resend,false);}
  const history=await call('list_workflows',{status:'all'});assert.equal(history.total,6);
  const answer=await call('respond_to_user',{message:'The action is queued in the editor.',requestId:history.items[0].id});assert.equal(answer.receipt.status,'pending');
  assert.deepEqual([...covered].sort(),listing.tools.map(t=>t.name).sort());
  assert.equal(await readFile(join(data,'decks',deck.id+'.json'),'utf8'),before);
 }finally{await client.close();await rm(data,{recursive:true,force:true});}
});
