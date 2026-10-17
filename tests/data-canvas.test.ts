import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck} from '../src/core/model';
import {tablePresentation,tablePresetStyle} from '../src/core/table-appearance';
import {resizeTableColumns,resizeColumnWidths,tableColumnStyle} from '../src/core/table-columns';
import {chartPointFromRender} from '../src/core/chart-points';
import {sampleChart} from '../src/core/charts';
import {renderChartSvg} from '../src/core/chart-render';
import {applyOperations} from '../src/core/operations';

test('column resizing changes one adjacent pair, retains width/data/appearance and enforces usable limits',()=>{
  const legacy=element('table',{w:720,cells:[['Item','Value','Status'],['Report','$1,250','Ready']],fill:'#234536',stroke:'transparent'}),before=JSON.stringify(legacy),p=tablePresentation(legacy);
  const widths=resizeTableColumns(legacy,0,60);assert.deepEqual(widths,[300,180,240]);assert.equal(widths.reduce((a,b)=>a+b,0),720);
  const changed={...legacy,tableStyle:tableColumnStyle(legacy,widths)};
  assert.deepEqual({...tablePresentation(changed),widths:p.widths},p);assert.equal(JSON.stringify(legacy),before);
  const clamped=resizeTableColumns(legacy,0,10000);assert.ok(clamped[1]>=24);assert.equal(clamped[0]+clamped[1],480);assert.equal(clamped[2],240);
  assert.throws(()=>resizeTableColumns(legacy,2,40),/boundary/);assert.throws(()=>resizeTableColumns(legacy,0,NaN),/boundary/);
  const styled={...legacy,tableStyle:{...tablePresetStyle('contrast'),headerFill:'#123456',columnWidths:[2,1,1]}};
  assert.deepEqual(tableColumnStyle(styled,resizeTableColumns(styled,1,-20)),{...styled.tableStyle,columnWidths:[360,160,200]});
});
test('column resize is one atomic reversible document operation without changing table geometry or cells',()=>{
  const table=element('table',{cells:[['A','B'],['1','2']],tableStyle:tablePresetStyle('editorial')}),slide=blankSlide();slide.elements=[table];const deck=newDeck('Resize',[slide]);
  const next=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:table.id,patch:{tableStyle:tableColumnStyle(table,resizeTableColumns(table,0,40))}}],0,'manual');
  assert.equal(next.revision,1);assert.equal(next.slides[0].elements[0].w,table.w);assert.equal(next.slides[0].elements[0].h,table.h);assert.deepEqual(next.slides[0].elements[0].cells,table.cells);assert.equal(deck.revision,0);
});
test('rendered chart hit indices map back to the chosen pie and split forecast source series',()=>{
  const chart={...sampleChart(),series:[{name:'Actual',values:[1,2,3,4]},{name:'Plan',values:[5,6,7,8]}]};
  assert.deepEqual(chartPointFromRender(chart,1,2),{series:1,category:2});assert.equal(chartPointFromRender(chart,2,0),null);
  assert.deepEqual(chartPointFromRender({...chart,type:'donut',pieSeries:1},0,3),{series:1,category:3});assert.equal(chartPointFromRender({...chart,type:'pie',pieSeries:1},1,0),null);
  assert.deepEqual(chartPointFromRender({...chart,type:'line',forecastFrom:2},3,3),{series:1,category:3});assert.equal(chartPointFromRender(chart,0,4),null);assert.equal(chartPointFromRender(chart,-1,0),null);
});
test('bar/pie/minimal-line points have source identities only in interactive canvas renders',()=>{
  for(const type of ['column','bar','pie','donut','line','area'] as const){
    const chart={...sampleChart(),type,visual:{...sampleChart().visual,pointSize:0}},e=element('chart',{chart,w:800,h:480,fill:chart.colors[0]});
    const before=JSON.stringify(e),plain=renderChartSvg(e),editable=renderChartSvg(e,true);
    assert.ok(!plain.includes('data-chart-point'));assert.ok(editable.includes('data-chart-category="2"'));assert.ok(editable.includes('data-chart-point="true"'));assert.ok(editable.includes('aria-label="Series 1 · Q3: 41"'));
    if(type==='line'||type==='area')assert.ok(editable.includes('data-chart-line-hit="true"'));
    assert.equal(JSON.stringify(e),before);assert.equal(renderChartSvg(e),plain);
  }
});

test('resizing an imported narrow column preserves its current minimum without jumping',()=>{
 const widths=[10,100,90];assert.deepEqual(resizeColumnWidths(widths,0,0,40),widths);assert.deepEqual(resizeColumnWidths(widths,0,4,40),[14,96,90]);assert.deepEqual(resizeColumnWidths(widths,0,-4,40),widths);assert.deepEqual(resizeColumnWidths(widths,0,200,40),[70,40,90]);assert.deepEqual(widths,[10,100,90]);
});
