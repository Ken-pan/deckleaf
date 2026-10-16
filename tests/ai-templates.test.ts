import {test} from 'node:test';import assert from 'node:assert/strict';
import {authoredTemplatePages,readTemplate,prepareTemplateUpdate,templateCatalog} from '../src/core/ai-templates';
import {createAIBase,prepareStory,creationPreview} from '../src/core/ai-story-builder';
import {element,newDeck} from '../src/core/model';import {applyOperations} from '../src/core/operations';
import {editingToolkit} from '../src/core/ai-tools';import {validateAIProposal} from '../src/core/ai-editing';
import {sampleChart} from '../src/core/charts';import {runAI} from '../server/ai';
import {portableTemplateOwnership} from '../src/core/template-ownership';
import {StorySchema,validateCreationEvidence} from '../src/core/ai-story';import {strictToolSchema} from '../src/core/ai-tools';import {TemplateUpdateSchema} from '../src/core/ai-templates';
const items:[string,string][]=[['Finding A','Authored explanation A'],['Finding B','Authored explanation B'],['Finding C','Authored explanation C']];
const invoke=async(kit:ReturnType<typeof editingToolkit>,name:string,input:any)=>{const t=kit.tools.find(t=>t.name===name)!;return await t.run(t.schema.parse(input)) as any;};

test('AI selects actual native tasks and retains authored evidence across template families',async()=>{
 const catalog=await templateCatalog();assert(catalog.layouts.some(l=>l.id==='insights'&&l.authoredContent));assert((await templateCatalog('review','timeline')).layouts.every(l=>l.id==='timeline'));
 const chart={...sampleChart(),type:'line' as const,labels:['Jan','Feb'],series:[{name:'Observed',values:[3,5]}],source:'Supplied internal record',title:'',subtitle:''};
 for(const collection of ['portfolio','review','proposal','pitch','report','minimal'] as const){const deck=await createAIBase(collection);
  for(const [layout,content] of Object.entries({insights:{heading:'Parallel findings',items},timeline:{heading:'Dated plan',items,dates:['Week 1','Week 2','Week 3']},'action-plan':{heading:'Actual work',cells:[['Action','Owner','Due','Done'],['Interview','Ken','Next week','Notes reviewed']]},decision:{heading:'Choose the scope',body:'Approve the research sprint',items},trend:{heading:'Observed change',chart}})){
   const pages=await authoredTemplatePages(deck,layout,collection,content,1,'Authored notes');assert.equal(pages.length,1);assert.equal(pages[0].template?.prototype,layout);assert.equal(pages[0].template?.collection,collection);assert.equal(pages[0].notes,'Authored notes');assert(readTemplate(pages[0]).canReflow);assert(!JSON.stringify(pages[0]).includes('Approve the focused pilot'));assert(!pages[0].elements.some(e=>e.text.includes('Illustrative Atlas')));
  }
 }
 const base=await createAIBase('review'),ops=await prepareStory(base,{title:'Parallel',replaceBlank:true,slides:[{layout:'cover',heading:'Title'},{layout:'columns',heading:'Three parallel findings',points:items.map(([heading,body])=>({heading,body}))}]});assert.equal(creationPreview(base,{baseRevision:0,summary:'Parallel',operations:ops},{brief:'Review',audience:'',slideCount:2,collection:'review',materials:''}).slides[1].template?.prototype,'insights');
});

test('template modification uses live content, keeps slide identity, custom objects, notes and local styles',async()=>{
 const base=await createAIBase('review'),page=(await authoredTemplatePages(base,'insights','review',{heading:'Original heading',items},1,'Original notes'))[0];
 const deck={...base,slides:[page]},heading=page.elements.find(e=>e.name==='Slide heading')!;
 const live=applyOperations(deck,[{op:'update_element',slideId:page.id,elementId:heading.id,patch:{text:'Manually revised heading',fontFamily:'Local Author Font',fill:'#884422'}},{op:'add_element',slideId:page.id,element:element('text',{text:'Keep my custom annotation',x:18,y:730,w:400,h:40})}],0,'manual');
 const before=structuredClone(live),custom=live.slides[0].elements.find(e=>e.text==='Keep my custom annotation')!;
 const prepared=await prepareTemplateUpdate(live,{slideId:page.id,layout:'content',content:{density:'reading'}});const after=validateAIProposal(live,{baseRevision:live.revision,summary:'Reflow',operations:prepared.operations},{slideIds:[page.id],elementIds:[]}).deck;
 assert.equal(after.slides[0].id,page.id);assert.equal(after.slides[0].template?.prototype,'content');assert.equal(after.slides[0].template?.density,'reading');assert.deepEqual(readTemplate(after.slides[0]).content.items,items);assert.equal(readTemplate(after.slides[0]).content.heading,'Manually revised heading');assert.equal(after.slides[0].notes,'Original notes');assert.deepEqual(after.slides[0].elements.find(e=>e.id===custom.id),custom);const newHeading=after.slides[0].elements.find(e=>e.name==='Slide heading')!;assert.equal(newHeading.fontFamily,'Local Author Font');assert.equal(newHeading.fill,'#884422');assert.deepEqual(after.designSystem,live.designSystem);assert.deepEqual(live,before);
 const kit=editingToolkit(async()=>live,undefined,{slideIds:[page.id],elementIds:[]}),recipe=await invoke(kit,'prepare_template_update',{slideId:page.id,content:{body:'A new authored introduction'}});assert(recipe.recipeId);assert.equal(recipe.retainedObjects,2); // Custom annotation and the existing managed page number.
 const copyKit=editingToolkit(async()=>live),copy=await invoke(copyKit,'prepare_duplicate_slide',{slideId:page.id}),copyProposal=await invoke(copyKit,'propose_prepared_edits',{baseRevision:live.revision,summary:'Copy template',recipeIds:[copy.recipeId]});const copied=applyOperations(live,copyProposal.operations,live.revision,'ai').slides.at(-1)!;assert(readTemplate(copied).canReflow);assert.equal(readTemplate(copied).content.heading,'Manually revised heading');assert(!copied.template?.slots?.some(slot=>page.elements.some(e=>e.id===slot.elementId)));
});

test('safe reflow rejects evidence gaps, incompatible content loss, sources, locks, scope and stale recipes',async()=>{
 const base=await createAIBase('review');await assert.rejects(()=>authoredTemplatePages(base,'timeline','review',{heading:'Plan',items}),/actual date/);await assert.rejects(()=>authoredTemplatePages(base,'trend','review',{heading:'Result'}),/real chart values/);await assert.rejects(()=>authoredTemplatePages(base,'action-plan','review',{heading:'Work'}),/authored cells/);await assert.rejects(()=>authoredTemplatePages(base,'quote','review',{heading:'Invented voice'}),/attribution/);
 const page=(await authoredTemplatePages(base,'insights','review',{heading:'Parallel',items}))[0],deck={...base,slides:[page]};await assert.rejects(()=>prepareTemplateUpdate(deck,{slideId:page.id,layout:'statement'}),/retain all supplied content/);
 const locked=structuredClone(deck);locked.slides[0].elements[0].locked=true;await assert.rejects(()=>prepareTemplateUpdate(locked,{slideId:page.id,layout:'content'}),/Unlock/);
 const sourced=structuredClone(deck);sourced.slides[0].source={provider:'original',fidelity:'source-render',warnings:[]};await assert.rejects(()=>prepareTemplateUpdate(sourced,{slideId:page.id}),/imported source/);
 const kit=editingToolkit(async()=>deck,undefined,{slideIds:[page.id],elementIds:[page.elements[0].id]});await assert.rejects(()=>invoke(kit,'prepare_template_update',{slideId:page.id,layout:'content'}),/This slide/);
 let saved=deck;const stale=editingToolkit(async()=>saved),recipe=await invoke(stale,'prepare_template_update',{slideId:page.id,layout:'content'});saved={...saved,revision:1};await assert.rejects(()=>invoke(stale,'propose_prepared_edits',{baseRevision:1,summary:'Reflow',recipeIds:[recipe.recipeId]}),/revision|changed/);
 const legacy=newDeck('Legacy',[{...page,template:{prototype:'insights',collection:'review',variant:'standard',density:'presentation'}}]);assert(!readTemplate(legacy.slides[0]).canReflow);await assert.rejects(()=>prepareTemplateUpdate(legacy,{slideId:page.id}),/older template/);
});

test('automatic family choice applies only to new drafts and an explicit family stays authoritative',async()=>{
 const base=await createAIBase('review'),story={title:'Pitch',collection:'pitch',replaceBlank:true,slides:[{layout:'cover',heading:'A clear investment story'},{layout:'summary',heading:'Support the next step',points:items.map(([heading,body])=>({heading,body}))}]};
 const brief={brief:'Create a pitch',audience:'Investors',slideCount:2,collection:'review' as const,templateMode:'auto' as const,materials:''};
 const auto=await runAI(base,brief.brief,{slideIds:[base.slides[0].id],elementIds:[]},{provider:'compatible',baseUrl:'http://127.0.0.1:11434/v1',model:'fixture'},{creation:brief,transport:async()=>Response.json({choices:[{message:{content:JSON.stringify({storyJson:JSON.stringify(story)})}}]})});assert(!('kind' in auto));const preview=creationPreview(base,auto,brief);assert.equal(preview.templateCollection,'pitch');assert.equal(preview.designSystem?.name,'Signal');assert.equal(base.templateCollection,'review');
 const fixed=await runAI(base,brief.brief,{slideIds:[base.slides[0].id],elementIds:[]},{provider:'compatible',baseUrl:'http://127.0.0.1:11434/v1',model:'fixture'},{creation:{...brief,templateMode:'fixed'},transport:async()=>Response.json({choices:[{message:{content:JSON.stringify({storyJson:JSON.stringify(story)})}}]})});assert(!('kind' in fixed));assert.equal(creationPreview(base,fixed,{...brief,templateMode:'fixed'}).templateCollection,'review');
});

test('provider tuple schemas remain callable and creation preserves date precision',()=>{
 const schema:any=strictToolSchema(TemplateUpdateSchema);const arrays=(node:any):void=>{if(!node||typeof node!=='object')return;if(node.type==='array')assert(!Array.isArray(node.items));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(arrays);else arrays(value);};arrays(schema);
 const brief={brief:'Plan for October 20',audience:'',slideCount:2,collection:'review' as const,materials:''};const story=StorySchema.parse({title:'Plan',slides:[{layout:'cover',heading:'Research plan'},{layout:'timeline',heading:'Milestone',dates:['2023-10-20'],points:[{heading:'Recruit',body:'Recruit on October 20'}]}]});assert.throws(()=>validateCreationEvidence(story,brief),/year 2023 was not supplied/);story.slides[1].dates=['October 20'];assert.doesNotThrow(()=>validateCreationEvidence(story,brief));
});


test('portable artwork stays removable while manually replaced artwork remains protected',async()=>{
 const base=await createAIBase('review'),page=(await authoredTemplatePages(base,'cover','review',{heading:'Cover',body:'Actual context'}))[0],deck={...base,slides:[page]},embedded=structuredClone(deck),art=embedded.slides[0].elements.find(e=>e.type==='image')!;assert(art);art.src='data:image/png;base64,cG9ydGFibGU=';const portable=portableTemplateOwnership(deck,embedded);const changed=await prepareTemplateUpdate(portable,{slideId:page.id,content:{noImage:true},density:'reading'});const result=applyOperations(portable,changed.operations,portable.revision,'ai');assert(!result.slides[0].elements.some(e=>e.type==='image'));assert.equal(result.slides[0].template?.density,'reading');
 const authored=structuredClone(portable);authored.slides[0].elements.find(e=>e.id===art.id)!.src='data:image/png;base64,YXV0aG9y';const safe=await prepareTemplateUpdate(authored,{slideId:page.id,content:{noImage:true}});assert.equal(safe.retainedObjects,2);assert(applyOperations(authored,safe.operations,authored.revision,'ai').slides[0].elements.some(e=>e.id===art.id));
});

test('continuations keep their authored heading and remain independently adaptable',async()=>{
 const base=await createAIBase('review'),pages=await authoredTemplatePages(base,'content','review',{heading:'Six authored points',items:Array.from({length:6},(_,i)=>[`Point ${i+1}`,`Actual detail ${i+1}`])});assert.equal(pages.length,2);assert.equal(readTemplate(pages[1]).content.heading,'Six authored points · Continued');assert(readTemplate(pages[1]).canReflow);const deck={...base,slides:pages},prepared=await prepareTemplateUpdate(deck,{slideId:pages[1].id,density:'reading'});const result=applyOperations(deck,prepared.operations,deck.revision,'ai');assert.deepEqual(result.slides[0],pages[0]);assert.equal(readTemplate(result.slides[1]).content.items?.[0][1],'Actual detail 6');
});

test('AI creation rejects invented calendar days and step counters, while matching supplied date formats',()=>{
 const brief={brief:'Four ordered steps: write, review, edit, export',audience:'',slideCount:2,collection:'review' as const,materials:''};const story=StorySchema.parse({title:'Workflow',slides:[{layout:'cover',heading:'Workflow'},{layout:'timeline',heading:'Four steps',dates:['10-01','10-05'],points:[{heading:'Write',body:'Write the brief'},{heading:'Review',body:'Review the draft'}]}]});assert.throws(()=>validateCreationEvidence(story,brief),/date "10-01" was not supplied/);story.slides[1].dates=['1','2'];assert.throws(()=>validateCreationEvidence(story,brief),/Use process/);story.slides[1].layout='process';story.slides[1].dates=undefined;assert.doesNotThrow(()=>validateCreationEvidence(story,brief));
 story.slides[1].layout='timeline';story.slides[1].dates=['10-20','10/23'];assert.doesNotThrow(()=>validateCreationEvidence(story,{...brief,materials:'10月20日招募，October 23 review'}));story.slides[1].points![0].body='Write on October 19';assert.throws(()=>validateCreationEvidence(story,{...brief,materials:'10月20日招募，October 23 review'}),/date "10-19"/);
});

test('AI creation honors an illustrated cover and avoids repeated one-point headings',()=>{
 const brief={brief:'封面有叙事作用的插画',audience:'',slideCount:2,collection:'review' as const,materials:''};const story=StorySchema.parse({title:'Product',slides:[{layout:'statement',heading:'Product'},{layout:'content',heading:'Principles',points:[{heading:'Principles',body:'A; B; C'}]}]});assert.throws(()=>validateCreationEvidence(story,brief),/illustrated cover/);story.slides[0].layout='cover';story.slides[0].noImage=true;assert.throws(()=>validateCreationEvidence(story,brief),/noImage:false/);story.slides[0].noImage=false;assert.throws(()=>validateCreationEvidence(story,brief),/do not repeat/);story.slides[1].points=undefined;story.slides[1].body='One authored takeaway';assert.doesNotThrow(()=>validateCreationEvidence(story,brief));
});

test('AI creation keeps optional accounts out of a local-first signup CTA',()=>{
 const brief={brief:'产品演示，不要添加注册账号环节',audience:'',slideCount:2,collection:'review' as const,materials:'普通本地编辑无需账号'};const story=StorySchema.parse({title:'Product',slides:[{layout:'cover',heading:'Product'},{layout:'summary',heading:'Next',points:[{heading:'注册账号',body:'Start'},{heading:'Create',body:'A deck'}]}]});assert.throws(()=>validateCreationEvidence(story,brief),/account registration is not required/);story.slides[1].points![0].heading='写一句需求';assert.doesNotThrow(()=>validateCreationEvidence(story,brief));story.slides[1].points![0].heading='注册账号';assert.doesNotThrow(()=>validateCreationEvidence(story,{...brief,brief:'说明可选注册账号功能'}));
});
