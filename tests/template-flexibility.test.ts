import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIONS,templateDeck,createTemplatePages,createLayout} from '../src/core/templates';
import {TEMPLATE_RECIPES,recipeTemplateDeck,templateTask,matchesTemplateSearch} from '../src/core/template-recipes';
import {seedTemplateInput,templateInputPatch,resetTemplateContent} from '../src/core/template-input';

test('purpose stories work in all six families and leave the 24-page default intact',()=>{
  for(const c of COLLECTIONS){
    assert.equal(templateDeck(c.id).slides.length,24);
    for(const r of TEMPLATE_RECIPES){const d=recipeTemplateDeck(c.id,r.id);assert.equal(d.slides.length,r.layouts.length);assert.equal(d.title,r.name);assert.equal(d.templateCollection,c.id);assert.equal(d.designSystem?.typography.title.fontFamily,c.system.typography.title.fontFamily);assert.deepEqual(d.slides.map(s=>s.template?.prototype),[...r.layouts]);assert.equal(d.slides.at(-1)?.template?.prototype,'close');assert(d.slides[0].elements.some(e=>e.text===r.name));const ids=d.slides.flatMap(s=>[s.id,...s.elements.map(e=>e.id)]);assert.equal(new Set(ids).size,ids.length);}
  }
  assert.equal(recipeTemplateDeck('portfolio','update').designSystem?.typography.title.fontFamily,'Work Sans');
});
test('custom content survives purpose switches and density or quantity changes without truncation',()=>{
  const items=Array.from({length:7},(_,i)=>['Point '+i,'Specific explanation '+i] as [string,string]);
  for(const c of COLLECTIONS){
    for(const count of [2,4]){const pages=createTemplatePages('insights',1,c.id,{heading:'User heading',items,count,density:'reading'});assert.equal(pages.length,Math.ceil(items.length/count));const text=pages.flatMap(s=>s.elements.map(e=>e.text)).join('\n');for(const [a,b] of items){assert(text.includes(a));assert(text.includes(b));}}
    for(const r of ['update','review']){const d=recipeTemplateDeck(c.id,r,{cover:{heading:'My exact heading',body:'My team · My date'}});assert(d.slides[0].elements.some(e=>e.text==='My exact heading'));assert(d.slides[0].elements.some(e=>e.text==='My team · My date'));}
  }
});
test('content drafts round-trip multiline items and reset only their content options',async()=>{
  const options={items:[['A','Line one\nLine two'],['B','One\ttab']] as [string,string][],count:2,mirror:true,noImage:true,density:'reading' as const};
  const slide=createLayout('content',1,'minimal',options),draft=seedTemplateInput('minimal','content',slide,options),patch=await templateInputPatch('content',draft,options);
  assert.deepEqual(patch.items,options.items);assert.equal(patch.heading,undefined);assert.deepEqual(resetTemplateContent({...options,heading:'Custom',source:'Evidence'}),{count:2,mirror:true,noImage:true,density:'reading'});
  const cover=recipeTemplateDeck('minimal','update').slides[0];assert.equal(seedTemplateInput('minimal','cover',cover).heading,'Work update');assert.equal(seedTemplateInput('minimal','cover',cover).body,'Project or team · Date');
});
test('table customization parses quoted CSV and repeated-header continuations preserve every cell',async()=>{
  const s=createLayout('table',1,'report'),draft=seedTemplateInput('report','table',s);draft.data='Region,Owner,Result,Period,Decision\n"East, coast",Maya,68%,Q3,Proceed\nWest,Noah,55%,Q3,Review\nNorth,Lee,62%,Q3,Proceed\nSouth,Ari,49%,Q3,Review\nCentral,Sky,71%,Q3,Proceed\nRemote,Mo,60%,Q3,Review\nPilot,Pat,65%,Q3,Proceed\nOther,Jo,52%,Q3,Review';draft.source='Illustrative regional results';const patch=await templateInputPatch('table',draft,{});assert.equal(patch.cells?.[1][0],'East, coast');const pages=createTemplatePages('table',1,'report',patch);const tables=pages.flatMap(s=>s.elements.filter(e=>e.type==='table'));assert.deepEqual(tables.map(e=>e.cells!.length-1),[4,4]);const rows=tables.flatMap(e=>e.cells!.slice(1));assert.deepEqual(rows,patch.cells!.slice(1));assert(tables.every(e=>e.cells![0].join('|')===patch.cells![0].join('|')));
});
test('chart data keeps zero, negative values, source, unit and explicit forecast semantics',async()=>{
  const slide=createLayout('trend',1,'pitch'),chart=slide.elements.find(e=>e.chart)!.chart!,draft=seedTemplateInput('pitch','trend',slide);draft.data='Period,Actual,Comparison\nApr,0,-5\nMay,20,10\nJun,35,15';draft.unit=' pp';draft.source='Supplied data';draft.forecast='2';const patch=await templateInputPatch('trend',draft,{},chart);assert.deepEqual(patch.chart?.series[0].values,[0,20,35]);assert.deepEqual(patch.chart?.series[1].values,[-5,10,15]);assert.equal(patch.chart?.forecastFrom,2);assert.equal(patch.chart?.source,'Supplied data');assert.equal(patch.chart?.suffix,' pp');assert.equal(patch.chart?.axisRange,undefined);
  assert.equal(patch.chart?.legend,true);const before=JSON.stringify(chart);draft.data='Period,Actual\nApr,\nMay,20';await assert.rejects(()=>templateInputPatch('trend',draft,{},chart),/Blank cells/);assert.equal(JSON.stringify(chart),before);
});
test('invalid timeline dates reject the entire draft and removing dates clears the override',async()=>{
  const options={items:[['A','First'],['B','Second']] as [string,string][],dates:['Oct 1','Oct 2']};const draft=seedTemplateInput('minimal','timeline',createLayout('timeline',1,'minimal',options),options);draft.dates='Only one';await assert.rejects(()=>templateInputPatch('timeline',draft,options),/one date/);assert.deepEqual(options.dates,['Oct 1','Oct 2']);draft.dates='';assert.equal((await templateInputPatch('timeline',draft,options)).dates,undefined);
});
test('layout tasks separate finding data, explanation and planning pages',()=>{assert.equal(templateTask('trend'),'data');assert.equal(templateTask('annotation'),'explain');assert.equal(templateTask('workstreams'),'plan');assert.equal(templateTask('cover'),'opening');});
test('task searches find Chinese aliases and partial words without editable matching table',()=>{
  const table={id:'table',name:'Comparison table',description:'Compare the alternatives'},metric={id:'metrics',name:'Results',description:'Support the outcome with an editable chart'};
  assert(matchesTemplateSearch(table,'table'));assert(!matchesTemplateSearch(metric,'table'));assert(matchesTemplateSearch(table,'表格'));assert(matchesTemplateSearch(table,'compar tab'));assert(matchesTemplateSearch(metric,'chart'));assert(!matchesTemplateSearch(table,'does not exist'));
});
test('custom table, comparison and action sources replace sample assertions in all six themes',()=>{
  for(const c of COLLECTIONS)for(const id of ['table','comparison','action-plan'] as const){const pages=createTemplatePages(id,1,c.id,{cells:[['Item','Value'],['Supplied','0']],source:'My supplied records'});for(const s of pages){assert(s.elements.some(e=>e.text==='My supplied records'));assert(!s.elements.some(e=>e.text==='Illustrative status report · Q3 2026 · Internal sample records'));assert(!s.elements.some(e=>e.text==='Recommendation: focused pilot · Compare the same criteria'));}}
});
test('a shorter chart clears an incompatible sample forecast but protects an explicit forecast choice',async()=>{
  const s=createLayout('trend',1,'minimal'),chart=s.elements.find(e=>e.chart)!.chart!,draft=seedTemplateInput('minimal','trend',s);draft.data='Month,Progress\nApr,0\nMay,20\nJun,35';assert.equal((await templateInputPatch('trend',draft,{},chart)).chart?.forecastFrom,undefined);await assert.rejects(()=>templateInputPatch('trend',draft,{chart},chart),/forecast/);
});
test('a table with replaced data and no source asks for attribution instead of asserting sample records',async()=>{const s=createLayout('table',1,'report'),draft=seedTemplateInput('report','table',s);draft.data='Item,Result\nProvided,12';const patch=await templateInputPatch('table',draft,{});const pages=createTemplatePages('table',1,'report',patch);assert(pages[0].elements.some(e=>e.text==='Add source, period, and definitions'));assert(!pages[0].elements.some(e=>e.text.includes('Internal sample records')));});

test('designed and editable structure choices retain distinct usable pages across all six families',()=>{
  for(const c of COLLECTIONS)for(const id of ['agenda','process','timeline','dashboard','team'] as const){
    const authored=createLayout(id,1,c.id,{structure:'designed'}),editable=createLayout(id,1,c.id,{structure:'block'});
    assert(!authored.groups?.some(g=>g.block),`${c.id}/${id} keeps its authored composition`);
    assert(editable.groups?.some(g=>g.block),`${c.id}/${id} offers a stored editable block`);
    assert(editable.elements.some(e=>e.type==='text'&&e.fontFamily===c.system.typography.heading.fontFamily));
  }
});

test('purpose stories seed relevant prompts while preserving explicitly supplied content',()=>{
  for(const c of COLLECTIONS){
    const decision=recipeTemplateDeck(c.id,'decision'),summary=decision.slides.find(s=>s.template?.prototype==='summary')!;
    const text=summary.elements.map(e=>e.text).join('\n');for(const label of ['Recommendation','Evidence','Approval needed'])assert(text.includes(label));
    assert(!text.includes('Reflection'));
    const items:[string,string][]=[['First','My first point'],['Second','My second point'],['Third','My third point']];
    const customized=recipeTemplateDeck(c.id,'decision',{summary:{heading:'My summary',items}}).slides.find(s=>s.template?.prototype==='summary')!;
    for(const value of ['My summary',...items.flat()])assert(customized.elements.some(e=>e.text===value));
  }
});
