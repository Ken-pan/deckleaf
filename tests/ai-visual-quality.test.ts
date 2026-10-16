import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAIBase,creationPreview} from '../src/core/ai-story-builder';
import {authoredTemplatePages} from '../src/core/ai-templates';
import {authoredFixture} from './helpers/ai-template-fixture';
import {reviewPresentation} from '../src/core/presentation-review';
import {CreationStorySchema} from '../src/core/ai-story-input';
import {chartOption} from '../src/core/chart-render';
import {element,blankSlide,newDeck} from '../src/core/model';
import {sampleChart} from '../src/core/charts';

test('projected schedule and dashboard retain readable semantic labels and prominent metrics',async()=>{
 const base=await createAIBase('review');
 for(const layout of ['gantt','workstreams','dashboard']){
  const content=authoredFixture(layout);content.block!.items.forEach((i,k)=>{i.label=['Intake','Diagnosis','Repair','Pickup'][k];i.detail=['Receive request','Confirm estimate','Complete the work','Return the item'][k];if(layout==='dashboard')i.meta=String(120-k*20);});
  const [slide]=await authoredTemplatePages(base,layout,'review',content,1,'Explain the supplied evidence.');
  const report=reviewPresentation({...base,slides:[slide]});assert.deepEqual(report.issues.filter(i=>i.code==='small-type'),[]);
  const fields=slide.template!.slots!.filter(s=>s.key.startsWith('block.')).map(s=>({key:s.key,e:slide.elements.find(e=>e.id===s.elementId)!}));
  assert(fields.every(({e})=>e.fontSize>=22));
  if(layout==='dashboard')assert(fields.filter(f=>f.key.endsWith('.meta')).every(({e})=>e.fontSize>=48));
 }
});

test('risk rows use the reading area while preserving paired responses and natural wrapping',async()=>{
 const base=await createAIBase('review'),[s]=await authoredTemplatePages(base,'risks','review',{heading:'Resolve risk before scaling',items:[['Unclear responsibility','Name an owner before each handoff.'],['Waiting without updates','Explain the next step and when to expect an update.'],['Unexpected costs','Confirm the estimate before work begins.']]});
 const labels=s.template!.slots!.filter(k=>/^items\.\d+\.heading$/.test(k.key)).map(k=>s.elements.find(e=>e.id===k.elementId)!);
 assert(labels.at(-1)!.y-labels[0].y>280);assert(labels.every(e=>e.w>=300&&e.fontSize>=28));
 for(let i=0;i<3;i++){const body=s.elements.find(e=>e.id===s.template!.slots!.find(k=>k.key===`items.${i}.body`)!.elementId)!;assert.equal(body.y,labels[i].y);assert(body.x>labels[i].x+labels[i].w);}
});

test('short presentation processes use connected steps; reading content keeps the list composition',async()=>{
 const base=await createAIBase('review'),content={heading:'From request to return',items:[['Request','Describe the problem.'],['Confirm','Agree the next step.'],['Return','Collect the repaired item.']] as [string,string][]};
 const [projected]=await authoredTemplatePages(base,'process','review',content),[reading]=await authoredTemplatePages(base,'process','review',{...content,density:'reading'});
 assert.equal(projected.groups!.find(g=>g.block)!.block!.options.layout,'auto');assert.equal(reading.groups!.find(g=>g.block)!.block!.options.layout,'vertical');
 const panels=projected.elements.filter(e=>e.name==='Panel');assert.equal(panels.length,3);assert.equal(panels[0].y,panels[2].y);assert(projected.elements.some(e=>e.name==='Connector'));
});

test('presentation review includes diagram, period and table type and creation repairs unreadable output',async()=>{
 const base=await createAIBase('review'),[slide]=await authoredTemplatePages(base,'gantt','review',authoredFixture('gantt'),1,'Explain periods');
 const slot=slide.template!.slots!.find(k=>k.key==='block.periodLabels.0')!;const period=slide.elements.find(e=>e.id===slot.elementId)!;period.fontSize=12;period.design!.textScale=12/base.designSystem!.typography[period.design!.text!].fontSize;
 const second=structuredClone(slide);second.id='another-slide';second.elements.forEach(e=>e.id+='-copy');second.template!.slots=[];
 const proposal={baseRevision:0,summary:'Draft',operations:[{op:'add_slide' as const,slide},{op:'add_slide' as const,slide:second},{op:'delete_slide' as const,slideId:base.slides[0].id}]};
 const brief={brief:'Present the plan',audience:'Project leads',slideCount:2,collection:'review' as const,materials:'',delivery:'presentation' as const};
 assert.throws(()=>creationPreview(base,proposal,brief),/Slide 1.*Discover|Slide 1.*small|Slide 1.*distance/);
 assert.doesNotThrow(()=>creationPreview(base,proposal,{...brief,delivery:'reading'}));
 const s=blankSlide();s.notes='Context';s.elements=[element('table',{cells:[['Task'],['Review']],fontSize:12}),element('text',{text:'A title outside the canvas',x:-50})];
 const report=reviewPresentation(newDeck('Review',[s]));assert(report.issues.some(i=>i.code==='small-type'));assert(report.issues.some(i=>i.code==='outside'));
});

test('schedule wire contracts separate period ranges from labels and chart legends have readable spacing',()=>{
 const base={title:'Plan',slides:[{layout:'cover',heading:'Pilot'},{layout:'gantt',heading:'Timing',block:{items:[{label:'Research',detail:'Research lead',meta:'1–2'}],periodLabels:['Week 1','Week 2']}}]};
 assert(CreationStorySchema.safeParse(base).success);const bad=structuredClone(base);bad.slides[1].block!.items[0].meta='Week 1–2';assert(!CreationStorySchema.safeParse(bad).success);
 const chart=element('chart',{w:1200,h:400,fontSize:26,chart:{...sampleChart(),type:'line',labels:['Jan','Feb'],series:[{name:'Completed requests',values:[120,145]},{name:'Reopened requests',values:[18,16]}]}});
 const legend=chartOption(chart).legend as {itemGap:number};assert(legend.itemGap>=26);
});


test('new native tables use aligned reading rows without changing authored cells',async()=>{
 const base=await createAIBase('report'),cells=[['Action','Owner','Due'],['Review handoffs','Operations','To confirm'],['Inspect reopened requests','Research','To confirm']];
 const [slide]=await authoredTemplatePages(base,'action-plan','report',{heading:'Confirm the next investigation',cells});
 const table=slide.elements.find(e=>e.type==='table')!;assert.deepEqual(table.cells,cells);assert.equal(table.tableStyle?.verticalAlign,'middle');assert.equal(table.tableStyle?.borders,'rows');assert(table.fontSize>=24);
});
