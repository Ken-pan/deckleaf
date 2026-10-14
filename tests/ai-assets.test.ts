import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,type ResourceAttribution} from '../src/core/model';
import {editingToolkit,type EditingServices} from '../src/core/ai-tools';
import {applyOperations,ProposalSchema} from '../src/core/operations';
import {resourceOperation} from '../src/core/resources';
import {isRegionFill} from '../src/core/resource-purpose';
import {templateSignature} from '../src/core/template-ownership';
import {createAIBase} from '../src/core/ai-story-builder';
import {authoredTemplatePages,prepareTemplateUpdate} from '../src/core/ai-templates';
const resource=(id:string,kind:ResourceAttribution['kind']='illustration'):ResourceAttribution=>({id,kind,title:id,provider:'Fixture',creator:'Author',sourceUrl:'https://example.com/source',license:'CC0',licenseUrl:'https://example.com/license',attribution:'Author · CC0',attributionRequired:false,originalSha256:'a'.repeat(64),color:'#345678'});
const src=(value:string)=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>${value}</title></svg>`).toString('base64')}`;
const fixture=()=>{const s=blankSlide();s.groups=[{id:'group',name:'Artwork'}];s.elements=[element('image',{id:'icon',name:'Current icon',src:src('old'),resource:resource('iconify:lucide:circle','icon'),x:44,y:80,w:64,h:48,rotation:12,opacity:.7,group:'group',crop:{left:.1,top:.2,right:.1,bottom:.1},motionKey:'icon-motion'}),element('image',{id:'art',src:src('art'),resource:resource('blue-black:scene-13-review'),x:500,y:170,w:320,h:250}),element('image',{id:'locked',src:src('locked'),locked:true}),element('image',{id:'source',sourceRegion:{left:0,top:0,right:0,bottom:0},sourceId:'original-source'})];return newDeck('Assets',[s,blankSlide()]);};
const services=(calls:any[]=[]):EditingServices=>({resourceCatalog:async()=>({}),searchResources:async()=>({items:[],page:1,hasMore:false}),importResource:async input=>{calls.push(input);return {src:src(JSON.stringify(input)),resource:{...resource(input.id,input.id.startsWith('iconify:')?'icon':'illustration'),color:input.color,...(input.graphicRecipe?{graphicRecipe:input.graphicRecipe as any}:{})}};}});
const call=async(kit:ReturnType<typeof editingToolkit>,name:string,args:any={})=>{const tool=kit.tools.find(t=>t.name===name)!;return await tool.run(tool.schema.parse(args)) as any;};
const submit=async(kit:ReturnType<typeof editingToolkit>,recipe:any)=>ProposalSchema.parse(JSON.parse(JSON.stringify(await call(kit,'propose_prepared_edits',{baseRevision:recipe.baseRevision,summary:'Replace assets',recipeIds:[recipe.recipeId]}))));

test('asset discovery is scoped, bounded and byte-free with current family and source/lock recovery',async()=>{
 const deck=fixture(),kit=editingToolkit(async()=>deck,services()),found=await call(kit,'read_assets',{limit:2});assert.equal(found.baseRevision,0);assert.equal(found.total,4);assert.equal(found.nextOffset,2);assert.equal(found.items[0].search.iconSet,'lucide');assert.equal(found.items[1].search.collection,'blue-black');assert(!JSON.stringify(found).includes('base64'));
 const blocked=await call(kit,'read_assets',{offset:2});assert(blocked.items.every((e:any)=>!e.canReplace));assert.match(blocked.items[1].blocked,/source region/);
 const scoped=editingToolkit(async()=>deck,services(),{slideIds:[deck.slides[0].id],elementIds:['icon']});assert.equal((await call(scoped,'read_assets')).total,1);await assert.rejects(()=>call(scoped,'read_assets',{elementIds:['art']}),/scope/);await assert.rejects(()=>call(kit,'read_assets',{elementIds:['missing']}),/no longer exists/);
});

test('batch replacement preserves frames, identity, groups, motion, source hashes and attribution after JSON storage',async()=>{
 const deck=fixture(),before=JSON.stringify(deck),kit=editingToolkit(async()=>deck,services()),s=deck.slides[0],recipe=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'icon',resourceId:'iconify:lucide:rocket'},{slideId:s.id,elementId:'art',resourceId:'doodles:running',color:'#112233'}]});assert.equal(recipe.changes,2);assert(!JSON.stringify(recipe).includes('base64'));
 const proposal=await submit(kit,recipe),after=applyOperations(deck,proposal.operations,0,'ai');assert.equal(JSON.stringify(deck),before);
 for(const id of ['icon','art']){const old=s.elements.find(e=>e.id===id)!,next=after.slides[0].elements.find(e=>e.id===id)!;for(const key of ['id','x','y','w','h','rotation','opacity','group','motionKey'] as const)assert.deepEqual(next[key],old[key]);assert.equal(next.fit,'contain');assert.equal(next.resource!.originalSha256,'a'.repeat(64));assert.equal(next.resource!.license,'CC0');}
 assert.equal(after.slides[0].elements[0].crop,undefined);assert.deepEqual(after.slides[0].groups,s.groups);assert.deepEqual(after.slides[1],deck.slides[1]);assert.deepEqual(after.slides[0].elements[2],s.elements[2]);
});

test('replacement validation rejects stale, duplicate, locked, clipped and out-of-scope targets before loading',async()=>{
 const deck=fixture(),calls:any[]=[],kit=editingToolkit(async()=>deck,services(calls)),s=deck.slides[0],target={slideId:s.id,elementId:'icon',resourceId:'iconify:lucide:rocket'};
 await assert.rejects(()=>call(kit,'prepare_asset_replacements',{baseRevision:2,replacements:[target]}),/revision changed/);
 for(const elementId of ['locked','source','missing'])await assert.rejects(()=>call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[target,{...target,elementId}]}));
 await assert.rejects(()=>call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[target,target]}),/once/);
 await assert.rejects(()=>call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'icon',sourceSlideId:s.id,sourceElementId:'icon'}]}),/target itself/);
 const scoped=editingToolkit(async()=>deck,services(calls),{slideIds:[s.id],elementIds:['icon']});await assert.rejects(()=>call(scoped,'prepare_asset_replacements',{baseRevision:0,replacements:[{...target,elementId:'art'}]}),/scope/);assert.equal(calls.length,0);assert.equal(deck.revision,0);
});

test('current asset customization retains crop and graphic recipe; a new pattern fills the region without a stale crop',async()=>{
 const deck=fixture(),s=deck.slides[0],calls:any[]=[],kit=editingToolkit(async()=>deck,services(calls));s.elements[1].resource=resource('deck-graphics:fine-dots');s.elements[1].resource.graphicRecipe={strength:.8,scale:1.5,rotation:24};s.elements[1].fit='fill';
 const r=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'icon',color:'#556677'},{slideId:s.id,elementId:'art',graphic:{strength:1.2}}]});const next=applyOperations(deck,(await submit(kit,r)).operations,0,'ai');assert.deepEqual(next.slides[0].elements[0].crop,s.elements[0].crop);assert.deepEqual(calls[1].graphicRecipe,{strength:1.2,scale:1.5,rotation:24});assert(isRegionFill(next.slides[0].elements[1]));
 const newPattern=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'icon',resourceId:'deck-graphics:fine-dots',graphic:{scale:2}}]});const region=applyOperations(deck,(await submit(kit,newPattern)).operations,0,'ai').slides[0].elements[0];assert.equal(region.crop,undefined);assert.equal(region.aspectRatioLocked,false);assert(isRegionFill(region));assert.equal(region.w,s.elements[0].w);await assert.rejects(()=>call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'art',resourceId:'doodles:running',fit:'region'}]}),/Region fill requires/);
});

test('document artwork reuse clears prior attribution durably and preserves imported source identity',async()=>{
 const deck=fixture(),s=deck.slides[0];s.elements[0].sourceId='editable-import-id';s.elements[1].resource=undefined;const kit=editingToolkit(async()=>deck),r=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'icon',sourceSlideId:s.id,sourceElementId:'art'}]}),next=applyOperations(deck,(await submit(kit,r)).operations,0,'ai').slides[0].elements[0];assert.equal(next.src,s.elements[1].src);assert.equal(next.resource,undefined);assert.equal(next.crop,undefined);assert.equal(next.sourceId,'editable-import-id');
 const manual=JSON.parse(JSON.stringify(resourceOperation(deck,s.id,s.elements[1],'icon'))),manualNext=applyOperations(deck,[manual],0).slides[0].elements[0];assert.equal(manualNext.resource,undefined);assert.equal(manualNext.crop,undefined);
});

test('inherited artwork color retains theme binding and explicit local color unlinks only the fill role',async()=>{
 const deck=fixture(),s=deck.slides[0];s.elements[1].design={fill:'accent',stroke:'line'};const kit=editingToolkit(async()=>deck,services());const replace=async(color?:string)=>{const r=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:'art',resourceId:'doodles:running',color}]});return applyOperations(deck,(await submit(kit,r)).operations,0,'ai').slides[0].elements[1];};const inherited=await replace();assert.equal(inherited.design?.fill,'accent');assert.equal(inherited.design?.stroke,'line');const local=await replace('#445566');assert.equal(local.design?.fill,undefined);assert.equal(local.design?.stroke,'line');
});

test('native template replacement remains authored artwork through later template adaptation',async()=>{
 const base=await createAIBase('review'),s=(await authoredTemplatePages(base,'cover','review',{heading:'Supplied title',body:'Supplied context'}))[0],deck={...base,slides:[s]},art=s.elements.find(e=>e.type==='image')!;assert(art);const before=s.template!.generated!.find(e=>e.id===art.id)!.signature,kit=editingToolkit(async()=>deck,services()),r=await call(kit,'prepare_asset_replacements',{baseRevision:0,replacements:[{slideId:s.id,elementId:art.id,resourceId:'doodles:running'}]}),next=applyOperations(deck,(await submit(kit,r)).operations,0,'ai');assert.equal(next.slides[0].template!.generated!.find(e=>e.id===art.id)!.signature,before);assert.notEqual(templateSignature(next.slides[0].elements.find(e=>e.id===art.id)!),before);
 const update=await prepareTemplateUpdate(next,{slideId:s.id,density:'reading'}),adapted=applyOperations(next,update.operations,1,'ai');assert.equal(adapted.slides[0].elements.find(e=>e.id===art.id)?.resource?.id,'doodles:running');
});

test('search exposes native illustration/graphics/style filters and every match in a 64-icon page',async()=>{
 const deck=fixture(),params:URLSearchParams[]=[];const svc=services();svc.searchResources=async p=>{params.push(p);return {items:Array.from({length:64},(_,i)=>({...resource('icon-'+i,'icon'),previewUrl:'/preview'})),page:1,hasMore:false};};const kit=editingToolkit(async()=>deck,svc),ids:string[]=[];let offset:number|null=0;do{const page=await call(kit,'search_resources',{kind:'icon',query:'',style:'outline',offset,view:'illustrations',illustrationType:'spot',family:'grid'});ids.push(...page.items.map((r:any)=>r.id));offset=page.nextOffset;}while(offset!==null);assert.equal(new Set(ids).size,64);assert.equal(params[0].get('style'),'outline');assert.equal(params[0].get('view'),'illustrations');assert.equal(params[0].get('family'),'grid');
});

test('failed imports and stale recipes never yield a partial replacement proposal',async()=>{
 let deck=fixture();const before=JSON.stringify(deck),svc=services();svc.importResource=async()=>{throw new Error('Fixture unavailable');};const kit=editingToolkit(async()=>deck,svc),input={baseRevision:0,replacements:[{slideId:deck.slides[0].id,elementId:'icon',resourceId:'iconify:lucide:rocket'}]};await assert.rejects(()=>call(kit,'prepare_asset_replacements',input),/unavailable/);assert.equal(JSON.stringify(deck),before);
 const working=editingToolkit(async()=>deck,services()),r=await call(working,'prepare_asset_replacements',input);deck={...deck,revision:1};await assert.rejects(()=>submit(working,r),/changed/);assert.equal(deck.slides[0].elements[0].resource!.id,'iconify:lucide:circle');
});
