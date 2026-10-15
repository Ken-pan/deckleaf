import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAIBase} from '../src/core/ai-story-builder';
import {authoredTemplatePages} from '../src/core/ai-templates';
import {newDeck,blankSlide,element,type ResourceAttribution} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {pageEditOperations} from '../src/core/ai-page-edits';
import {resolvePageRequest,validatePageRequest,usePageBatch} from '../src/core/ai-page-request';
import {editingToolkit,type EditingServices} from '../src/core/ai-tools';
import {proposeAI} from '../server/ai';
const services:EditingServices={resourceCatalog:async()=>({}),searchResources:async()=>({items:[],page:1,hasMore:false}),importResource:async({id,color})=>({src:'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path stroke="${color}" d="M0 0L20 20"/></svg>`).toString('base64'),resource:{id,color,kind:id.startsWith('iconify:')?'icon':'illustration',title:id,creator:'Fixture',provider:'Fixture',sourceUrl:'https://example.com/art',license:'CC0',licenseUrl:'https://example.com/license',attribution:'Fixture',attributionRequired:false} as ResourceAttribution})};
async function fixture(){const base=await createAIBase('review'),a=(await authoredTemplatePages(base,'insights','review',{heading:'Principles',items:[['A','Alpha'],['B','Beta'],['C','Gamma']]}))[0],b=(await authoredTemplatePages(base,'cover','review',{heading:'Artwork',body:'Keep the resource'}))[0],c=blankSlide();c.elements=[element('text',{id:'closing',text:'Finish'}),element('image',{id:'icon',src:'data:image/svg+xml;base64,PHN2Zy8+',resource:(await services.importResource({id:'iconify:lucide:move-right',color:'#ffffff'})).resource,x:1100,y:170,w:96,h:96})];return {...newDeck('Batch',[a,b,c,blankSlide()]),designSystem:base.designSystem};}

test('explicit page requirements resolve grouped numbers, preserve clauses and quoted copy',async()=>{
 const d=await fixture(),r=resolvePageRequest(d,'第1、2页：修改标题。第3页保持不变。标题改为「第4页不是目标」。');assert.deepEqual(r.pages.map(p=>p.number),[1,2]);assert.deepEqual(r.protectedIds,[d.slides[2].id]);
 const english=resolvePageRequest(d,'Change slides 1 and 2. Slide 3 unchanged.');assert.deepEqual(english.pages.map(p=>p.number),[1,2]);assert.deepEqual(english.protectedIds,[d.slides[2].id]);
 assert.deepEqual(resolvePageRequest(d,'第1到3页：调整正文。').pages.map(p=>p.number),[1,2,3]);
 assert.throws(()=>resolvePageRequest(d,'第9页改标题'),/does not exist/);
 assert.equal(resolvePageRequest(d,'第1、2页改标题。第3、4页全部保持不变，文档主题和素材不变。').structural,false);
 const reference=resolvePageRequest(d,'第3页使用第2页的插画替换当前图标。');assert.deepEqual(reference.pages.map(p=>p.number),[3]);assert.equal(reference.pages[0].replaceArtwork,true);
 assert.equal(usePageBatch('演示第1页，然后看第2页',resolvePageRequest(d,'演示第1页，然后看第2页')),false);
 assert.equal(usePageBatch('修改第1页图表和第2页表格',resolvePageRequest(d,'修改第1页图表和第2页表格')),false);
 const reflow=resolvePageRequest(d,'第2页调整reading密度，保留插画分组和动画，允许模板调整位置与尺寸。');assert.deepEqual(reflow.pages[0].preserveArtwork,['group','animation','motionKey']);
 const fixed=resolvePageRequest(d,'第2页插画只调色，位置、尺寸和分组不动。');assert.deepEqual(new Set(fixed.pages[0].preserveArtwork),new Set(['x','y','w','h','group']));
 const mixed='第2页调整reading密度，保留插画颜色，不得新增或更换图片，保留分组和动画。第1页副标题改为「选好模板，替换素材。」，当前插画、颜色和位置不变。',mixedRequest=resolvePageRequest(d,mixed);assert.equal(usePageBatch(mixed,mixedRequest),true);assert(mixedRequest.pages.every(p=>!p.replaceArtwork&&!p.styleArtwork));
 assert.equal(mixedRequest.pages[0].density,'reading');assert.equal(usePageBatch('第1页：调整标题位置。第2页：修改标题。',resolvePageRequest(d,'第1页：调整标题位置。第2页：修改标题。')),false);
});

test('unchanged layout and density update live text without regenerating artwork or frames',async()=>{
 const d=await fixture(),old=d.slides[1].elements.find(e=>e.type==='image')!,result=await pageEditOperations(d,{baseRevision:0,summary:'Text only',pages:[{number:2,heading:'New title',layout:'cover',density:'presentation',updates:[{elementId:old.id}]}]},services);
 assert.equal(result.operations.length,1);const after=applyOperations(d,result.operations,0,'ai');assert.deepEqual(after.slides[1].elements.find(e=>e.id===old.id),old);assert.equal(after.slides[1].template?.prototype,'cover');
});

test('native reflow retains modified artwork once with its original ID, resource, color and grouping',async()=>{
 const d=await fixture(),styled=await pageEditOperations(d,{baseRevision:0,summary:'Custom color',pages:[{number:2,assets:[{action:'style',color:'#135f87'}]}]},services),base=applyOperations(d,styled.operations,0,'ai'),old=base.slides[1].elements.find(e=>e.type==='image')!;
 const result=await pageEditOperations(base,{baseRevision:1,summary:'Reading reflow',pages:[{number:2,density:'reading',heading:'Reading title'}]},services),after=applyOperations(base,result.operations,1,'ai'),images=after.slides[1].elements.filter(e=>e.type==='image');
 assert.equal(images.length,1);assert.equal(images[0].id,old.id);assert.equal(images[0].src,old.src);assert.deepEqual(images[0].resource,old.resource);assert.equal(images[0].group,old.group);assert.deepEqual(images[0].animation,old.animation);assert.equal(after.slides[1].template?.density,'reading');assert.deepEqual(after.slides[0],base.slides[0]);
 validatePageRequest(base,{baseRevision:1,summary:'Reflow',operations:result.operations},resolvePageRequest(base,'第2页调整reading密度，标题改为「Reading title」，保留插画分组和动画，允许模板调整位置与尺寸。'));
});

test('split page submissions receive recoverable feedback and cannot silently choose a partial proposal',async()=>{
 const d=await fixture();let turn=0;const bodies:any[]=[];
 const transport:typeof fetch=async(_url,init)=>{const b=JSON.parse(init!.body as string);bodies.push(b);turn++;const batches=turn===1?[[{number:1,heading:'One'}],[{number:2,heading:'Two'}]]:[[{number:1,heading:'One'},{number:2,heading:'Two'}]];return Response.json({output:batches.map((pages,i)=>({type:'function_call',call_id:`split-${turn}-${i}`,name:'propose_page_edits',arguments:JSON.stringify({baseRevision:0,summary:'Batch',pages})}))});};
 const proposal=await proposeAI(d,'第1页标题改为「One」。第2页标题改为「Two」。第3、4页保持不变。',{slideIds:d.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture-key'},{transport,services});
 assert.equal(turn,2);assert.equal(bodies[0].parallel_tool_calls,false);assert.equal(bodies[1].input.filter((i:any)=>i.type==='function_call_output').length,2);assert.equal(bodies[1].tool_choice.name,'propose_page_edits');const after=applyOperations(d,proposal.operations,0,'ai');assert(after.slides[0].elements.some(e=>e.text==='One'));assert(after.slides[1].elements.some(e=>e.text==='Two'));assert.deepEqual(after.slides[2],d.slides[2]);
});

test('one numbered page batch combines text, native reflow, style-only artwork and icon replacement atomically',async()=>{
 const d=await fixture(),before=JSON.stringify(d),r=resolvePageRequest(d,'第1页：改成content版式，标题「Updated」，小标题「First」。第2页：插画仅调色为#135f87，不得换成另一张。第3页：将图标替换为不同的Lucide图标，颜色#ffffff。第4页保持不变。');
 const result=await pageEditOperations(d,{baseRevision:0,summary:'Complete batch',pages:[{number:1,layout:'content',heading:'Updated',items:[{heading:'First'}]},{number:2,assets:[{action:'style',color:'#135f87'}]},{number:3,assets:[{action:'replace',resourceId:'iconify:lucide:arrow-up-right',color:'#ffffff'}]}]},services),proposal={baseRevision:0,summary:'Complete',operations:result.operations};
 validatePageRequest(d,proposal,r);const next=applyOperations(d,result.operations,0,'ai');assert.equal(next.revision,1);assert.equal(JSON.stringify(d),before);assert.deepEqual(next.slides[3],d.slides[3]);assert.equal(next.slides[0].template?.prototype,'content');assert(next.slides[0].elements.some(e=>e.text==='Alpha'));assert.equal(next.slides[1].elements.find(e=>e.type==='image')!.resource?.id,d.slides[1].elements.find(e=>e.type==='image')!.resource?.id);assert.equal(next.slides[2].elements.find(e=>e.id==='icon')!.resource?.id,'iconify:lucide:arrow-up-right');assert.deepEqual(result.coverage.map(p=>p.number),[1,2,3]);
});

test('coverage validation rejects wrong pages, omitted text and unauthorized artwork swaps',async()=>{
 const d=await fixture(),r=resolvePageRequest(d,'第1页标题改成「Needed」。第2页插画仅调色为#135f87，素材不能更换。第3、4页保持不变。');
 const p=(operations:any[])=>({baseRevision:0,summary:'Fixture',operations});
 assert.throws(()=>validatePageRequest(d,p([{op:'update_element',slideId:d.slides[2].id,elementId:'closing',patch:{text:'Wrong'}}]),r),/not requested/);
 const title=d.slides[0].template!.slots!.find(s=>s.key==='heading')!.elementId,art=d.slides[1].elements.find(e=>e.type==='image')!;
 assert.throws(()=>validatePageRequest(d,p([{op:'update_element',slideId:d.slides[0].id,elementId:title,patch:{text:'Needed'}}]),r),/requested artwork color/);
 assert.throws(()=>validatePageRequest(d,p([{op:'update_element',slideId:d.slides[0].id,elementId:title,patch:{text:'Needed'}},{op:'update_element',slideId:d.slides[1].id,elementId:art.id,patch:{resource:{...art.resource,id:'blue-black:different',color:'#135f87'}}}]),r),/replacement was not requested/);
 const swapped=await pageEditOperations(d,{baseRevision:0,summary:'Wrong',pages:[{number:1,heading:'Other'},{number:2,assets:[{action:'style',color:'#135f87'}]}]},services);assert.throws(()=>validatePageRequest(d,p(swapped.operations),r),/missing requested text/);
 const missedReflow=await pageEditOperations(d,{baseRevision:0,summary:'Missed',pages:[{number:2,heading:'New title'}]},services);assert.throws(()=>validatePageRequest(d,p(missedReflow.operations),resolvePageRequest(d,'第2页调整reading密度，标题改为「New title」。')),/needs density:reading/);
});

test('model template batches use subtitle slots and preserve unrequested template defaults and notes',async()=>{
 const d=await fixture();d.slides[0].notes='Keep first notes';d.slides[1].notes='Keep second notes';let body:any;
 const transport:typeof fetch=async(_url,init)=>{body=JSON.parse(init!.body as string);return Response.json({output:[{type:'function_call',call_id:'semantic',name:'propose_page_edits',arguments:JSON.stringify({baseRevision:0,summary:'Copy only',pages:[{number:1,heading:'New principles',layout:'content',density:'reading',notes:''},{number:2,body:'New subtitle',layout:'statement',density:'reading',notes:''}]})}]});};
 const proposal=await proposeAI(d,'第1页标题改为「New principles」。第2页副标题改为「New subtitle」。第3、4页保持不变。',{slideIds:d.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture-key'},{transport,services});
 const pageWire=body.tools.find((t:any)=>t.name==='propose_page_edits').parameters.properties.pages.items;const schema=pageWire.anyOf.find((s:any)=>s.properties.number.enum.includes(2));assert.equal(schema.properties.updates,undefined);assert(schema.properties.body.anyOf[0].description?.includes('副标题')||JSON.stringify(schema.properties.body).includes('副标题'));
 const after=applyOperations(d,proposal.operations,0,'ai');for(const i of [0,1]){assert.equal(after.slides[i].notes,d.slides[i].notes);assert.deepEqual(after.slides[i].template,d.slides[i].template);assert.deepEqual(after.slides[i].elements.filter(e=>e.type==='image'),d.slides[i].elements.filter(e=>e.type==='image'));}assert(after.slides[1].elements.some(e=>e.text==='New subtitle'));
});

test('style action cannot select different artwork and batches bind to current revision and unique numbers',async()=>{
 const d=await fixture();await assert.rejects(()=>pageEditOperations(d,{baseRevision:0,summary:'No swap',pages:[{number:2,assets:[{action:'style',resourceId:'blue-black:other',color:'#135f87'}]}]},services),/style must keep/);
 await assert.rejects(()=>pageEditOperations(d,{baseRevision:1,summary:'Stale',pages:[{number:1,heading:'Wrong'}]},services),/document changed/);
 await assert.rejects(()=>pageEditOperations(d,{baseRevision:0,summary:'Duplicate',pages:[{number:1,heading:'A'},{number:1,body:'B'}]},services),/each page number once/);
 const kit=editingToolkit(async()=>d,services,{slideIds:[d.slides[0].id],elementIds:[]});await assert.rejects(()=>kit.tools.find(t=>t.name==='propose_page_edits')!.run({baseRevision:0,summary:'Outside',pages:[{number:2,heading:'Wrong'}]}),/scope/);
});

test('real model loop repairs missing page coverage using one batch without competing recipe submission',async()=>{
 const d=await fixture();let turn=0;const bodies:any[]=[];
 const transport:typeof fetch=async(_url,init)=>{const b=JSON.parse(init!.body as string);bodies.push(b);const pages=++turn===1?[{number:1,heading:'Needed'}]:[{number:1,heading:'Needed'},{number:2,heading:'Artwork updated'}];return Response.json({output:[{type:'function_call',call_id:'batch-'+turn,name:'propose_page_edits',arguments:JSON.stringify({baseRevision:0,summary:'Batch',pages})}]});};
 const proposal=await proposeAI(d,'第1页标题改为「Needed」。第2页标题改为「Artwork updated」。第3、4页保持不变。',{slideIds:d.slides.map(s=>s.id),elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture-key'},{transport,services});
 assert.equal(turn,2);assert(JSON.stringify(bodies[1].input).includes('missing requested text'));assert(bodies[0].tools.some((t:any)=>t.name==='propose_page_edits'));assert(!bodies[0].tools.some((t:any)=>t.name==='propose_updates'));const after=applyOperations(d,proposal.operations,0,'ai');assert(after.slides[1].elements.some(e=>e.text==='Artwork updated'));assert.deepEqual(after.slides[2],d.slides[2]);
});
