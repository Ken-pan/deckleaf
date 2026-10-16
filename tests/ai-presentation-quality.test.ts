import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyLoad,reviewPresentation} from '../src/core/presentation-review';
import {validateStoryDesign} from '../src/core/ai-story-quality';
import {StorySchema} from '../src/core/ai-story';
import {newAICreationState,saveAICreationBrief} from '../src/core/ai-creation-state';
import {createAIBase,creationPreview} from '../src/core/ai-story-builder';
import {runAI} from '../server/ai';
import {editingToolkit} from '../src/core/ai-tools';
import {blankSlide,element,newDeck} from '../src/core/model';
const brief={brief:'Explain the proposed pilot',audience:'Decision makers',goal:'Decide whether to test the proposal',delivery:'presentation' as const,slideCount:2,collection:'review' as const,materials:'A proposal only. No observed results.'};
const story=()=>StorySchema.parse({title:'Test before scaling',slides:[{layout:'cover',heading:'Test before scaling',body:'A focused pilot to resolve the main uncertainty.',notes:'Introduce the proposed pilot. No results exist yet. Next, explain what needs validation.'},{layout:'insights',heading:'Answer two questions first',points:[{heading:'Comprehension',body:'Can people explain the first step?'},{heading:'Recovery',body:'Can people correct a mistake?'}],notes:'Present these as proposed questions. Ask the audience which uncertainty matters most.'}]});

test('presentation budgets count unspaced multilingual copy without treating it as one word',()=>{
 assert.equal(copyLoad('Hello world'),2);assert.equal(copyLoad('清晰表达核心观点'),4);assert.equal(copyLoad('AI 帮助设计'),3);
 const dense=story();dense.slides[1].body='这是需要放在讲稿中的补充解释。'.repeat(20);
 assert.throws(()=>validateStoryDesign(dense,brief),/too much copy/);
 assert.doesNotThrow(()=>validateStoryDesign(dense,{...brief,delivery:'reading'}));
 const before=JSON.stringify(dense);try{validateStoryDesign(dense,brief);}catch{}assert.equal(JSON.stringify(dense),before);
});

test('creation catches missing notes, duplicate headings, count and projection-unfriendly tables before building',()=>{
 const value=story();delete value.slides[1].notes;value.slides[1].heading=value.slides[0].heading;
 assert.throws(()=>validateStoryDesign(value,{...brief,slideCount:3}),error=>/exactly 3/.test(String(error))&&/distinct takeaway/.test(String(error))&&/speaker notes/.test(String(error)));
 const table=story();table.slides[1]={layout:'table',heading:'Detailed evidence',notes:'Supporting detail',cells:Array.from({length:9},()=>['a','b'])};
 assert.throws(()=>validateStoryDesign(table,brief),/too dense for projection/);
 assert.doesNotThrow(()=>validateStoryDesign(story(),brief));
});

test('both model transports repair rejected presentation content using the original model and base',async()=>{
 for(const provider of ['openai','compatible'] as const){
  const base=await createAIBase('review'),original=JSON.stringify(base);let calls=0;
  const result=await runAI(base,brief.brief,{slideIds:[base.slides[0].id],elementIds:[]},{provider,baseUrl:'http://127.0.0.1:11434/v1',model:'user-selected-model',apiKey:'fixture'},{creation:brief,transport:async(_url,init)=>{
   calls++;const request=JSON.parse(String(init?.body));assert.equal(request.model,'user-selected-model');
   const value=story();if(calls===1)value.slides[1].points=Array.from({length:3},(_,i)=>({heading:`Point ${i+1}`,body:'extra '.repeat(30)}));
   if(calls===2)assert.match(JSON.stringify(request),/too much copy/);
   if(provider==='compatible')return Response.json({choices:[{message:{content:JSON.stringify({storyJson:JSON.stringify(value)})}}]});
   if(calls<=2)return Response.json({output:[{type:'function_call',call_id:`story-${calls}`,name:'prepare_story',arguments:JSON.stringify(value)}]});
   const outputs=request.input.filter((item:any)=>item.type==='function_call_output').map((item:any)=>JSON.parse(item.output));
   const prepared=outputs.find((output:any)=>output.recipeId);assert(prepared);
   return Response.json({output:[{type:'function_call',call_id:'submit',name:'propose_prepared_edits',arguments:JSON.stringify({baseRevision:0,summary:'Prepare a pilot story',recipeIds:[prepared.recipeId]})}]});
  }});
  assert(!('kind' in result));const preview=creationPreview(base,result,brief);assert.equal(preview.slides.length,2);assert(preview.slides.every(s=>s.notes.trim()));assert.equal(JSON.stringify(base),original);assert.equal(calls,2);
 }
});

test('presentation review is read-only, scope-bound and excludes hidden slides',async()=>{
 const visible=blankSlide(),hidden=blankSlide();visible.elements=[element('text',{name:'Slide heading',text:'Start here'}),element('text',{text:'detail '.repeat(100),fontSize:14})];hidden.hidden=true;
 const deck=newDeck('Review',[visible,hidden]),before=JSON.stringify(deck);
 const review=reviewPresentation(deck);assert.equal(review.pages.length,1);assert(review.issues.some(i=>i.code==='dense'));assert(review.issues.some(i=>i.code==='small-type'));assert(review.issues.some(i=>i.code==='notes'));
 const kit=editingToolkit(async()=>deck,undefined,{slideIds:[visible.id],elementIds:[]}),tool=kit.tools.find(t=>t.name==='review_presentation')!;
 const scoped=await tool.run({}) as ReturnType<typeof reviewPresentation>;assert.deepEqual(scoped.pages.map(p=>p.id),[visible.id]);
 await assert.rejects(()=>tool.run({slideIds:[hidden.id]}),/selected scope/);assert.equal(JSON.stringify(deck),before);
});

test('brief intent persists without draft documents and a changed brief cannot invalidate the accepted draft snapshot',async()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 saveAICreationBrief(brief,storage);const state=newAICreationState(storage);assert.equal(state.goal,brief.goal);assert.equal(state.delivery,'presentation');assert.equal(state.draftBrief,null);assert(!('proposal' in JSON.parse([...values.values()][0])));
 const base=await createAIBase('review');const {prepareStory}=await import('../src/core/ai-story-builder');state.base=base;state.proposal={baseRevision:0,summary:'Create',operations:await prepareStory(base,{...story(),replaceBlank:true})};state.draftBrief={...brief};state.slideCount=5;
 assert.equal(creationPreview(base,state.proposal,state.draftBrief).slides.length,2);
});

test('creation compiles compact chart evidence into themed native data without sample values',async()=>{
 const {authoredCreationStory,CreationStorySchema}=await import('../src/core/ai-story-input');
 const base=await createAIBase('report'),data={type:'line',labels:['January','February','March'],series:[{name:'Completed requests',values:[120,145,160]}],source:'Supplied log'};
 const raw={title:'Operations',slides:[{layout:'cover',heading:'The recorded trend'},{layout:'trend',heading:'Completed requests increased',chart:data}]};
 assert(CreationStorySchema.safeParse(raw).success);
 const authored=await authoredCreationStory(raw,base);assert.deepEqual(authored.slides[1].chart!.series,data.series);assert.equal(authored.slides[1].chart!.source,data.source);assert.equal(authored.slides[1].chart!.textColor,base.designSystem!.colors.ink);
 const {prepareStory}=await import('../src/core/ai-story-builder');const operations=await prepareStory(base,{...authored,replaceBlank:true});const preview=creationPreview(base,{baseRevision:0,summary:'Create report',operations},{...brief,collection:'report',delivery:'reading'});assert.deepEqual(preview.slides[1].elements.find(e=>e.chart)!.chart!.series,data.series);
 await assert.rejects(()=>authoredCreationStory({...raw,slides:[raw.slides[0],{...raw.slides[1],chart:{...data,source:''}}]},base));
});

test('story repairs identify the overflowing page and respect a deliberately uniform layout',async()=>{
 const base=await createAIBase('review'),{prepareStory}=await import('../src/core/ai-story-builder');const value=story();value.slides[1].body='Supporting background requires more explanation. '.repeat(10);
 await assert.rejects(()=>prepareStory(base,{...value,replaceBlank:true}),/Slide 2 \(insights\).*body.*pages instead of one/);
 const repeated=StorySchema.parse({title:'Three questions',slides:[1,2,3].map(i=>({layout:'content',heading:`Question ${i}`,body:'One concise point.',notes:'Explain the question.'}))});
 assert.doesNotThrow(()=>validateStoryDesign(repeated,{...brief,slideCount:3}));
 assert.doesNotThrow(()=>validateStoryDesign(repeated,{...brief,slideCount:3,brief:'Use the same layout for all three questions.'}));
});

test('sources on layouts without a visible source slot survive in speaker notes',async()=>{
 const {authoredCreationStory}=await import('../src/core/ai-story-input'),base=await createAIBase('report');
 const value=await authoredCreationStory({title:'Source-aware report',replaceBlank:true,slides:[{layout:'cover',heading:'A recorded trend',body:'Raw counts from the supplied log.',source:'Internal sample log',notes:'Introduce the observation.'},{layout:'statement',heading:'Causation is not established',source:'Internal sample log',notes:'Explain the evidence limit.'}]},base);
 assert.equal(value.slides[0].source,undefined);assert.match(value.slides[0].notes!,/Introduce the observation\.[\s\S]*Source: Internal sample log/);
 const {prepareStory}=await import('../src/core/ai-story-builder');assert.equal((await prepareStory(base,value)).filter(o=>o.op==='add_slide').length,2);
});

test('chart commentary cannot claim both series increased when the supplied values move in opposite directions',async()=>{
 const {authoredCreationStory}=await import('../src/core/ai-story-input'),base=await createAIBase('report');
 const value=await authoredCreationStory({title:'Operations',slides:[{layout:'cover',heading:'Recorded counts'},{layout:'trend',heading:'Trend analysis',notes:'The trend indicates a steady increase in both completed and reopened requests.',chart:{type:'line',labels:['January','March'],series:[{name:'Completed',values:[120,160]},{name:'Reopened',values:[18,14]}],source:'Supplied log'}}]},base);
 assert.throws(()=>validateStoryDesign(value,{...brief,delivery:'reading'}),/supplied data disagrees.*Completed: 120 to 160; Reopened: 18 to 14/);
 value.slides[1].notes='Completed requests increased. Reopened requests decreased. These counts do not establish a cause.';
 assert.doesNotThrow(()=>validateStoryDesign(value,{...brief,delivery:'reading'}));
});
