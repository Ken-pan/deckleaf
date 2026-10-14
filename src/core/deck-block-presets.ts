import {defaultBlockOptions,blockSpec,type BlockId,type BlockOptions} from './deck-blocks';
import {delimitedRows} from './delimited-data';

const i=(label:string,detail='',meta='')=>({label,detail,meta});
function explicitParents(id:BlockId,items:BlockOptions['items']):BlockOptions['items'] {
  return items.map((item,index)=>({...item,...(['architecture','organization'].includes(id)?{parent:item.parent??(index>0?(id==='architecture'&&index>1?1:0):-1)}:{})}));
}
export function moveBlockItem(id:BlockId,items:BlockOptions['items'],index:number,step:number):BlockOptions['items'] {
  const source=explicitParents(id,items),indices=source.map((_,i)=>i);
  if(index<0||index>=source.length||index+step<0||index+step>=source.length)return source;
  const moved=indices.splice(index,1)[0];indices.splice(index+step,0,moved);
  return indices.map(i=>({...source[i],...(source[i].parent!==undefined?{parent:indices.indexOf(source[i].parent!)}:{})}));
}
export function duplicateBlockItem(id:BlockId,items:BlockOptions['items'],index:number):BlockOptions['items'] {
  const source=explicitParents(id,items).map(item=>({...item,...(item.parent!==undefined?{parent:item.parent>index?item.parent+1:item.parent}:{})}));
  if(index<0||index>=source.length)return source;
  source.splice(index+1,0,{...source[index]});return source;
}
export function removeBlockItem(id:BlockId,items:BlockOptions['items'],index:number):BlockOptions['items'] {
  return explicitParents(id,items).filter((_,i)=>i!==index).map(item=>{const next={...item};if(next.parent===index)next.parent=-1;else if(next.parent!==undefined&&next.parent>index)next.parent--;return next;});
}
type Preset={id:string;label:string;options:Partial<BlockOptions>};
const scenes:Record<BlockId,Preset>={
  architecture:{id:'platform',label:'Platform services',options:{title:'Platform architecture',layout:'horizontal',items:[i('Client apps','Web, mobile and partners'),i('Service layer','API contracts and routing'),i('Identity','Authentication and access'),i('Domain services','Business capabilities'),i('Data layer','Events and persistence')]}},
  process:{id:'journey',label:'Customer journey',options:{title:'Customer journey',items:[i('Discover','Find the right offering'),i('Evaluate','Compare options and evidence'),i('Start','Set up and experience value'),i('Return','Build a useful habit')]}},
  organization:{id:'delivery',label:'Delivery teams',options:{title:'Delivery ownership',layout:'grid',items:[i('Product','Priorities and outcomes'),i('Design','Research and experience'),i('Engineering','Implementation and reliability'),i('Operations','Launch and support')]}},
  agenda:{id:'workshop',label:'Workshop',options:{title:'Workshop agenda',items:[i('Frame the challenge','Agree on the question','09:00'),i('Explore','Generate and compare ideas','09:20'),i('Break','Pause and reflect','10:00'),i('Prototype','Make the preferred option tangible','10:15'),i('Commit','Assign decisions and next steps','11:00')]}},
  timeline:{id:'release',label:'Release milestones',options:{title:'Release plan',items:[i('Scope agreed','Confirm the release boundary','Oct 06'),i('Design reviewed','Resolve the critical questions','Oct 20'),i('Pilot ready','Validate with a focused group','Nov 03'),i('Release decision','Review evidence and launch gates','Nov 17')]}},
  roadmap:{id:'quarterly',label:'Quarterly priorities',options:{title:'Quarterly roadmap',items:[i('Foundation','Research\nCore workflows\nMeasurement','Q1'),i('Delivery','Pilot\nFeedback\nLaunch gates','Q2'),i('Growth','Adoption\nReliability\nExpansion','Q3'),i('Scale','Partnerships\nAutomation\nOptimization','Q4')]}},
  gantt:{id:'project',label:'12-period project',options:{title:'Project delivery',periods:12,items:[i('Discovery','Research team','1–3'),i('Design','Design team','3–6'),i('Build','Engineering','5–10'),i('Pilot','Cross-functional team','9–11'),i('Release','Operations','11–12')]}},
  kanban:{id:'review',label:'Review workflow',options:{title:'Design review',items:[i('Draft','Project brief\nInitial exploration'),i('In review','Prototype\nResearch summary'),i('Approved','Scope\nAcceptance criteria'),i('Released','Pilot\nDocumentation')]}},
  comparison:{id:'change',label:'Before and after',options:{title:'Before and after',items:[i('Before','Fragmented context\nUnclear ownership\nRepeated handoffs'),i('After','Shared task context\nNamed owners\nVisible completion')]}},
  swot:{id:'launch',label:'Launch assessment',options:{title:'Launch assessment',items:[i('Strengths','Clear use case\nEngaged pilot group'),i('Weaknesses','Limited release capacity\nEarly measurement'),i('Opportunities','Unmet needs\nPartner interest'),i('Threats','Adoption friction\nCompeting priorities')]}},
  metrics:{id:'delivery',label:'Delivery metrics',options:{title:'Delivery metrics',items:[i('Completion','Sample value · Replace with your data','68%'),i('Response time','Sample value · Replace with your data','6 min'),i('Quality','Sample value · Replace with your data','94%')]}},
  funnel:{id:'hiring',label:'Hiring stages',options:{title:'Hiring funnel',items:[i('Applications','Sample value · Replace with your data','120'),i('Screening','Sample value · Replace with your data','40'),i('Interviews','Sample value · Replace with your data','12'),i('Offers','Sample value · Replace with your data','3')]}},
};
export function blockPresets(id:BlockId):Preset[]{return [{id:'default',label:'Default',options:defaultBlockOptions(id)},scenes[id]];}
export function applyBlockPreset(id:BlockId,preset:string,current:BlockOptions):BlockOptions {
  const seed=blockPresets(id).find(p=>p.id===preset);if(!seed)return current;
  const {title,items,layout,periods,periodLabels}=seed.options;return {...current,...(title!==undefined?{title}:{}),...(layout?{layout}:{}),...(periods?{periods}:{}),...(periodLabels?{periodLabels}:{}),items:explicitParents(id,items??current.items)};
}
export function parseBlockItems(value:string,id:BlockId):BlockOptions['items'] {
  const rows=delimitedRows(value,'\t',false,12,3).rows,spec=blockSpec(id);
  if(rows.length<spec.min||rows.length>spec.max)throw new Error(`Enter ${spec.min}–${spec.max} items.`);
  if(rows.some(r=>!r[0]?.trim()))throw new Error('Give each item a label.');
  return explicitParents(id,rows.map(([label,detail='',meta=''])=>({label:label.trim(),detail,meta})));
}
