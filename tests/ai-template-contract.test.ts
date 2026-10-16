import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AI_TEMPLATE_LAYOUTS} from '../src/core/ai-story';
import {authoredTemplatePages,readTemplate,prepareTemplateUpdate,templateCatalog} from '../src/core/ai-templates';
import {createAIBase} from '../src/core/ai-story-builder';
import {applyOperations} from '../src/core/operations';
import {blockLayouts} from '../src/core/ai-template-contract';
import {authoredFixture} from './helpers/ai-template-fixture';

for(const collection of ['portfolio','review','proposal','pitch','report','minimal'] as const)test(`${collection}: every advertised authored layout builds, reads and reflows without sample data`,async()=>{
 const base=await createAIBase(collection),catalog=await templateCatalog(collection);
 assert.deepEqual(catalog.layouts.filter(l=>l.authoredContent).map(l=>l.id).sort(),[...AI_TEMPLATE_LAYOUTS].sort());
 for(const layout of AI_TEMPLATE_LAYOUTS){
  try{
   const content=authoredFixture(layout),slides=await authoredTemplatePages(base,layout,collection,content,1,'Original notes');assert.equal(slides.length,1);
   const deck={...base,slides},read=readTemplate(slides[0]);assert(read.canReflow);assert.equal(read.content.heading,content.heading);
   if(content.items)assert.deepEqual(read.content.items,content.items);
   if(content.chart)assert.deepEqual(read.content.chart?.series,content.chart.series);
   if(content.cells)assert.deepEqual(read.content.cells,content.cells);
   if(blockLayouts.has(layout))assert.deepEqual(read.content.block?.items,content.block!.items);
   const changed=await prepareTemplateUpdate(deck,{slideId:slides[0].id,content:{heading:'Revised takeaway'},density:'reading'}),after=applyOperations(deck,changed.operations,deck.revision,'ai');
   const reread=readTemplate(after.slides[0]);assert.equal(reread.content.heading,'Revised takeaway');assert.equal(reread.content.density,'reading');
   if(content.block)assert.deepEqual(reread.content.block?.items,read.content.block?.items);
   assert(!after.slides[0].elements.some(e=>/Illustrative Atlas|Your name|Synthetic quotation|Pilot outcome/.test(e.text)));
   assert.deepEqual(deck.slides,slides);
  }catch(error){throw new Error(`${collection}/${layout}: ${(error as Error).message}`,{cause:error});}
 }
});

test('structured templates reject invented relationships, periods and values; live text is the reflow authority',async()=>{
 const base=await createAIBase('review');
 for(const [layout,block,message] of [
  ['architecture',{items:[{label:'A',detail:''},{label:'B',detail:''}]},/parent/],
  ['hierarchy',{items:[{label:'A',detail:'',parent:1},{label:'B',detail:'',parent:0}]},/descendants/],
  ['gantt',{items:[{label:'Task',detail:'Owner',meta:'1–2'}]},/periodLabels/],
  ['gantt',{items:[{label:'Task',detail:'Owner',meta:'2–4'}],periodLabels:['A','B']},/range/],
  ['dashboard',{items:[{label:'Value',detail:'Source'}]},/actual meta/],
  ['swot',{items:[{label:'S',detail:'A'}]},/four/],
 ] as const)await assert.rejects(()=>authoredTemplatePages(base,layout,'review',{heading:'Test',block}),message);
 const pages=await authoredTemplatePages(base,'architecture','review',authoredFixture('architecture'));
 const slide=pages[0],slot=slide.template!.slots!.find(s=>s.key==='block.items.1.detail')!;assert(slot);
 const deck=applyOperations({...base,slides:pages},[{op:'update_element',slideId:slide.id,elementId:slot.elementId,patch:{text:'Manually verified responsibility'}}],base.revision,'manual');
 const update=await prepareTemplateUpdate(deck,{slideId:slide.id,collection:'minimal'}),after=applyOperations(deck,update.operations,deck.revision,'ai');
 assert.equal(readTemplate(after.slides[0]).content.block!.items[1].detail,'Manually verified responsibility');
 assert.equal(readTemplate(after.slides[0]).content.block!.items[1].parent,0);
});

test('deep authored trees select a fitting horizontal composition without shortening the supplied content',async()=>{
 const base=await createAIBase('review');
 const block={items:[{label:'Intake',detail:'Receive request',parent:-1},{label:'Diagnosis',detail:'Assess repair',parent:0},{label:'Repair',detail:'Complete work',parent:1},{label:'Pickup',detail:'Return item',parent:2}]};
 const slides=await authoredTemplatePages(base,'architecture','review',{heading:'Service ownership',block});assert.equal(slides.length,1);const read=readTemplate(slides[0]);assert.equal(read.content.block?.layout,'horizontal');assert.deepEqual(read.content.block?.items,block.items);assert(slides[0].elements.some(e=>e.text==='Receive request'));
});

test('repeated metric copy binds the right semantic field rather than page counters or another item',async()=>{
 const base=await createAIBase('review'),pages=await authoredTemplatePages(base,'dashboard','review',{heading:'Repeated values',block:{items:[{label:'12',detail:'12',meta:'12'},{label:'12',detail:'12',meta:'12'}]}}),slide=pages[0];
 const meta=slide.template!.slots!.find(s=>s.key==='block.items.0.meta')!,label=slide.template!.slots!.find(s=>s.key==='block.items.0.label')!;
 assert.equal(slide.elements.find(e=>e.id===meta.elementId)!.design?.text,'heading');assert.notEqual(meta.elementId,label.elementId);assert(!slide.elements.find(e=>e.id===label.elementId)!.pageElement);
 const edited=applyOperations({...base,slides:pages},[{op:'update_element',slideId:slide.id,elementId:meta.elementId,patch:{text:'18'}}],0,'manual');
 const read=readTemplate(edited.slides[0]);assert.equal(read.content.block!.items[0].meta,'18');assert.equal(read.content.block!.items[0].label,'12');assert.equal(read.content.block!.items[1].meta,'12');
});
