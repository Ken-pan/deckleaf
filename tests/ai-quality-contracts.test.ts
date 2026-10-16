import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAIBase,prepareStory} from '../src/core/ai-story-builder';
import {applyOperations} from '../src/core/operations';
import {editingToolkit} from '../src/core/ai-tools';
import {reviewSlideFit} from '../src/core/slide-fit';
import {reviewCreationPages} from '../server/ai-creation-review';
import {templateCatalog} from '../src/core/ai-templates';
import {creationSlideSchema} from '../src/core/ai-story-input';
import {pageBatchModelSchema} from '../server/ai-page-schema';
import {resolvePageRequest} from '../src/core/ai-page-request';
import {PageEditsSchema} from '../src/core/ai-page-edits';
import {strictToolSchema} from '../src/core/ai-tools';
import {StorySchema,type Story,type CreationBrief} from '../src/core/ai-story';

test('prepared layout inspection composes the actual recipe without applying or consuming it',async()=>{
 const base=await createAIBase('review');const deck=applyOperations(base,await prepareStory(base,{title:'Review',replaceBlank:true,slides:[{layout:'statement',heading:'One point',body:'A concise explanation.'},{layout:'close',heading:'Next decision'}]}),base.revision,'ai');
 const kit=editingToolkit(async()=>deck,undefined,{slideIds:deck.slides.map(s=>s.id),elementIds:[]});
 const invoke=async(name:string,args:any)=>{const tool=kit.tools.find(t=>t.name===name)!;return await tool.run(tool.schema.parse(args)) as any;};
 const before=JSON.stringify(deck),heading=deck.slides[0].elements.find(e=>e.name==='Slide heading')!;
 const prepared=await invoke('prepare_template_update',{slideId:deck.slides[0].id,content:{heading:'Revised point'}});
 const result=await invoke('review_prepared_edit',{recipeIds:[prepared.recipeId]});
 assert.equal(JSON.stringify(deck),before);assert.equal(result.documentUnchanged,true);assert.equal(result.pages.length,1);assert.equal(result.pages[0].content.heading,'Revised point');assert.equal(result.layout.measurement,'estimated');assert(kit.pendingRecipeIds().includes(prepared.recipeId));
 const proposal=await invoke('propose_prepared_edits',{baseRevision:deck.revision,summary:'Revise',includeAllPrepared:true});assert(proposal.operations.length);
 await assert.rejects(()=>invoke('review_prepared_edit',{recipeIds:[prepared.recipeId,prepared.recipeId]}),/each prepared edit once/);
 const overlap=structuredClone(deck);const body=overlap.slides[0].elements.find(e=>e.id===overlap.slides[0].template!.slots!.find(s=>s.key==='body')!.elementId)!;body.x=heading.x;body.y=heading.y;
 assert(reviewSlideFit(overlap).issues.some(i=>i.code==='overlap'&&i.elementIds.includes(body.id)&&i.fields.includes('heading')));
 deck.revision++;await assert.rejects(()=>invoke('review_prepared_edit',{recipeIds:[prepared.recipeId]}),/document changed/);
});

test('fit checks use provided paragraph measurements for fixed frames and exclude hidden content',async()=>{
 const base=await createAIBase('review');const deck=applyOperations(base,await prepareStory(base,{title:'Fit',replaceBlank:true,slides:[{layout:'statement',heading:'Headline',body:'Paragraph'},{layout:'close',heading:'Next'}]}),base.revision,'ai');
 const heading=deck.slides[0].elements.find(e=>e.name==='Slide heading')!;heading.textSizing='fixed';heading.h=20;
 const report=reviewSlideFit(deck,[deck.slides[0].id],e=>({w:e.w,h:e.id===heading.id?100:e.h}));assert.equal(report.measurement,'provided');assert(report.issues.some(i=>i.code==='clipped'&&i.elementIds.includes(heading.id)));
 heading.hidden=true;assert(!reviewSlideFit(deck,undefined,e=>({w:e.w,h:100})).issues.some(i=>i.elementIds.includes(heading.id)));
});

test('AI template requirements do not invent authors, dates, costs or owners',async()=>{
 const catalog=await templateCatalog();for(const id of ['cover','decision','action-plan']){const layout=catalog.layouts.find(l=>l.id===id)!;assert(!layout.contract.required.some(field=>['author','date','dates','cost','owner','owners'].includes(field)));}
 const schema=creationSlideSchema('insights',true);assert(schema.safeParse({layout:'content',heading:'Findings',points:[{heading:'A',body:'Supported detail.'}]}).success);assert(!schema.safeParse({layout:'trend',heading:'Findings',points:[]}).success);
});

test('data correction tools expose dependent caption and takeaway fields on the requested pages',async()=>{
 const base=await createAIBase('review');const deck=applyOperations(base,await prepareStory(base,{title:'Report',replaceBlank:true,slides:[{layout:'table',heading:'The ratio fell to 8.8%',body:'March had 160 completions.',cells:[['Month','Completed','Rate'],['March','160','8.8%']]},{layout:'close',heading:'Keep this page'}]}),base.revision,'ai');
 const request=resolvePageRequest(deck,'On slide 1, correct the table: March completed should be 154 and the ratio 9.1%. Keep the other slide unchanged.');
 const wire=pageBatchModelSchema(deck,request,strictToolSchema(PageEditsSchema));const fields=wire.properties.pages.items.properties;
 assert(fields.cells);assert(fields.heading);assert(fields.body);assert.deepEqual(fields.number.enum,[1]);assert(!fields.updates);
});

const spec:CreationBrief={brief:'Explain the evidence and propose further validation.',materials:'32 of 40 completed the new flow. The groups were not randomized. No causal effect has been established.',audience:'Product team',goal:'Choose the next validation',collection:'review',delivery:'presentation',templateMode:'auto',slideCount:2};
const story:Story={title:'Evidence',slides:[{layout:'statement',heading:'An encouraging signal',notes:'Completion was 80%, but this does not establish a causal effect. A randomized comparison could test that hypothesis.'},{layout:'close',heading:'Continue validation'}]};
const answer=(value:unknown)=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const options={settings:{provider:'openai' as const,model:'selected-model',baseUrl:''},base:'https://example.invalid',signal:AbortSignal.timeout(10000)};
test('grounded review preserves natural narration and uses one assessment per page with caching',async()=>{
 const value=structuredClone(story),reviewCache=new Map();let calls=0;const transport:typeof fetch=async(_url,init)=>{calls++;const req=JSON.parse(String(init?.body));assert.equal(req.model,'selected-model');assert.equal(req.text.format.name,'deck_creation_page_review');assert.match(JSON.parse(req.input[0].content).authored.notes??'',/causal|^$/);return answer({issues:[]});};
 assert.deepEqual(await reviewCreationPages(value,spec,[],{...options,reviewCache,transport}),[]);assert.deepEqual(value,story);await reviewCreationPages(value,spec,[],{...options,reviewCache,transport});assert.equal(calls,2);
});
test('only definite findings with real authored and source quotes trigger repair',async()=>{
 for(const [verdict,quote,expected] of [['confirmed','Completion was 80%',1],['uncertain','Completion was 80%',0],['confirmed','Invented text',0]] as const){
  const findings=await reviewCreationPages(story,spec,[],{...options,transport:async(_url,init)=>{const data=JSON.parse(JSON.parse(String(init?.body)).input[0].content);return answer({issues:data.pageNumber===1?[{verdict,kind:'contradiction',authoredQuote:quote,authoredMeaning:'Completion percentage.',sourceQuote:'32 of 40 completed the new flow.',sourceMeaning:'The observed count.',problem:'A fixture mismatch for contract testing.'}]:[]});}});assert.equal(findings.length,expected);
 }
});

test('semantic point input allows a complete explanation beyond the old 200-character wire limit',()=>{
 const explanation='No sync conflict policy has been agreed. Proposed test: change the same record’s storage location offline and through the connected app, then reconnect. Evaluate how to detect the conflict and preserve both changes for review.';
 assert(explanation.length>200);assert(creationSlideSchema('insights').safeParse({layout:'insights',heading:'Test competing edits',points:[{heading:'Conflicting changes',body:explanation}]}).success);
 assert(StorySchema.safeParse({title:'Validation',slides:[{layout:'content',heading:'Test',points:[{heading:'Conflicting changes',body:explanation}]},{layout:'close',heading:'Review findings'}]}).success);
});
