import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAIBase} from '../src/core/ai-story-builder';
import {authoredTemplatePages,prepareTemplateUpdate,readTemplate,TemplateUpdateSchema} from '../src/core/ai-templates';
import {sampleChart} from '../src/core/charts';
import {applyOperations} from '../src/core/operations';
import {resolvePageRequest,validatePageRequest,requestsNotesEdit} from '../src/core/ai-page-request';
import {pageBatchModelSchema} from '../server/ai-page-schema';
import {PageEditsSchema} from '../src/core/ai-page-edits';
import {strictToolSchema} from '../src/core/ai-tools';
import {StorySchema,validateCreationEvidence} from '../src/core/ai-story';
import {reviewStoryEvidence} from '../server/ai-evidence-review';
import {runAI} from '../server/ai';

const brief={brief:'Train volunteers. Keep quiz answers only in speaker notes.',audience:'Volunteers',slideCount:2,collection:'review' as const,materials:'If the barcode is missing, notify the coordinator.'};
const story=()=>StorySchema.parse({title:'Returns',replaceBlank:true,slides:[{layout:'cover',heading:'Handle exceptions carefully',notes:'Introduce the rules.'},{layout:'insights',heading:'Check your understanding',points:[{heading:'Missing barcode?',body:'What should you do?'},{heading:'Who decides?',body:'Who owns exceptions?'}],notes:'Answers: notify the coordinator; the coordinator decides.'}]});
const planAnswer=()=>answer('openai',{throughline:'Route exceptions',illustrationQuery:'',collection:'review',pages:{slide1:{briefRequirement:'',question:'Why?',takeaway:'Handle exceptions carefully',relationship:'single',orderEvidence:'',layout:'cover',reason:'Welcome'},slide2:{briefRequirement:'',question:'What to do?',takeaway:'Check your understanding',relationship:'parallel',orderEvidence:'',layout:'insights',reason:'Two questions'}},sources:{source1:{slide:2,placement:'notes'}}});
const answer=(provider:string,raw:any)=>{const value=raw.pages?raw:{narrative:{requestedContent:{slide:1,problem:''},relationships:{slide:1,problem:''},claims:{slide:1,problem:''}},coverage:{source1:{slide:2,status:'covered',quotes:['Answers: notify the coordinator; the coordinator decides.'],problem:''}},...raw};return Response.json(provider==='openai'?{output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}:{choices:[{message:{content:JSON.stringify(value)}}]});};

test('explicit notes-only quiz answers move intact while questions and non-quiz instructions stay visible',async()=>{
 const {placeQuizAnswersInNotes}=await import('../src/core/ai-story-quality'),value=story();value.slides[1].points![0].body='Place in the review tray and notify the coordinator.';const original=structuredClone(value);
 placeQuizAnswersInNotes(value,brief);assert.equal(value.slides[1].points![0].body,'');assert.match(value.slides[1].notes!,/Missing barcode\?\nPlace in the review tray and notify the coordinator\./);assert.equal(value.slides[1].points![1].body,'Who owns exceptions?');
 const unrestricted=structuredClone(original);placeQuizAnswersInNotes(unrestricted,{...brief,brief:'Train volunteers.'});assert.deepEqual(unrestricted,original);
 const instruction=structuredClone(original);instruction.slides[1].heading='Handle exceptions';placeQuizAnswersInNotes(instruction,brief);assert.equal(instruction.slides[1].points![0].body,original.slides[1].points![0].body);
});

test('four routine steps with longer labels stay together when the measured native process fits',async()=>{
 const {createTemplatePages}=await import('../src/core/templates'),items:[string,string][]=[['Read the barcode on the book','Find the code on its cover.'],['Confirm the title in the local catalogue','Match the catalogue record.'],['Inspect for visible damage','Check the cover and pages.'],['Record the return and place on shelf','Complete only routine returns.']];
 for(const collection of ['review','portfolio','report']){const pages=createTemplatePages('process',1,collection,{heading:'Handle a routine return in four steps',items});assert.equal(pages.length,1);for(const [label,detail] of items){assert(pages[0].elements.some(e=>e.text===label));assert(pages[0].elements.some(e=>e.text===detail));}assert(pages[0].elements.filter(e=>e.type==='text'&&!e.pageElement).every(e=>e.y+e.h<=750));}
 const long=items.map(([a,b])=>[a,b.repeat(15)] as [string,string]);assert(createTemplatePages('process',1,'review',{heading:'Longer instructions',items:long}).length>1);
 const routine:[string,string][]=[['Read the barcode','Find the barcode on the book.'],['Confirm the catalogue title','Match the title in the local catalogue.'],['Inspect for visible damage','Pause for the exception guide if damage is visible.'],['Record and shelve the return','For routine returns, record completion and use the return shelf.']];const pages=createTemplatePages('process',1,'review',{heading:'Four routine steps',body:'Stop and ask for help with exceptions.',items:routine});assert.equal(pages.length,1);assert.match(pages[0].template!.variant,/vertical/);
});

test('a complete question-list replacement changes count atomically and rejects an omitted replacement',async()=>{
 const {pageEditOperations}=await import('../src/core/ai-page-edits'),{requestedItemCount}=await import('../src/core/ai-page-request'),base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'content','review',{heading:'Knowledge check',items:[['Q1','A'],['Q2','B'],['Q3','C']]}))[0],deck={...base,slides:[slide]},request=resolvePageRequest(deck,'第1页改为insights版式，标题改为“Check your understanding”，只保留两个问题点。');assert.equal(request.pages[0].itemCount,2);assert.equal(requestedItemCount('On slide 1 use two questions.'),2);assert.equal(requestedItemCount('Do not replace with two questions.'),undefined);
 const wire=pageBatchModelSchema(deck,request,strictToolSchema(PageEditsSchema)),shape=wire.properties.pages.items.properties;assert(shape.replaceItems);assert(!shape.items);
 const missing=await pageEditOperations(deck,{baseRevision:0,summary:'Incomplete',pages:[{number:1,heading:'Check your understanding',layout:'insights'}]});assert.throws(()=>validatePageRequest(deck,{baseRevision:0,summary:'Incomplete',operations:missing.operations},request),/exactly 2 items/);
 const complete=await pageEditOperations(deck,{baseRevision:0,summary:'Two questions',pages:[{number:1,heading:'Check your understanding',layout:'insights',replaceItems:[{heading:'No barcode?',body:'The title is readable.'},{heading:'Visible damage?',body:'You have not recorded the return.'}]}]});assert.doesNotThrow(()=>validatePageRequest(deck,{baseRevision:0,summary:'Two questions',operations:complete.operations},request));const result=applyOperations(deck,complete.operations,0,'ai');assert.equal(readTemplate(result.slides[0]).content.items!.length,2);assert(!result.slides[0].elements.some(e=>e.text==='Q3'));assert.equal(deck.slides[0].elements.some(e=>e.text==='Q3'),true);
});

test('natural correction authorizes chart values and notes, while keeping other pages and display settings',async()=>{
 const base=await createAIBase('review'),chart={...sampleChart(),labels:['旧流程','新流程'],series:[{name:'完成取件人数',values:[26,32]}],source:'Supplied record',subtitle:'Custom chart subtitle',legendPosition:'right' as const,axisStyle:{fontSize:24,rotation:0}};
 const slide=(await authoredTemplatePages(base,'category-chart','review',{heading:'完成取件人数',body:'两组各40位',chart}))[0];
 const deck={...base,slides:[...(await authoredTemplatePages(base,'statement','review',{heading:'Keep this page'})),slide]};
 const prompt='更正材料：新流程完成取件人数应为31位，不是32位；每组样本仍为40位。请只修改第2页，更新图表和涉及该数字的文案，副标题注明两组均为40位且非随机分组。把旧流程3.8分钟、新流程2.9分钟的中位耗时放进该页讲稿，不要把人数和分钟混在同一张图。其他页保持不变。';
 const request=resolvePageRequest(deck,prompt),requirement=request.pages[0];assert(requirement.notesEditable);assert(requirement.chart?.editable.includes('series'));assert.match(requirement.instruction,/31位/);
 const input=TemplateUpdateSchema.parse({slideId:slide.id,content:{chart:{series:[{name:chart.series[0].name,values:[26,31]}]}},notes:'旧流程3.8分钟，新流程2.9分钟；非随机分组。'});
 const prepared=await prepareTemplateUpdate(deck,input),proposal={baseRevision:deck.revision,summary:'Correct the recorded count',operations:prepared.operations};
 assert.doesNotThrow(()=>validatePageRequest(deck,proposal,request));const after=applyOperations(deck,proposal.operations,deck.revision,'ai');assert.deepEqual(after.slides[0],deck.slides[0]);
 assert.deepEqual(readTemplate(after.slides[1]).content.chart,{...readTemplate(slide).content.chart,series:[{name:chart.series[0].name,values:[26,31]}]});
 const wire=pageBatchModelSchema(deck,request,strictToolSchema(PageEditsSchema));assert(wire.properties.pages.items.properties.notes);
 assert.equal(requestsNotesEdit('把解释放进讲稿，不要修改图表。'),true);assert.equal(requestsNotesEdit('Move the full explanation into speaker notes.'),true);assert.equal(requestsNotesEdit('Keep speaker notes unchanged. Update the chart.'),false);assert.equal(requestsNotesEdit('不要修改讲稿。'),false);
});

test('chart template patches merge nested display settings instead of resetting unmentioned fields',async()=>{
 const base=await createAIBase('report'),page=(await authoredTemplatePages(base,'trend','report',{heading:'Observed trend',chart:{...sampleChart(),type:'line',axisStyle:{fontSize:26,rotation:30,showLabels:true},source:'Original source'}}))[0],deck={...base,slides:[page]};
 const update=await prepareTemplateUpdate(deck,TemplateUpdateSchema.parse({slideId:page.id,content:{chart:{axisStyle:{fontSize:30}}}}));
 const result=applyOperations(deck,update.operations,0,'ai'),before=readTemplate(page).content.chart!;assert.deepEqual(readTemplate(result.slides[0]).content.chart,{...before,axisStyle:{...before.axisStyle,fontSize:30}});
});

test('authored closing pages never retain empty sample counters, but process steps keep useful numbering',async()=>{
 const base=await createAIBase('review');for(const collection of ['review','portfolio','report','minimal','proposal','pitch']){
  const close=(await authoredTemplatePages(base,'close',collection,{heading:'Ask the coordinator',body:'Use the review tray for exceptions.'}))[0];assert(!close.elements.some(e=>e.type==='text'&&!e.pageElement&&/^\d+$/.test(e.text)));
 }
 const cover=(await authoredTemplatePages(base,'cover','review',{heading:'Welcome to the community book return team',body:'Handle routine returns and route exceptions.',coverVisual:'illustration'}))[0];assert.equal(cover.elements.find(e=>e.type==='image')?.resource?.kind,'illustration');assert(cover.elements.find(e=>e.type==='image')!.h>=300);assert.equal(readTemplate(cover).content.coverVisual,'illustration');
 const steps=(await authoredTemplatePages(base,'process','review',{heading:'Return workflow',items:[['Scan','Read barcode'],['Check','Confirm title']]}))[0];assert(steps.elements.some(e=>e.text==='01'&&!e.pageElement));
});

test('source quantities cannot disappear when details move to notes',()=>{
 const input={...brief,materials:'原型测试8位，新流程观察40位。旧流程中位耗时3.8分钟，新流程2.9分钟。'},value=story();assert.throws(()=>validateCreationEvidence(value,input),/Missing source facts/);
 value.slides[1].notes='原型测试8位，新流程观察40位。旧流程3.8分钟，新流程2.9分钟。';assert.doesNotThrow(()=>validateCreationEvidence(value,input));
});

test('source review preserves the selected provider and requires grounded findings, including compatible transport',async()=>{
 for(const provider of ['openai','compatible'] as const){let seen:any;const options={settings:{provider,baseUrl:'http://127.0.0.1:11434/v1',model:'user-selected-model'},base:'http://127.0.0.1:11434/v1',signal:AbortSignal.timeout(1000),transport:async(_url:any,init:any)=>{seen=JSON.parse(init.body);return answer(provider,{issues:[{slide:2,evidence:'Keep quiz answers only in speaker notes.',problem:'The answer is visible on the slide.'}]});}};
  assert.equal((await reviewStoryEvidence(story(),brief,options)).length,1);assert.equal(seen.model,'user-selected-model');assert(!seen.tools);if(provider==='openai')assert.equal(seen.store,false);
  assert.deepEqual(await reviewStoryEvidence(story(),brief,{...options,transport:async()=>answer(provider,{issues:[{slide:2,evidence:'Invented requirement',problem:'Invented criticism'}]})}),[]);
 }
});

test('creation repairs a source-review finding before exposing a proposal and never mutates the base',async()=>{
 const base=await createAIBase('review'),original=JSON.stringify(base);let generations=0,reviews=0;
 const result=await runAI(base,brief.brief,{slideIds:base.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'selected-model',apiKey:'fixture'},{creation:brief,reviewEvidence:true,transport:async(_url,init)=>{
  const request=JSON.parse(String(init?.body));assert.equal(request.model,'selected-model');if(['deck_creation_slide','deck_speaker_grounding','deck_speaker_script'].includes(request.text.format.name))return Response.json({}, {status:503});if(request.text.format.name==='deck_creation_plan')return Response.json({}, {status:503});if(request.text.format.name==='deck_evidence_review'){reviews++;return answer('openai',{issues:reviews===1?[{slide:2,evidence:'Keep quiz answers only in speaker notes.',problem:'Remove the answer from the visible body and retain it in notes.'}]:[]});}
  generations++;const authored=story();if(generations===1)authored.slides[1].points![0].body='Notify the coordinator.';else assert.match(JSON.stringify(request.input),/Remove the answer/);
  return Response.json({output:[{type:'function_call',call_id:'story-'+generations,name:'prepare_story',arguments:JSON.stringify(authored)}]});
 }});assert(!('kind' in result));assert.equal(generations,2);assert.equal(reviews,2);assert.equal(JSON.stringify(base),original);
});

test('a canonical chart correction refreshes its metric callouts without overwriting authored annotations',async()=>{
 const base=await createAIBase('review'),chart={...sampleChart(),labels:['Previous','Current'],series:[{name:'Completed',values:[26,32]}],suffix:'',source:'Internal log'},page=(await authoredTemplatePages(base,'metrics','review',{heading:'Compare recorded counts',chart}))[0],deck={...base,slides:[page]},target=page.elements.find(e=>e.chart)!;
 const custom=page.elements.find(e=>e.text===chart.series[0].name)!;custom.text='Manually explained outcome';
 const next=applyOperations(deck,[{op:'update_element',slideId:page.id,elementId:target.id,patch:{chart:{...target.chart!,series:[{name:'Completed',values:[26,31]}]}}}],0,'ai'),copy=next.slides[0].elements.filter(e=>e.type==='text').map(e=>e.text);
 assert(copy.includes('31'));assert(copy.includes('Previous: 26\nCurrent: 31'));assert(!copy.includes('32'));assert(copy.includes('Manually explained outcome'));assert.equal(next.slides[0].elements.find(e=>e.chart)!.id,target.id);
});

test('chart-correction completeness rejects a decorative replacement number and unchanged data',async()=>{
 const base=await createAIBase('review'),page=(await authoredTemplatePages(base,'metrics','review',{heading:'Counts',chart:{...sampleChart(),labels:['Old','New'],series:[{name:'Completed',values:[26,32]}]}}))[0],deck={...base,slides:[page]},request=resolvePageRequest(deck,'第1页：更新图表数据，新流程人数应为31。补充讲稿。');
 assert.throws(()=>validatePageRequest(deck,{baseRevision:0,summary:'Only notes',operations:[{op:'update_slide',slideId:page.id,patch:{notes:'31 participants'}}]},request),/native chart data itself/);
});

test('count data cannot be mislabeled as a percentage or rate',async()=>{
 const {validateStoryDesign}=await import('../src/core/ai-story-quality'),value=story();value.slides[1]={layout:'metrics',heading:'Completion',chart:{...sampleChart(),labels:['旧流程完成率','新流程完成率'],series:[{name:'完成取件人数',values:[26,32]}],suffix:'人'},notes:'Two independent groups of40 people.'};
 assert.throws(()=>validateStoryDesign(value,brief),/absolute counts/);value.slides[1].chart!.labels=['旧流程','新流程'];assert.doesNotThrow(()=>validateStoryDesign(value,brief));
});

test('natural quoted chart labels can change without changing the data',async()=>{
 const base=await createAIBase('review'),page=(await authoredTemplatePages(base,'metrics','review',{heading:'Observed counts',chart:{...sampleChart(),labels:['旧流程完成率','新流程完成率'],series:[{name:'Completed',values:[26,31]}]}}))[0],deck={...base,slides:[page]};
 const request=resolvePageRequest(deck,'修改第1页：图表标签改为“旧流程、新流程”，保留当前26、31，只改标签。');
 assert.deepEqual(request.pages[0].chart?.labels,['旧流程','新流程']);
 const update=await prepareTemplateUpdate(deck,TemplateUpdateSchema.parse({slideId:page.id,content:{chart:{labels:['旧流程','新流程']}}}));assert.doesNotThrow(()=>validatePageRequest(deck,{baseRevision:deck.revision,summary:'Clarify units',operations:update.operations},request));
});

test('named point copy and note instructions expose usable fields for the complete batch',async()=>{
 const base=await createAIBase('review'),page=(await authoredTemplatePages(base,'decision','review',{heading:'Decision',body:'Continue verification',items:[['决定','Keep testing'],['验证重点','Fees'],['后续行动','Schedule pending']]}))[0],deck={...base,slides:[page]};
 const request=resolvePageRequest(deck,'修改第1页的后续行动正文为“再验证20位参与者；日期与负责人尚未确认”，讲稿强调只批准小规模验证。');assert(request.pages[0].notesEditable);assert.deepEqual(request.pages[0].textFields,[{key:'items.2.body',value:'再验证20位参与者；日期与负责人尚未确认'}]);
 const wire=pageBatchModelSchema(deck,request,strictToolSchema(PageEditsSchema));assert(wire.properties.pages.items.properties.items);assert(wire.properties.pages.items.properties.notes);
 const {requestedTextPatch}=await import('../server/ai-page-schema');assert.deepEqual(requestedTextPatch(request.pages[0],{items:[{index:0,heading:'Unrequested rewrite',body:'Wrong target'}]}),{items:[{index:2,body:'再验证20位参与者；日期与负责人尚未确认'}]});
});

test('source coverage cannot silently skip a restriction or invent a source key',async()=>{
 const options={settings:{provider:'openai' as const,baseUrl:'',model:'selected'},base:'http://localhost',signal:AbortSignal.timeout(1000),transport:async()=>answer('openai',{issues:[],coverage:{source1:{slide:2,status:'missing',quotes:[],problem:'Preserve the coordinator rule.'}}})};
 assert.match((await reviewStoryEvidence(story(),brief,options))[0].problem,/coordinator rule/);
 await assert.rejects(()=>reviewStoryEvidence(story(),brief,{...options,transport:async()=>answer('openai',{issues:[],coverage:{source2:{slide:2,status:'covered',quotes:['Answers: notify the coordinator; the coordinator decides.'],problem:''}}})}),/invalid result/);
 await assert.rejects(()=>reviewStoryEvidence(story(),brief,{...options,transport:async()=>answer('openai',{issues:[],coverage:{}})}),/invalid result/);
});

test('page batches update native table cells in place and can reflow points into a comparison table',async()=>{
 const {pageEditOperations}=await import('../src/core/ai-page-edits'),{usePageBatch}=await import('../src/core/ai-page-request');const base=await createAIBase('review');
 const original=(await authoredTemplatePages(base,'insights','review',{heading:'Route exceptions',items:[['Missing barcode','Review tray; notify coordinator'],['Visible damage','Notify before recording']]}))[0],deck={...base,slides:[original]},cells=[['Condition','Do','Do not'],['Missing barcode','Review tray; notify coordinator','Guess the title'],['Visible damage','Notify before recording','Record before review']];
 const request=resolvePageRequest(deck,'On slide 1, change the layout to comparison with a readable native table.');assert.equal(request.pages[0].layout,'comparison');assert(usePageBatch('On slide 1, change the layout to comparison with a readable native table.',request));assert(pageBatchModelSchema(deck,request,strictToolSchema(PageEditsSchema)).properties.pages.items.properties.cells);
 const result=await pageEditOperations(deck,{baseRevision:0,summary:'Route exceptions',pages:[{number:1,layout:'comparison',cells}]});const after=applyOperations(deck,result.operations,0,'ai'),table=after.slides[0].elements.find(e=>e.type==='table')!;assert.deepEqual(table.cells,cells);assert.equal(after.slides[0].id,original.id);assert.equal(after.slides[0].notes,original.notes);
 const changed=structuredClone(cells);changed[1][2]='Guess or record';const patch=await pageEditOperations(after,{baseRevision:after.revision,summary:'Clarify',pages:[{number:1,cells:changed}]});assert.deepEqual(patch.operations,[{op:'update_element',slideId:original.id,elementId:table.id,patch:{cells:changed}}]);
});

test('unresolved semantic reviews remain visible on a structurally valid draft after two bounded repairs',async()=>{
 const base=await createAIBase('review');let generations=0,reviews=0;const result=await runAI(base,brief.brief,{slideIds:base.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'selected',apiKey:'fixture'},{creation:brief,reviewEvidence:true,transport:async(_url,init)=>{
  const request=JSON.parse(String(init?.body));if(['deck_creation_slide','deck_speaker_grounding','deck_speaker_script'].includes(request.text.format.name))return Response.json({}, {status:503});if(request.text.format.name==='deck_creation_plan')return Response.json({}, {status:503});if(request.text.format.name==='deck_evidence_review'){reviews++;return answer('openai',{issues:[{slide:2,evidence:'Keep quiz answers only in speaker notes.',problem:'Review answer placement.'}]});}
  generations++;return Response.json({output:[{type:'function_call',call_id:'story-'+generations,name:'prepare_story',arguments:JSON.stringify(story())}]});
 }});assert(!('kind' in result));if('kind' in result)return;assert.equal(generations,3);assert.equal(reviews,3);assert.equal(result.reviewWarnings?.[0].problem,'Review answer placement.');assert.equal(base.revision,0);
});

test('an explicitly rewritten closing slide reflows without carrying obsolete item scaffolding',async()=>{
 const {pageEditOperations}=await import('../src/core/ai-page-edits'),base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'insights','review',{heading:'Review',items:[['One','First observation'],['Two','Second observation']]}))[0],deck={...base,slides:[slide]};const p=await pageEditOperations(deck,{baseRevision:0,summary:'Close with the requested action',pages:[{number:1,layout:'close',heading:'Authorize the investigation',body:'Keep claims provisional until the evidence is reviewed.'}]});const after=applyOperations(deck,p.operations,0,'ai');assert.equal(after.slides[0].template?.prototype,'close');assert.equal(readTemplate(after.slides[0]).content.body,'Keep claims provisional until the evidence is reviewed.');assert(!after.slides[0].elements.some(e=>['01','02','First observation'].includes(e.text)&&!e.pageElement));
});

test('explicitly reflowing the current cover refreshes its layout while preserving authored copy and artwork',async()=>{
 const {pageEditOperations}=await import('../src/core/ai-page-edits'),base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'cover','review',{heading:'Keep the actual takeaway',body:'A concise supporting sentence.',coverVisual:'illustration'}))[0],deck={...base,slides:[slide]};const oldImage=slide.elements.find(e=>e.type==='image')!,ops=await pageEditOperations(deck,{baseRevision:0,summary:'Reflow current cover',pages:[{number:1,layout:'cover',reflow:true}]});assert(ops.operations.length>0);const after=applyOperations(deck,ops.operations,0,'ai');assert.equal(readTemplate(after.slides[0]).content.heading,'Keep the actual takeaway');assert.equal(readTemplate(after.slides[0]).content.body,'A concise supporting sentence.');assert.equal(after.slides[0].elements.find(e=>e.type==='image')!.id,oldImage.id);assert.equal(after.slides[0].elements.find(e=>e.type==='image')!.src,oldImage.src);
});

test('knowledge checks cannot visibly label their answer or replace answer notes with a placeholder',async()=>{
 const {validateStoryDesign}=await import('../src/core/ai-story-quality'),value=story();value.slides[1].points![0]={heading:'Correct Answer',body:'Notify the coordinator.'};value.slides[1].notes='The answer is in the notes.';assert.throws(()=>validateStoryDesign(value,brief),/quiz answers belong only/);value.slides[1].points![0]={heading:'Missing barcode?',body:'What should you do?'};assert.throws(()=>validateStoryDesign(value,brief),/actual quiz answer/);value.slides[1].notes='Notify the coordinator and place the book in the review tray.';assert.doesNotThrow(()=>validateStoryDesign(value,brief));
});

test('source advice does not consume the last structural repair and discard a valid draft',async()=>{
 const base=await createAIBase('review');let generations=0,reviews=0;const result=await runAI(base,brief.brief,{slideIds:base.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'selected',apiKey:'fixture'},{creation:brief,reviewEvidence:true,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body));if(['deck_creation_slide','deck_speaker_grounding','deck_speaker_script'].includes(request.text.format.name))return Response.json({}, {status:503});if(request.text.format.name==='deck_creation_plan')return Response.json({}, {status:503});if(request.text.format.name==='deck_evidence_review'){reviews++;return answer('openai',{issues:[{slide:2,evidence:'Keep quiz answers only in speaker notes.',problem:'Check the wording.'}]});}generations++;const value=story();if(generations<3)value.slides[1].points![0].heading='Correct Answer';return Response.json({output:[{type:'function_call',call_id:'story-'+generations,name:'prepare_story',arguments:JSON.stringify(value)}]});}});assert(!('kind' in result));if('kind' in result)return;assert.equal(generations,5);assert.equal(reviews,3);assert.equal(result.reviewWarnings?.[0].problem,'Check the wording.');
});

test('a new closing body and its following quoted notes remain distinct fields',async()=>{
 const base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'insights','review',{heading:'Options',items:[['First','A'],['Second','B']]}))[0],request=resolvePageRequest({...base,slides:[slide]},'第1页改为close版式，标题改为“Approve the next step”，正文改为“Keep claims provisional.”，讲稿改为“We are asking only to investigate, not to claim improvement.”。');assert.deepEqual(request.pages[0].textFields,[{key:'heading',value:'Approve the next step'},{key:'body',value:'Keep claims provisional.'},{key:'notes',value:'We are asking only to investigate, not to claim improvement.'}]);assert(request.pages[0].notesEditable);
});

test('a named page and everything else can remain protected at the end of a mixed request',async()=>{
 const base=await createAIBase('review'),slides=await Promise.all(['First','Second','Third'].map(async heading=>(await authoredTemplatePages(base,'statement','review',{heading}))[0])),deck={...base,slides};
 for(const prompt of ['第1页重新排版。第2页讲稿改为“Explain the evidence.”。第3页和其他内容保持不变。','Reflow slide 1. Update notes on slide 2. Slide 3 and everything else unchanged.']){const request=resolvePageRequest(deck,prompt);assert.deepEqual(request.pages.map(p=>p.number),[1,2]);assert(request.protectedIds.includes(slides[2].id));}
});

test('starting from the current slide binds the editor selection even when the model supplies another ID',async()=>{
 const base=await createAIBase('review'),slides=await Promise.all(['First','Second'].map(async heading=>(await authoredTemplatePages(base,'statement','review',{heading}))[0])),deck={...base,slides},settings={provider:'openai' as const,baseUrl:'',model:'selected-model',apiKey:'fixture'};
 for(const envelope of [false,true]){let queued:any;const workflowServices={request:async(_deck:any,action:any)=>{queued=action;return {id:'00000000-0000-4000-8000-000000000001',deckId:deck.id,baseRevision:deck.revision,action,status:'pending' as const,createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:00:00Z'};},read:async()=>{throw new Error('Unexpected read');},connections:async()=>({})};
  const result=await runAI(deck,'Start the presentation from the current slide.',{slideIds:slides.map(s=>s.id),elementIds:[]},settings,{activeSlideId:slides[0].id,workflowServices,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body)),context=JSON.parse(request.input[0].content);assert.equal(context.activeSlide.id,slides[0].id);assert.equal(context.activeSlide.number,1);const action={kind:'presentation',command:'start',slideId:slides[1].id};return Response.json({output:envelope?[{type:'message',content:[{type:'output_text',text:JSON.stringify({resultJson:JSON.stringify({action})})}]}]:[{type:'function_call',call_id:'start',name:'request_presentation',arguments:JSON.stringify({command:'start',slideId:slides[1].id})}]});}});assert('kind' in result&&result.kind==='workflow');assert.equal(queued.slideId,slides[0].id);assert.equal(result.request.status,'pending');
 }
});

test('repeated native reflow preserves one managed page field instead of accumulating duplicate numbers',async()=>{
 const {pageEditOperations}=await import('../src/core/ai-page-edits'),base=await createAIBase('review'),slide=(await authoredTemplatePages(base,'cover','review',{heading:'Keep the page number',body:'One managed field.',coverVisual:'illustration'}))[0],number=slide.elements.find(e=>e.pageElement?.kind==='page-number')!;number.fill='#123456';if(number.design)delete number.design.fill;slide.elements.push({...structuredClone(number),id:'old-duplicate-page-number'});let deck:import('../src/core/model').Deck={...base,slides:[slide]};
 for(let i=0;i<3;i++){const result=await pageEditOperations(deck,{baseRevision:deck.revision,summary:'Refresh layout',pages:[{number:1,reflow:true}]});deck=applyOperations(deck,result.operations,deck.revision,'ai');const fields=deck.slides[0].elements.filter(e=>e.pageElement?.kind==='page-number');assert.equal(fields.length,1);assert.equal(fields[0].id,number.id);assert.equal(fields[0].fill,'#123456');}
});
