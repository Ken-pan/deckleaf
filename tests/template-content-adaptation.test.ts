import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIONS,createLayout,createTemplatePages,scaleTemplateSlide} from '../src/core/templates';
import {seedTemplateInput,templateInputPatch} from '../src/core/template-input';
import {newDeck,validateDeck,blankSlide} from '../src/core/model';
import {createDeckBlock,defaultBlockOptions,placeDeckBlock} from '../src/core/deck-blocks';
import {applyOperations} from '../src/core/operations';
import {applyDeckDesignSystem} from '../src/core/deck-design-system';
import {inlineTextLines,inlineTextWidth} from '../src/core/inline-text-width';

test('results pages replace sample claims with the actual edited chart, unit and attribution',async()=>{
 for(const c of COLLECTIONS){
  const original=createLayout('metrics',1,c.id),chart=original.elements.find(e=>e.chart)!.chart!,input=seedTemplateInput(c.id,'metrics',original),before=JSON.stringify(chart);
  input.heading='Our verified result';input.data='Period\tResolution time\nBefore\t0\nPilot\t25\nAfter\t34';input.unit=' min';input.source='Matched task records · October 2026';input.forecast='';
  const patch=await templateInputPatch('metrics',input,{},chart),pages=createTemplatePages('metrics',1,c.id,patch),edited=pages.flatMap(s=>s.elements).find(e=>e.chart)!.chart!;
  assert.deepEqual(edited.labels,['Before','Pilot','After']);assert.deepEqual(edited.series,[{name:'Resolution time',values:[0,25,34]}]);assert.equal(edited.source,input.source);
  const text=pages.flatMap(s=>s.elements).map(e=>e.text);for(const value of ['34 min','Resolution time',input.source])assert(text.includes(value));assert(!text.includes('68%'));assert(!text.some(t=>t.startsWith('Example target')));
  validateDeck(newDeck('Custom results',pages));assert.equal(JSON.stringify(chart),before);
 }
});
test('risk and evidence pages retain the descriptions, items and tables offered by their content editor',async()=>{
 for(const c of COLLECTIONS){
  const heading='Pilot release gates',body='Our plan records the remaining uncertainty and the checks needed before release.',items:[string,string][]=[['Access','Verify the permission paths'],['Data','Reconcile the pilot records']];
  const risks=createTemplatePages('risks',1,c.id,{heading,body,items}),text=risks.flatMap(s=>s.elements.map(e=>e.text)).join('\n');for(const value of [heading,body,...items.flat()])assert(text.includes(value));
  const evidence=createTemplatePages('evidence',1,c.id,{heading,body});assert(evidence.flatMap(s=>s.elements).some(e=>e.text===body));
 }
 const original=createLayout('evidence',1,'review'),input=seedTemplateInput('review','evidence',original);input.data='Task\tFinding\nOur supplied task\tOur supplied finding';input.source='Our research records';
 const patch=await templateInputPatch('evidence',input,{}),page=createTemplatePages('evidence',1,'review',patch)[0];assert.deepEqual(page.elements.find(e=>e.type==='table')!.cells,[['Task','Finding'],['Our supplied task','Our supplied finding']]);assert(page.elements.some(e=>e.text===input.source));
});
test('ordinary Chinese copy and longer English diagram and schedule content fit without dropping metadata',()=>{
 const description='团队确认输入、责任和交付标准，依据实际反馈安排下一步。',long='The team confirms the inputs, ownership and acceptance criteria, then uses the pilot findings to choose a practical next step.';
 for(const c of COLLECTIONS)for(const id of ['architecture','gantt','workstreams','hierarchy','funnel'] as const)for(const detail of [description,long]){
  const count=id==='hierarchy'?7:id==='architecture'?5:4,items:[string,string][]=Array.from({length:count},(_,i)=>[`自定义阶段${i+1}`,detail]),dates=Array.from({length:count},(_,i)=>id==='funnel'?String((count-i)*100):id==='workstreams'?`${i%3+1}–${Math.min(4,i%3+2)}`:`${i%5+1}–${Math.min(6,i%5+2)}`);
  const pages=createTemplatePages(id,1,c.id,{heading:'我们的交付计划',items,dates});validateDeck(newDeck('Adapted native blocks',pages));
  const recipes=pages.flatMap(s=>s.groups?.flatMap(g=>g.block?.options.items??[])??[]);assert.deepEqual(recipes.map(i=>i.label),items.map(i=>i[0]));assert(recipes.every(i=>i.detail===detail));if(['gantt','workstreams','funnel'].includes(id))assert.deepEqual(recipes.map(i=>i.meta),dates);
 }
});
test('long page introductions use a companion page while preserving the component and all supplied content',()=>{
 const body='The team examined the current workflow, compared the alternatives and tested a focused pilot. This account explains the evidence, the constraints and the next decision. Each section identifies an owner and a concrete acceptance condition.';
 for(const c of COLLECTIONS){const items:[string,string][]=[['Discovery','Confirm the tasks'],['Build','Verify the delivery'],['Release','Review the gates']],pages=createTemplatePages('gantt',1,c.id,{heading:'Our delivery plan',body,items,dates:['1–2','2–4','4–6'],source:'Our release records'});assert.equal(pages.length,2);assert(pages[0].elements.some(e=>e.text===body));assert(pages[1].groups?.some(g=>g.block?.kind==='gantt'));assert(!pages[1].elements.some(e=>e.text===body));for(const [label,detail] of items)for(const value of [label,detail])assert(pages[1].elements.some(e=>e.text===value));}
});
test('word-boundary fitting reserves the third line that a total-width estimate misses',()=>{
 const value='Team 4 confirms the inputs, ownership and acceptance criteria, then uses the pilot findings to choose a practical next step.';
 assert.equal(Math.ceil(inlineTextWidth(value,19,'Work Sans')/584),2);assert.equal(inlineTextLines(value,19,'Work Sans',584),3);
 assert.equal(inlineTextLines('中文示例\n另一行',20,'Work Sans',100),2);
});
test('placing a resized block preserves its typography scale through document restyling',()=>{
 const c=COLLECTIONS[0],deck=newDeck('Scaled block',[blankSlide()]);deck.designSystem=c.system;
 const block=createDeckBlock('process',defaultBlockOptions('process'),deck),placed=placeDeckBlock(block,{x:120,y:200,w:block.w*.6,h:block.h*.6},deck.slides[0].id),saved=applyOperations(deck,placed.operations),restyled=applyDeckDesignSystem(saved,c.system);
 for(const e of saved.slides[0].elements.filter(e=>e.type==='text'))assert(Math.abs(restyled.slides[0].elements.find(n=>n.id===e.id)!.fontSize-e.fontSize)<1e-9);
});
test('direct edits to native audience and discussion fields retain content in saved reading layouts',()=>{
 const body='Our team records the actual goals, constraints and acceptance conditions, then uses the pilot evidence to choose the next step.';
 for(const c of COLLECTIONS)for(const id of ['audience','q-and-a'] as const){
  const page=createLayout(id,1,c.id),deck=newDeck('Native field editing',[page]),before=JSON.stringify(page),targets=page.elements.filter(e=>e.type==='text'&&e.design?.text==='body'&&e.y>200),edited=applyOperations(deck,targets.map(e=>({op:'update_element' as const,slideId:page.id,elementId:e.id,patch:{text:body}})));
  const s=edited.slides[0];assert.equal(s.template?.variant,'reading-details');assert.equal(JSON.stringify(page),before);for(const e of targets)assert.equal(s.elements.find(n=>n.id===e.id)!.text,body);assert.equal(s.elements.length,page.elements.length);
  assert(s.autoLayouts?.some(l=>l.direction==='horizontal'&&l.textFitHeight));for(const l of s.autoLayouts??[])assert(l.x>=0&&l.y>=0&&l.x+l.w<=1440.001,`${c.id}/${id}/${l.name} stays in the page`);validateDeck(JSON.parse(JSON.stringify(edited)));
 }
});
test('native reading adaptation honors a smaller page coordinate space',()=>{
 for(const id of ['audience','q-and-a'] as const){const page=scaleTemplateSlide(createLayout(id,1,'portfolio'),720,405),deck={...newDeck('Small native fields',[page]),width:720,height:405};const targets=page.elements.filter(e=>e.type==='text'&&e.design?.text==='body'&&e.y>100),text='Our team records the actual goals, constraints and acceptance conditions, then uses the pilot evidence to choose the next step.';const edited=applyOperations(deck,targets.map(e=>({op:'update_element' as const,slideId:page.id,elementId:e.id,patch:{text}})));assert.equal(edited.slides[0].template?.variant,'reading-details');for(const l of edited.slides[0].autoLayouts??[])assert(l.x>=0&&l.x+l.w<=720.001&&l.y>=0&&l.y<=405);}
});
