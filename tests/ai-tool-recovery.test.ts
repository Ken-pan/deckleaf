import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {proposeAI} from '../server/ai';
import {editingToolkit,strictToolSchema} from '../src/core/ai-tools';
import {mcpInputSchema,omitNull} from '../src/core/tool-recovery';
import {CreationStorySchema} from '../src/core/ai-story-input';
import {z} from 'zod';

for(const provider of ['openai','compatible'] as const)test(`${provider}: partial recipe lists and competing proposals recover without losing work`,async()=>{
 const slide=blankSlide();slide.elements=[element('text',{id:'old',text:'Original'})];const deck=newDeck('Recovery',[slide]);let round=0,sawMissing=false,sawCompeting=false;
 const transport:typeof fetch=async(_url,init)=>{
  const body=JSON.parse(String(init!.body)),wire=provider==='openai'?body.input:body.messages;
  const results=wire.filter((v:any)=>v.type==='function_call_output'||v.role==='tool').map((v:any)=>JSON.parse(v.output??v.content));
  const recipes=results.map((v:any)=>v.recipeId).filter(Boolean);sawMissing ||= results.some((v:any)=>v.error?.includes('Prepared changes would be omitted'));sawCompeting ||= results.some((v:any)=>v.error?.includes('Multiple proposals'));
  const call=(name:string,args:unknown)=>({type:'function_call',call_id:`${round}-${name}`,name,arguments:JSON.stringify(args)});
  let calls:any[]=[];switch(++round){
   case 1:calls=['First','Second'].map((text,i)=>({...call('prepare_elements',{slideId:slide.id,elements:[{type:'text',text,box:{x:80,y:200+i*100,w:500,h:80}}]}),call_id:`prepare-${i}`}));break;
   case 2:calls=[call('propose_prepared_edits',{baseRevision:0,summary:'Incomplete',recipeIds:[recipes[0]]})];break;
   case 3:assert.notEqual(typeof body.tool_choice==='object'?body.tool_choice?.name:body.tool_choice,'propose_prepared_edits');calls=[call('discard_prepared_edits',{recipeIds:[recipes[1]]})];break;
   case 4:calls=[call('propose_prepared_edits',{baseRevision:0,summary:'One',recipeIds:[recipes[0]]}),call('propose_updates',{baseRevision:0,summary:'Two',recipeIds:[recipes[0]],updates:[{slideId:slide.id,elementId:'old',text:'Revised'}]})];break;
   default:calls=[call('propose_prepared_edits',{baseRevision:0,summary:'Combined result',recipeIds:[recipes[0]],updates:[{slideId:slide.id,elementId:'old',text:'Revised'}]})];
  }
  return provider==='openai'?Response.json({output:calls}):Response.json({choices:[{message:{role:'assistant',tool_calls:calls.map(c=>({id:c.call_id,type:'function',function:{name:c.name,arguments:c.arguments}}))}}]});
 };
 const proposal=await proposeAI(deck,'Add a takeaway and revise the original',{slideIds:[slide.id],elementIds:[]},{provider,baseUrl:'http://127.0.0.1:1',model:'unchanged-model',apiKey:'test-key'},{transport});
 const after=applyOperations(deck,proposal.operations,0,'ai');assert(sawMissing&&sawCompeting);assert.equal(round,5);assert.deepEqual(after.slides[0].elements.map(e=>e.text),['Revised','First']);assert.equal(deck.slides[0].elements[0].text,'Original');
});

test('strict tool schemas have required nullable optionals, including union branches; MCP preserves canonical validation',()=>{
 const deck=newDeck('Fixture',[blankSlide()]),tools=editingToolkit(async()=>deck).tools;
 const inspect=(node:any,path:string)=>{if(!node||typeof node!=='object')return;if(node.type==='object'&&node.properties){assert.equal(node.additionalProperties,false,path);assert.deepEqual([...node.required].sort(),Object.keys(node.properties).sort(),path);}for(const [key,value]of Object.entries(node))if(Array.isArray(value))value.forEach((v,i)=>inspect(v,`${path}.${key}.${i}`));else if(value&&typeof value==='object')inspect(value,`${path}.${key}`);};
 for(const tool of tools)inspect(strictToolSchema(tool.schema),tool.name);inspect(strictToolSchema(CreationStorySchema),'creation');
 const input=z.object({values:z.array(z.union([z.object({kind:z.literal('a'),text:z.string().optional()}),z.object({kind:z.literal('b'),tuple:z.tuple([z.string(),z.string().optional()])})]))});
 const parsed=mcpInputSchema(input).parse({values:[{kind:'a',text:null}]});assert.deepEqual(input.parse(omitNull(parsed)),{values:[{kind:'a'}]});
 assert.throws(()=>mcpInputSchema(input).parse({values:[{kind:'a',text:42}]}));
});

test('equivalent preparation retries reuse a recipe; typed finalizer includes all edits and notes atomically',async()=>{
 const slide=blankSlide();slide.elements=[element('text',{id:'title',text:'Original'})];const deck=newDeck('Retry',[slide]),before=structuredClone(deck),kit=editingToolkit(async()=>deck);
 const call=async(name:string,args:any)=>{const tool=kit.tools.find(t=>t.name===name)!;return await tool.run(tool.schema.parse(args)) as any;};
 const args={slideId:slide.id,elements:[{type:'rect',box:{x:80,y:300,w:400,h:8}}]};
 const first=await call('prepare_elements',args),retry=await call('prepare_elements',args);assert.equal(first.recipeId,retry.recipeId);
 const proposal=await call('propose_prepared_edits',{baseRevision:0,summary:'Complete the request',includeAllPrepared:true,updates:[{slideId:slide.id,elementId:'title',text:'Ready'}],slideUpdates:[{slideId:slide.id,notes:'Introduce the pilot.'}]});
 const after=applyOperations(deck,proposal.operations,0,'ai');assert.equal(after.slides[0].elements.length,2);assert.equal(after.slides[0].notes,'Introduce the pilot.');assert.equal(after.slides[0].elements[0].text,'Ready');assert.deepEqual(deck,before);
 await call('discard_prepared_edits',{recipeIds:[first.recipeId]});const replacement=await call('prepare_elements',args);assert.notEqual(replacement.recipeId,first.recipeId);
});

test('a failed preparation cannot be hidden by a successful companion submission',async()=>{
 const slide=blankSlide();slide.elements=[element('text',{id:'title',text:'Original'})];const deck=newDeck('Companion',[slide]);let calls=0,feedback=false;
 const transport:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init!.body));const call=(name:string,args:any,id:string)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});if(++calls===1)return Response.json({output:[call('prepare_elements',{slideId:'missing',elements:[{type:'text',text:'Required new point',box:{x:80,y:200,w:400,h:100}}]},'failed'),call('propose_updates',{baseRevision:0,summary:'Incomplete',updates:[{slideId:slide.id,elementId:'title',text:'New'}]},'partial')]});feedback=JSON.stringify(body.input).includes('companion tool failed');if(calls===2)return Response.json({output:[call('prepare_elements',{slideId:slide.id,elements:[{type:'text',text:'Required new point',box:{x:80,y:200,w:400,h:100}}]},'fixed')]});return Response.json({output:[call('propose_prepared_edits',{baseRevision:0,summary:'Complete',includeAllPrepared:true,updates:[{slideId:slide.id,elementId:'title',text:'New'}]},'complete')]});};
 const proposal=await proposeAI(deck,'Add a point and edit title',{slideIds:[slide.id],elementIds:[]},{provider:'openai',baseUrl:'',model:'test',apiKey:'test'},{transport});assert(feedback);const after=applyOperations(deck,proposal.operations,0,'ai');assert.equal(after.slides[0].elements.length,2);assert.equal(calls,3);
});
