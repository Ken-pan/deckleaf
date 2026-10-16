import {sampleChart} from '../../src/core/charts';
import {itemLayouts,cellLayouts,chartLayouts,blockLayouts} from '../../src/core/ai-template-contract';
import type {TemplateContent} from '../../src/core/ai-templates';
export function authoredFixture(layout:string):TemplateContent {
 const content:TemplateContent={heading:`Authored ${layout}`,source:'Supplied test record'};
 if(blockLayouts.has(layout))content.block={items:Array.from({length:layout==='roadmap'?3:4},(_,i)=>({label:`Node ${i+1}`,detail:`Detail ${i+1}`,...(['architecture','hierarchy'].includes(layout)?{parent:i===0?-1:0}:{}),...(['gantt','workstreams'].includes(layout)?{meta:i%2?'2–3':'1–2'}:['funnel','dashboard','roadmap'].includes(layout)?{meta:`${i+1} supplied`}:{})})),...(['gantt','workstreams'].includes(layout)?{periodLabels:['Discover','Build','Review']}: {})};
 else if(itemLayouts.has(layout))content.items=Array.from({length:layout==='decision'?2:3},(_,i)=>[`Point ${i+1}`,`Detail ${i+1}`]);
 else if(cellLayouts.has(layout))content.cells=[['Task','Owner','Due'],['Review','Design','Oct 20'],['Test','Research','Oct 23']];
 else if(chartLayouts.has(layout))content.chart={...sampleChart(),type:layout==='trend'?'line':layout==='composition'?'donut':'bar',labels:['A','B','C'],series:[{name:'Actual',values:[10,20,30]}],source:content.source!,suffix:'',forecastFrom:undefined};
 else content.body=layout==='quote'?'Named participant, supplied record':'Authored supporting context';
 if(layout==='decision')content.body='Approve the test';
 if(layout==='timeline')content.dates=['Oct 20','Oct 23','Oct 26'];
 return content;
}
