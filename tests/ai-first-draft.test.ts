import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creationPlanSchema,planCreation} from '../server/ai-creation-plan';
import {evidenceReviewSchema,reviewStoryEvidence,sourceReviewChecklist} from '../server/ai-evidence-review';
import {creationArtwork,applyCreationArtwork} from '../server/ai-creation-artwork';
import {createAIBase,prepareStory,creationFitIssues,creationPreview} from '../src/core/ai-story-builder';
import {StorySchema,type CreationBrief} from '../src/core/ai-story';
import {applyOperations} from '../src/core/operations';
import {runAI} from '../server/ai';
import {validateStoryDesign} from '../src/core/ai-story-quality';
import type {EditingServices} from '../src/core/ai-tools';

const brief:CreationBrief={brief:'Explain returns. Then ask two questions; answers in speaker notes.',audience:'Volunteers',slideCount:2,collection:'review',templateMode:'auto',delivery:'presentation',materials:'Do not guess the title. Notify the coordinator.'};
const story=()=>StorySchema.parse({title:'Returns',replaceBlank:true,collection:'review',slides:[{layout:'cover',heading:'Route uncertain returns for review',body:'The coordinator decides exceptions.',noImage:true,notes:'Do not guess the title. Notify the coordinator.'},{layout:'insights',heading:'Check your understanding',points:[{heading:'Can you guess a title?',body:''},{heading:'Who handles exceptions?',body:''}],notes:'Do not guess the title. Notify the coordinator.'}]});
const plan=()=>({collection:'report',throughline:'Route exceptions safely',illustrationQuery:'',pages:{slide2:{briefRequirement:'ask two questions',question:'Can you apply it?',takeaway:'Confirm understanding',relationship:'parallel',orderEvidence:'',layout:'insights',reason:'Two questions'},slide1:{briefRequirement:'Explain returns',question:'What should I do?',takeaway:'Ask the coordinator',relationship:'single',orderEvidence:'',layout:'cover',reason:'One clear takeaway'}},sources:{source1:{slide:1,placement:'notes'},source2:{slide:1,placement:'visible'}}});
const response=(value:unknown)=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const options={settings:{provider:'openai' as const,baseUrl:'',model:'chosen-model'},base:'https://example.invalid/v1',signal:AbortSignal.timeout(10000),transport:async()=>response(plan())};
const covered=()=>({narrative:{requestedContent:{slide:1,problem:''},relationships:{slide:1,problem:''},claims:{slide:1,problem:''}},coverage:{source1:{slide:1,quotes:['Do not guess the title.'],status:'covered',problem:''},source2:{slide:1,quotes:['Notify the coordinator.'],status:'covered',problem:''}},issues:[]});

test('planning retains all material and requested page order even when provider object keys are reordered',async()=>{
 const result=await planCreation(brief,{},options);assert.equal(result.collection,'report');assert.deepEqual(result.pages.map(p=>p.number),[1,2]);assert.equal(result.pages[0].question,'What should I do?');assert.deepEqual(result.pages.flatMap(p=>p.sources.map(s=>s.text)),sourceReviewChecklist(brief.materials));
 const fixed=await planCreation({...brief,templateMode:'fixed'}, {},options);assert.equal(fixed.collection,'review');
 const raw=plan();delete (raw.sources as any).source2;assert.throws(()=>creationPlanSchema(brief).parse(raw));
 assert.doesNotThrow(()=>creationPlanSchema({...brief,materials:''}).parse({...plan(),sources:{}}));
});

test('every fixed source key is required and out-of-range slide mappings are rejected',()=>{
 const schema=evidenceReviewSchema(sourceReviewChecklist(brief.materials),2);assert.doesNotThrow(()=>schema.parse(covered()));const value=covered();delete (value.coverage as any).source2;assert.throws(()=>schema.parse(value));const bad=covered();bad.coverage.source1.slide=3;assert.throws(()=>schema.parse(bad));
});

test('claimed coverage with invented supporting quotes becomes actionable feedback instead of a discarded review',async()=>{
 const value=covered();value.coverage.source1.quotes=['Guess the title if readable.'];const missing=story();missing.slides.forEach(s=>s.notes='Notify the coordinator.');const result=await reviewStoryEvidence(missing,brief,{...options,transport:async()=>response(value)});assert.equal(result.length,1);assert.equal(result[0].evidence,'Do not guess the title.');assert.match(result[0].problem,/could not locate/);
 assert.deepEqual(await reviewStoryEvidence(story(),brief,{...options,transport:async()=>response(covered())}),[]);
});

test('compatible planning sends the same selected model and an explicit JSON schema',async()=>{
 let request:any;await planCreation(brief,{}, {...options,settings:{...options.settings,provider:'compatible'},transport:async(url,init)=>{assert.match(String(url),/chat\/completions$/);request=JSON.parse(String(init?.body));return Response.json({choices:[{message:{content:JSON.stringify(plan())}}]});}});assert.equal(request.model,'chosen-model');assert.match(request.messages[0].content,/source2/);assert.match(request.messages[0].content,/additionalProperties/);
});

test('a knowledge check cannot silently turn into an answered summary',()=>{
 const value=story();value.slides[1].heading='Knowledge check';value.slides[1].points=[{heading:'No guessing',body:'Do not guess the title.'},{heading:'Coordinator',body:'Ask for help.'}];assert.throws(()=>validateStoryDesign(value,brief),/actual question/);assert.doesNotThrow(()=>validateStoryDesign(story(),brief));
});

test('native fit checks distinguish expanding text from clipped fixed text and detect real overlaps',async()=>{
 const base=await createAIBase('review'),value=applyOperations(base,await prepareStory(base,story()),0,'ai');assert.deepEqual(creationFitIssues(value),[]);const page=value.slides[1],texts=page.template!.slots!.map(s=>page.elements.find(e=>e.id===s.elementId)!).filter(e=>e.type==='text');
 texts[0].textSizing='fixed';texts[0].h=4;assert(creationFitIssues(value).some(i=>/may clip/.test(i)));texts[0].textSizing='auto-height';assert(!creationFitIssues(value).some(i=>/heading may clip/.test(i)));
 Object.assign(texts[1],{x:texts[0].x,y:texts[0].y});assert(creationFitIssues(value).some(i=>/overlaps/.test(i)));
});

test('cover discovery relaxes only the supplied subject and replacement preserves frame and attribution',async()=>{
 const base=await createAIBase('portfolio'),value=story();value.collection='portfolio';Object.assign(value.slides[0],{noImage:false,coverVisual:'illustration'});const ops=await prepareStory(base,value),cover=ops.find(o=>o.op==='add_slide')!;assert.equal(cover.op,'add_slide');if(cover.op!=='add_slide')return;
 const original=structuredClone(cover.slide.elements.find(e=>e.type==='image')!),queries:string[]=[],resource={...original.resource!,id:'fixture:reading',title:'Reading a book',kind:'illustration' as const};const services:EditingServices={searchResources:async p=>{queries.push(p.get('q')!);return {items:p.get('q')==='book'? [{...resource,previewUrl:'/local.svg'}]:[],page:1,hasMore:false};},importResource:async()=>({src:'data:image/svg+xml;base64,PHN2Zy8+',resource}),resourceCatalog:async()=>({})};
 const choices=await creationArtwork('book return',services);assert.deepEqual(queries,['book return','book']);assert.equal(choices[0].id,resource.id);await assert.rejects(()=>applyCreationArtwork(ops,'invented',choices,services),/supplied coverArtwork/);await applyCreationArtwork(ops,resource.id,choices,services);const frame=cover.slide.elements.find(e=>e.id===original.id)!;assert.deepEqual([frame.x,frame.y,frame.w,frame.h],[original.x,original.y,original.w,original.h]);assert.deepEqual(frame.resource,resource);
});

test('long list rows carry their separators when native text grows, including after canonical operations',async()=>{
 const base=await createAIBase('minimal'),value=story();value.collection='minimal';value.slides[1]={layout:'insights',heading:'Proposed · Investigate Conflict Handling for Offline Editing',density:'reading',points:[{heading:'Recommendation',body:'To ensure a smooth offline editing experience, the museum should first identify how to manage potential conflicts when records are edited offline and then synced back online.'},{heading:'Identify Conflict Resolution Policies',body:'Establish clear protocols for managing conflicts when syncing offline edits.'},{heading:'Set Performance Benchmarks',body:'Determine performance criteria for offline editing capabilities.'},{heading:'Clarify Data Ownership Roles',body:'Define who is responsible for reconciled data after offline edits.'}]};
 const deck=applyOperations(base,await prepareStory(base,value),0,'ai'),page=deck.slides[1];assert.deepEqual(creationFitIssues(deck),[]);const rules=page.elements.filter(e=>e.type==='line'&&e.y>=300).sort((a,b)=>a.y-b.y);assert.equal(rules.length,4);
 for(const [i,rule] of rules.entries()){const next=rules[i+1]?.y??736,texts=page.elements.filter(e=>e.type==='text'&&e.y>rule.y&&e.y<next&&!e.pageElement);assert(texts.length>=3);assert(texts.every(e=>e.y+e.h<=next-(i<3?10:0)),`Row ${i+1} must retain a readable gap before its next separator`);assert(texts.filter(e=>!/^\d{2}$/.test(e.text)).every(e=>e.fontSize>=24));}
 const body=page.elements.find(e=>e.type==='text'&&e.text.startsWith('To ensure'))!;rules[1].y=body.y+body.h-8;assert(creationFitIssues(deck).some(i=>/row separator/.test(i)));
});

test('limited observational sources do not acquire unsupported significance claims',async()=>{
 const {groundCreationClaims}=await import('../src/core/ai-story-quality'),value=story();value.slides=[{layout:'category-chart',heading:'新流程下完成取件人数显著提升',body:'新流程完成率80%显著高于旧流程65%。',chart:{...(await import('../src/core/charts')).sampleChart(),labels:['旧流程','新流程'],series:[{name:'完成取件人数',values:[26,32]}]}}];groundCreationClaims(value,{...brief,materials:'两组是不同用户，未随机分组，因此不能归因于设计。'});assert.equal(value.slides[0].heading,'完成取件人数: 26 → 32');assert(!value.slides[0].body?.includes('显著高于'));
});

test('refinement keeps a valid reviewable candidate when later repairs damage structure',async()=>{
 const base=await createAIBase('review'),before=JSON.stringify(base);let writes=0;
 const result=await runAI(base,brief.brief,{slideIds:base.slides.map(s=>s.id),elementIds:[]},{...options.settings,apiKey:'fixture'},{creation:brief,reviewEvidence:true,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body));if(['deck_creation_slide','deck_speaker_script'].includes(request.text.format.name))return Response.json({}, {status:503});if(request.text.format.name==='deck_creation_plan')return Response.json({}, {status:503});if(request.text.format.name==='deck_evidence_review'){const review=covered();review.coverage.source1.status='contradicted';review.coverage.source1.problem='Keep the restriction visible.';return response(review);}writes++;const draft=story();if(writes>1)draft.slides=[];return Response.json({output:[{type:'function_call',call_id:'story'+writes,name:'prepare_story',arguments:JSON.stringify(draft)}]});}});
 assert(!('kind' in result));if('kind' in result)return;assert.equal(writes,4);assert(result.reviewWarnings?.some(i=>/last valid draft/.test(i.problem)));assert(result.reviewWarnings?.some(i=>/restriction visible/.test(i.problem)));assert.equal(creationPreview(base,result,brief).slides.length,2);assert.equal(JSON.stringify(base),before);
});

test('explicit chart/table pages cannot be downgraded, but unnumbered prose does not invent an outline',async()=>{
 const {explicitCreationOutline,validateCreationOutline}=await import('../src/core/ai-creation-outline');
 const spec={...brief,brief:'Exactly two slides in this order: 1 completed request trend chart, 2 reopened counts in a readable table.'};assert.deepEqual(explicitCreationOutline(spec).map(p=>p.number),[1,2]);assert.throws(()=>validateCreationOutline(story(),spec),/native chart/);
 assert.equal(explicitCreationOutline({...brief,brief:'Compare 2 examples and 4 observations. Use 2 slides.'}).length,0);
 const zh={...brief,brief:'按这两页组织：1 完成人数对比图；2 证据局限。'};assert.equal(explicitCreationOutline(zh).length,2);assert.throws(()=>validateCreationOutline(story(),zh),/native chart/);
});

test('source retention preserves verbatim restrictions and long materials without replacing spoken notes',async()=>{
 const {retainPlannedSources}=await import('../server/ai-creation-sources'),value=story(),original=value.slides[0].notes!,planning=await planCreation(brief,{},options);planning.pages[0].sources=[{text:'Never record the return before coordinator review.',placement:'visible'}];retainPlannedSources(value,brief,planning);assert(value.slides[0].notes!.startsWith(original));assert(value.slides[0].notes!.includes('Source material:\nNever record the return before coordinator review.'));const once=JSON.stringify(value);retainPlannedSources(value,brief,planning);assert.equal(JSON.stringify(value),once);
 planning.pages[0].sources=[{text:'Supplied reference. '.repeat(500),placement:'notes'}];retainPlannedSources(value,brief,planning);assert.doesNotThrow(()=>StorySchema.parse(value));
});

test('separate chart attribution is retained in notes without breaking the chart layout',async()=>{
 const {authoredCreationStory}=await import('../src/core/ai-story-input'),base=await createAIBase('review'),value=story();(value.slides as any)[1]={layout:'category-chart',heading:'Compare observed counts',source:'Separate supplied limitations.',notes:'Different groups, no causal conclusion.',chart:{type:'column',labels:['Old','New'],series:[{name:'Completed',values:[26,32]}],source:'Supplied counts'}};const parsed=await authoredCreationStory(value,base);assert.match(parsed.slides[1].notes!,/Separate supplied limitations/);assert.equal(parsed.slides[1].source,undefined);await prepareStory(base,parsed);
});

test('four short workflow labels with wrapped descriptions try vertical layout before splitting the page',async()=>{
 const {createTemplatePages}=await import('../src/core/templates');const items:[string,string][]=[['1. Read the barcode',"Scan the book's barcode."],['2. Confirm the title','Check the title in the catalogue.'],['3. Inspect for damage','Look for any visible damages.'],['4. Record and shelve','Register the return and place it on the return shelf.']];
 for(const collection of ['portfolio','review','report'])assert.equal(createTemplatePages('process',2,collection,{heading:'Four-Step Return Workflow',body:'Follow these steps for processing returns!',items}).length,1);
});

test('narrative review can catch wrong closing order and parallel work drawn as a sequence',async()=>{
 const value=covered();value.narrative.requestedContent={slide:2,problem:'Put the requested decision on the final page.'};value.narrative.relationships={slide:1,problem:'Use parallel owners, not sequential process arrows.'};const result=await reviewStoryEvidence(story(),brief,{...options,transport:async()=>response(value)});assert.equal(result.length,2);assert.match(result[0].problem,/final page/);assert.match(result[1].problem,/parallel owners/);
});

test('measured summary heading size survives canonical style binding and does not collide with its subtitle',async()=>{
 const base=await createAIBase('minimal'),value=story();value.collection='minimal';value.slides[1]={layout:'summary',heading:'Security Measures for Data Management',body:'The local database uses nightly backups to an encrypted drive.',density:'reading',points:[{heading:'Backup System',body:'Nightly backups to an encrypted drive.'},{heading:'Access Control',body:'Only staff can edit.'}],notes:'The proposed backup job copies the database.'};const ops=await prepareStory(base,value),deck=applyOperations(base,ops,0,'ai');assert.deepEqual(creationFitIssues(deck),[]);const op=ops.filter(o=>o.op==='add_slide')[1];assert.equal(op.op,'add_slide');if(op.op==='add_slide'){const title=op.slide.elements.find(e=>e.name==='Slide heading')!;assert.equal(deck.slides[1].elements.find(e=>e.id===title.id)!.fontSize,title.fontSize);}
});

test('planned creation writes each page through a layout-specific schema before whole-deck review',async()=>{
 const base=await createAIBase('review');let pages=0,reviews=0;const result=await runAI(base,brief.brief,{slideIds:base.slides.map(s=>s.id),elementIds:[]},{...options.settings,apiKey:'fixture'},{creation:brief,reviewEvidence:true,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body));assert.equal(request.model,'chosen-model');if(request.text.format.name==='deck_creation_plan')return response(plan());if(request.text.format.name==='deck_creation_slide'){const input=JSON.parse(request.input[0].content);pages++;assert(request.text.format.schema.properties.layout.const===input.page.layout||request.text.format.schema.properties.layout.enum?.includes(input.page.layout));assert.equal(request.tools,undefined);return response({...story().slides[input.page.number-1],source:null,mirror:null,coverVisual:null});}if(request.text.format.name==='deck_creation_page_review'){reviews++;return response({issues:[]});}throw new Error('A complete planned draft should not fall back to unconstrained whole-story authoring.');}});assert(!('kind' in result));assert.equal(pages,2);assert.equal(reviews,2);assert.equal(base.slides.length,1);
});

test('page repair rewrites only the requested page and preserves every other authored page',async()=>{
 const {authorPlannedStory}=await import('../server/ai-creation-author'),planning=await planCreation(brief,{},options),draft={title:'Keep title',slides:story().slides},calls:number[]=[];
 const repaired=await authorPlannedStory(brief,planning,[],{...options,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body)),input=JSON.parse(request.input[0].content);calls.push(input.page.number);assert.equal(input.repair,'Slide 2: clarify the questions.');return response({...draft.slides[1],heading:'Two practical questions'});}},undefined,{draft,pages:[2],feedback:'Slide 2: clarify the questions.'});assert.deepEqual(calls,[2]);assert.deepEqual(repaired.slides[0],draft.slides[0]);assert.equal(repaired.title,'Keep title');assert.equal(repaired.slides[1].heading,'Two practical questions');
});

test('planned quiz placement survives a model changing the knowledge-check heading',async()=>{
 const {placeQuizAnswersInNotes}=await import('../src/core/ai-story-quality'),value=story();value.slides[1].heading='Critical return rules';value.slides[1].points![0].body='Never guess a title.';placeQuizAnswersInNotes(value,brief,[2]);assert.equal(value.slides[1].points![0].body,'');assert.match(value.slides[1].notes!,/Never guess a title/);
});

test('small architecture diagrams retain their real nodes instead of demanding invented services',async()=>{
 const {createTemplatePages}=await import('../src/core/templates');const pages=createTemplatePages('architecture',1,'minimal',{heading:'Local data access',items:[['App','Reads records'],['Database','Stores records']],block:{items:[{label:'App',meta:'',detail:'Reads records',parent:-1},{label:'Database',meta:'',detail:'Stores records',parent:0}]}});assert.equal(pages.length,1);assert.equal(pages[0].elements.filter(e=>e.type==='text'&&['App','Database'].includes(e.text)).length,2);
});

test('page review exposes diagram edges, removes source-reference notes, and rejects invented critique quotes',async()=>{
 const {reviewCreationPages}=await import('../server/ai-creation-review'),value=story();value.slides[0]={layout:'architecture',heading:'Data path',block:{items:[{label:'API',detail:'Requests',parent:-1},{label:'Database',detail:'Records',parent:0},{label:'Backup',detail:'Copies database',parent:0}]},notes:'Backups are controlled by the API.\n\nSource material:\nBackups copy the database.'};let input:any;const findings=await reviewCreationPages(value,{...brief,materials:'Backups copy the database.'},[],{...options,transport:async(_url,init)=>{const request=JSON.parse(String(init?.body));if(request.text.format.name==='deck_creation_review_proof')return response({finding1:{reason:'The diagram connects the wrong parent.',provenMismatch:true}});if(request.text.format.name==='deck_creation_review_verify')return response({finding1:{authoredMeaning:'The authored passage being checked.',speechAct:'fact',sourceMeaning:'The original material being compared.',supportQuote:'',status:'contradiction',sourceQuote:'Backups copy the database.',difference:'Source names the Database, not API.'}});const data=JSON.parse(request.input[0].content);if(data.pageNumber===1){input=data;return response({issues:[{verdict:'confirmed',authoredMeaning:'Backup is downstream of API.',sourceMeaning:'Backup copies the database.',kind:'relationship',authoredQuote:'API → Backup',sourceQuote:'Backups copy the database.',problem:'Connect Backup to Database, not API.'},{verdict:'confirmed',authoredMeaning:'Invented.',sourceMeaning:'Database.',kind:'unsupported',authoredQuote:'Invented phrase',sourceQuote:'Backups copy the database.',problem:'Ignore this ungrounded critique.'}]});}return response({issues:[]});}});assert.deepEqual(input.authored.connections,['API → Database','API → Backup']);assert.equal(input.authored.notes,'Backups are controlled by the API.');assert.equal(findings.length,1);assert.equal(findings[0].slide,1);assert.match(findings[0].problem,/Database/);
});

test('meta speaker instructions are rejected for cover and reading decks as well as presentation slides',()=>{
 for(const delivery of ['presentation','reading'] as const){const value=story();value.slides[0].notes='This cover slide introduces the return process.';assert.throws(()=>validateStoryDesign(value,{...brief,delivery}),/actual words to say/);}
});

test('long introductory copy fits deterministically while recommendations remain visible and source text stays intact',async()=>{
 const {compactCreationIntros}=await import('../src/core/ai-story-quality'),value=story();value.slides[0]={layout:'decision',heading:'Authorize a focused investigation',body:'Approve a focused investigation of reopening reasons and check category consistency before deciding whether service quality has improved.',points:[{heading:'Reasons',body:'Review existing records.'},{heading:'Timing',body:'To confirm.'}],notes:'We need authorization before making a claim.'};const original=value.slides[0].body!;compactCreationIntros(value);assert.equal(value.slides[0].layout,'insights');assert.equal(value.slides[0].body,undefined);assert.equal(value.slides[0].points![0].body,original);assert(value.slides[0].notes!.includes(original));const base=await createAIBase('review');const operations=await prepareStory(base,value);assert.equal(operations.filter(op=>op.op==='add_slide').length,2);
});

test('planning honors an explicitly illustrated cover and moves the final decision with its source assignment',async()=>{
 const spec={...brief,brief:'Use an illustrated cover. End with the decision.'},raw=plan();raw.pages.slide1.layout='decision';raw.pages.slide2.layout='statement';const value=await planCreation(spec,{}, {...options,transport:async()=>response(raw)});assert.equal(value.pages[0].layout,'cover');
 const p=plan();p.pages.slide1.layout='decision';p.pages.slide2.layout='statement';const ending=await planCreation({...brief,brief:'End with the decision.'},{},{...options,transport:async()=>response(p)});assert.equal(ending.pages[1].layout,'decision');assert.equal(ending.pages[1].sources.length,2);
});

test('native fitting reports all problematic pages in one repair request',async()=>{
 const base=await createAIBase('review'),value=story();value.slides=[{layout:'insights',heading:'A',body:'A long introduction. '.repeat(20),points:[{heading:'One',body:'Evidence'},{heading:'Two',body:'Evidence'}]},{layout:'insights',heading:'B',body:'Another long introduction. '.repeat(20),points:[{heading:'One',body:'Evidence'},{heading:'Two',body:'Evidence'}]}];await assert.rejects(()=>prepareStory(base,value),error=>{assert.match((error as Error).message,/Slide 1/);assert.match((error as Error).message,/Slide 2/);return true;});
});

test('an exact source assertion is not an unsupported claim and unchanged pages reuse the review',async()=>{
 const {reviewCreationPages}=await import('../server/ai-creation-review'),value=story(),reviewCache=new Map();let calls=0;
 const settings={...options,reviewCache,transport:async()=>{calls++;return response({issues:[{verdict:'confirmed',kind:'unsupported',authoredQuote:'Notify the coordinator.',authoredMeaning:'Notify the coordinator.',sourceQuote:'Notify the coordinator.',sourceMeaning:'Notify the coordinator.',problem:'This claim does not repeat the complete rule.'}]});}};
 assert.deepEqual(await reviewCreationPages(value,brief,[],settings),[]);assert.equal(calls,2);assert.deepEqual(await reviewCreationPages(value,brief,[],settings),[]);assert.equal(calls,2);
});

test('generated stage directions are removed without regenerating factual speaker notes',async()=>{
 const {normalizeCreationNotes}=await import('../src/core/ai-story-quality'),value=story();value.slides[0].notes='This cover slide introduces our process. Do not guess the title. Notify the coordinator.';normalizeCreationNotes(value);assert.equal(value.slides[0].notes,'Do not guess the title. Notify the coordinator.');value.slides[1].notes='This slide presents the quiz.';normalizeCreationNotes(value);assert(value.slides[1].notes!.includes('Can you guess a title?'));assert(!value.slides[1].notes!.includes('This slide'));
});

test('explicitly descriptive evidence cannot become a qualitative efficiency or demand claim',()=>{
 const spec={...brief,materials:'These are monthly aggregate counts and not a cohort. No measured causal explanation exists.'},value=story();value.slides[0].notes='This trend indicates a potential improvement in how requests are handled.';assert.throws(()=>validateStoryDesign(value,spec),/unmeasured cause or outcome/);value.slides[0].notes='Completed requests rose from 120 to 160; the cause is unknown.';assert.doesNotThrow(()=>validateStoryDesign(value,spec));value.slides[0].body='Monthly counts rose, indicating increased demand for services.';assert.throws(()=>validateStoryDesign(value,spec),/unmeasured cause or outcome/);
});

test('unmeasured causal claims are replaced by supplied limitations while numerical evidence remains unchanged',async()=>{
 const {groundCreationClaims}=await import('../src/core/ai-story-quality'),value=story(),spec={...brief,materials:'Completed requests rose from 120 to 160. No measured causal explanation exists.'};value.slides[0].notes='Completed requests rose from 120 to 160. This indicates increased operational capacity or demand.';groundCreationClaims(value,spec);assert.equal(value.slides[0].notes,'Completed requests rose from 120 to 160. No measured causal explanation exists.');const once=JSON.stringify(value);groundCreationClaims(value,spec);assert.equal(JSON.stringify(value),once);
});

test('negated and coordinated evidence limits do not trigger a causal-claim repair',()=>{
 const value=story(),spec={...brief,materials:'These are aggregate counts. No measured causal explanation exists.'};value.slides[0].body='The observations do not confirm causality or indicate service quality improvements.';assert.doesNotThrow(()=>validateStoryDesign(value,spec));value.slides[0].body='These observations do not indicate service quality improvements.';assert.doesNotThrow(()=>validateStoryDesign(value,spec));value.slides[0].body='The data does not establish causality, but it indicates improved service quality.';assert.throws(()=>validateStoryDesign(value,spec),/unmeasured cause or outcome/);
});


test('one supported finding uses a statement and proposed capabilities stay visibly proposed',async()=>{
 const {groundStructuredPages}=await import('../server/ai-creation-grounding'),value=story();value.slides[0]={layout:'insights',heading:'One finding',points:[{heading:'Fee timing is unclear',body:'Seven interviewees reported this issue.'}],notes:'Supporting context.'};value.slides[1]={layout:'comparison',heading:'Offline editing trade-offs',cells:[['Benefit','Risk'],['Availability','Conflicts']]};groundStructuredPages(value,{...brief,materials:'Offline editing is a proposal, not a shipped feature.'});assert.equal(value.slides[0].layout,'statement');assert.match(value.slides[0].body!,/Seven interviewees/);assert.equal(value.slides[1].heading,'Offline editing trade-offs');
});

test('a simple architecture path uses the wide canvas without shrinking responsibilities to tiny type',async()=>{
 const {groundStructuredPages}=await import('../server/ai-creation-grounding'),base=await createAIBase('minimal'),value=story();value.collection='minimal';value.slides[0]={layout:'architecture',heading:'Local data path',density:'reading',block:{layout:'auto',items:['Catalogue App','Local API','Database','Backup'].map((label,i)=>({label,detail:'Reads or writes the local catalogue records.',parent:i-1}))}};groundStructuredPages(value,{...brief,delivery:'reading'});assert.equal(value.slides[0].block!.layout,'auto');const ops=await prepareStory(base,value),op=ops.find(o=>o.op==='add_slide');assert(op?.op==='add_slide');const details=op.slide.elements.filter(e=>e.type==='text'&&e.text==='Reads or writes the local catalogue records.');assert.equal(details.length,4);assert(details.every(e=>e.fontSize>=20));const panels=op.slide.elements.filter(e=>e.name==='Panel').sort((a,b)=>a.x-b.x);assert.equal(panels.length,4);assert(panels.slice(1).every((p,i)=>p.x-panels[i].x-panels[i].w>=60));
});

test('an explicit chart request overrides a conflicting planned table before a page schema is selected',async()=>{
 const spec={...brief,brief:'Exactly two slides: 1 完成取件人数对比图，注明每组样本量；2 a readable table of observations.'},raw=plan();raw.pages.slide1.layout='comparison';raw.pages.slide2.layout='insights';const planned=await planCreation(spec,{}, {...options,transport:async()=>response(raw)});assert.equal(planned.pages[0].layout,'category-chart');assert.equal(planned.pages[1].layout,'table');assert.match(planned.pages[0].briefRequirement,/样本量/);
});

test('chart grounding shows supplied group sizes and never publishes an invented source path',async()=>{
 const {groundStructuredPages}=await import('../server/ai-creation-grounding'),value=story();value.slides[0]={layout:'category-chart',heading:'完成取件人数',chart:{...(await import('../src/core/charts')).sampleChart(),labels:['旧流程','新流程'],series:[{name:'完成',values:[26,32]}],source:'/data/success_rates'}};groundStructuredPages(value,{...brief,brief:'对比完成取件人数，注明每组样本量。',materials:'旧流程观察40位，26位完成；新流程观察40位，32位完成。'});assert.deepEqual(value.slides[0].chart!.labels,['旧流程 (n=40)','新流程 (n=40)']);assert.equal(value.slides[0].chart!.source,'用户提供的材料');
});


test('creation fit uses measured wrapped text instead of a conflicting heuristic',async()=>{
 const base=await createAIBase('review'),value=story();value.slides[1]={layout:'close',heading:'批准继续验证，不是全面上线。',body:'下一步提案：再开展一轮20位参与者的小规模验证，重点检查费用说明和取件码错误恢复；日期与负责人尚未确认。',notes:'保留原始范围。'};const deck=applyOperations(base,await prepareStory(base,value),0,'ai');let measurements=0;assert.deepEqual(creationFitIssues(deck,e=>{measurements++;return {w:e.w,h:e.h};}),[]);assert(measurements>0);assert(creationFitIssues(deck,e=>({w:e.w,h:e.text===value.slides[1].heading?e.h+170:e.h})).some(issue=>/overlaps/.test(issue)));
});
