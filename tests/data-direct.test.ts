import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cellsTsv,pasteCellRange,selectedCells,clearCellRange,resizeRowPair,cellBounds} from '../src/core/table-grid';
import {tablePresentation,tablePresetStyle} from '../src/core/table-appearance';
import {TableStyleSchema} from '../src/core/table-schema';
import {element,blankSlide,newDeck} from '../src/core/model';
import {fitTableElement} from '../src/core/table-fit';
import {sampleChart} from '../src/core/charts';
import {chartWithPointValue,draggedChartValue} from '../src/core/chart-drag';
import {renderChartSvg} from '../src/core/chart-render';
import {applyOperations} from '../src/core/operations';
import {buildHtml} from '../src/core/export';

test('range clipboard round-trips quotes, tabs, line breaks and empty cells without changing the source',()=>{
  const cells=[['A','B','C'],['a\tb','multi\nline',''],['"quoted"','plain','end']],range={anchor:{row:2,column:1},head:{row:1,column:0}},before=JSON.stringify(cells);
  assert.deepEqual(cellBounds(range),{top:1,bottom:2,left:0,right:1});const selected=selectedCells(cells,range),pasted=pasteCellRange([['']],cellsTsv(selected),{anchor:{row:0,column:0},head:{row:0,column:0}});
  assert.deepEqual(pasted.cells,selected);assert.equal(JSON.stringify(cells),before);
  assert.deepEqual(pasteCellRange([['old']],cellsTsv([['']]),{anchor:{row:0,column:0},head:{row:0,column:0}}).cells,[['']]);
  assert.deepEqual(clearCellRange([['A','B'],['short']],{anchor:{row:1,column:0},head:{row:1,column:1}}),[['A','B'],['','']]);
});
test('multi-cell paste tiles matching data and rejects incompatible/oversized edits atomically',()=>{
  const cells=[['a','b'],['c','d']],range={anchor:{row:0,column:0},head:{row:1,column:1}};
  assert.deepEqual(pasteCellRange(cells,'new',range).cells,[['new','new'],['new','new']]);
  assert.deepEqual(pasteCellRange(cells,'x\ty',range).cells,[['x','y'],['x','y']]);
  assert.throws(()=>pasteCellRange(cells,'1\t2\t3',range),/matching/);assert.throws(()=>pasteCellRange(cells,'x'.repeat(5001),range),/5,000/);assert.deepEqual(cells,[['a','b'],['c','d']]);
});
test('row height proportions preserve geometry and styles; content limits protect each adjacent row',async()=>{
  const e=element('table',{w:600,h:360,fontSize:20,fontFamily:'Arial',cells:[['Header','Value'],['Row','1'],['Next','2']],tableStyle:{...tablePresetStyle('banded'),rowHeights:[90,120,150]}}),p=tablePresentation(e);
  assert.deepEqual(p.heights,[.25,1/3,5/12]);assert.deepEqual(resizeRowPair([90,120,150],0,200,[55,60,50]),[150,60,150]);assert.deepEqual(resizeRowPair([90,120,150],0,-200,[55,60,50]),[55,155,150]);assert.throws(()=>TableStyleSchema.parse({rowHeights:[0]}));
  const fitted=fitTableElement({...e,tableFit:{minimumFontSize:12,padding:14}},()=>({w:10,h:25}));assert.equal(fitted.fontSize,20);
  const slide=blankSlide();slide.elements=[e];const deck=newDeck('Rows',[slide]),next=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{tableStyle:{...e.tableStyle,rowHeights:[120,90,150]}}}],0,'manual');assert.equal(next.revision,1);assert.equal(next.slides[0].elements[0].h,360);assert.deepEqual(next.slides[0].elements[0].cells,e.cells);
  const html=await(await buildHtml(next)).text();assert.ok(html.includes('tr.style.height=p.heights[i]*100'));assert.ok(html.includes('rowHeights'));
  const {buildPptx}=await import('../src/core/pptx-export'),JSZip=(await import('jszip')).default,zip=await JSZip.loadAsync(await buildPptx(next,false,async()=>({w:1,h:1}))),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  const exported=Array.from(xml.matchAll(/<a:tr h="(\d+)"/g),m=>Number(m[1]));assert.deepEqual(exported,[1143000,857250,1428750]);
});
test('axis and radial drags change only the targeted source value and respect the original scale',()=>{
  const chart={...sampleChart(),series:[{name:'Actual',values:[32,47,41,58]}]},axis={kind:'axis' as const,horizontal:false,min:0,max:80,pixelMin:400,pixelMax:0},point={series:0,category:2},before=JSON.stringify(chart);
  assert.equal(draggedChartValue(chart,point,axis,{x:50,y:200},{x:50,y:150}),51);assert.equal(draggedChartValue(chart,point,axis,{x:50,y:200},{x:50,y:150},true),42);assert.equal(draggedChartValue(chart,point,axis,{x:50,y:200},{x:50,y:10000}),0);
  const next=chartWithPointValue(chart,point,51);assert.deepEqual(next.series[0].values,[32,47,51,58]);assert.equal(JSON.stringify(chart),before);
  const radial={kind:'radial' as const,cx:100,cy:100,radius:80,total:178};assert.ok(draggedChartValue({...chart,type:'donut'},point,radial,{x:140,y:100},{x:160,y:100})>41);
  const stacked={...chart,stacked:true,series:[{name:'Base',values:[60,60,60,60]},{name:'Top',values:[10,10,10,10]}]};assert.equal(draggedChartValue(stacked,{series:1,category:0},axis,{x:0,y:200},{x:0,y:-400}),20);
});
test('editable SSR publishes real axis/radial geometry; readonly SVGs retain no drag metadata',()=>{
  for(const type of ['column','bar','line','area','pie','donut'] as const){const chart={...sampleChart(),type},e=element('chart',{chart,w:800,h:480}),svg=renderChartSvg(e,true),match=svg.match(/data-chart-drag="([^"]+)"/);assert.ok(match);const g=JSON.parse(match[1].replaceAll('&quot;','"'));
    if(type==='pie'||type==='donut'){assert.equal(g.kind,'radial');assert.ok(g.radius>0);}else{assert.equal(g.kind,'axis');assert.equal(g.horizontal,type==='bar');assert.ok(Number.isFinite(g.min)&&Number.isFinite(g.max)&&g.max>g.min);assert.notEqual(g.pixelMin,g.pixelMax);}
    assert.ok(!renderChartSvg(e).includes('data-chart-drag'));
  }
});
