import type {TemplateContent} from './ai-templates';
import type {TemplateOptions} from './template-contracts';
import {templateContract} from './template-contracts';

export const itemLayouts=new Set(['content','insights','agenda','team','process','solution','timeline','summary','appendix','case-study','decision','risks']);
export const cellLayouts=new Set(['table','comparison','action-plan']);
export const chartLayouts=new Set(['category-chart','trend','composition','metrics']);
export const blockLayouts=new Set(['architecture','hierarchy','gantt','workstreams','kanban','swot','funnel','roadmap','dashboard']);
/** Authoring requirements describe real inputs, not a sample deck's content. */
export function authoredContract(layout:string){
 const native=templateContract(layout);
 const required=['heading',...(blockLayouts.has(layout)?['block.items']:itemLayouts.has(layout)?['items']:cellLayouts.has(layout)?['cells']:chartLayouts.has(layout)?['chart']:[]),...(layout==='timeline'?['dates']:[]),...(['quote','decision'].includes(layout)?['body']:[])];
 return {...native,required,optional:['notes','density',...(!required.includes('body')?['body']:[]),'source'],fallback:'Choose a compatible composition, move supporting detail into notes, or explicitly continue on another page. Never invent content to fill a layout.'};
}
export function authoredInputs(layout:string){
 const inputs=['heading'];
 if(blockLayouts.has(layout))inputs.push('block.items:[{label,detail,meta?,parent?}]');
 else if(itemLayouts.has(layout))inputs.push('items:[[heading,body]] (prepare_story uses points:[{heading,body}])');
 else if(cellLayouts.has(layout))inputs.push('cells: header + rows');
 else if(chartLayouts.has(layout))inputs.push('chart: actual values and source');
 if(layout==='timeline')inputs.push('dates: one actual date per item');
 if(['gantt','workstreams'].includes(layout))inputs.push('block.periodLabels; each item.meta is a 1-based inclusive range');
 if(['architecture','hierarchy'].includes(layout))inputs.push('parent on every node: -1 root or zero-based index; acyclic');
 if(['dashboard','funnel','roadmap'].includes(layout))inputs.push('meta on every item: supplied metric, stage value or owner/period');
 inputs.push('body?','source?','density?: presentation|reading');
 return inputs;
}
export function authoredRules(layout:string){
 return [
  ...(blockLayouts.has(layout)?['Use block instead of items/points/dates. All labels, details, values and relationships must be authored.']:[]),
  ...(layout==='swot'?['Exactly four items, ordered strengths, weaknesses, opportunities, threats.']:[]),
  ...(layout==='quote'?['heading is the actual quotation; body is required attribution.']:[]),
  ...(layout==='decision'?['body is the recommendation; items/points are its reasons.']:[]),
  ...(layout==='decision'?['When there are no supported reasons to enumerate, use close or statement for the decision. Costs, owners and dates are not required.']:[]),
  ...(layout==='cover'?['Author, date and imagery are optional. Omit them when not supplied or requested.']:[]),
  ...(layout==='split'?['Text-only until actual artwork is inserted with resource tools.']:[]),
  'Omitted source is never invented. Optional source without a visible slot is preserved in speaker notes.',
 ];
}
/** Semantic inputs cannot silently borrow a native template's sample values. */
export function authoredBlockOptions(layout:string,content:TemplateContent):Partial<TemplateOptions>{
 if(!blockLayouts.has(layout)){if(content.block)throw new Error(`Layout ${layout} does not accept block. Use its listed content inputs.`);return {};}
 const block=content.block;if(!block)throw new Error(`Layout ${layout} requires block.items with authored label/detail/meta/parent. Use list_templates for its input rules.`);
 if(content.items||content.dates)throw new Error('Use block.items only for this layout; do not also supply items/points or dates.');
 const counts=templateContract(layout).counts,max=counts.length?Math.max(...counts):12;
 if(block.items.length>max)throw new Error(`Layout ${layout} supports at most ${max} items per page. Split the content into explicit slides and preserve relationships.`);
 if(layout==='swot'&&block.items.length!==4)throw new Error('SWOT requires exactly four authored quadrants: strengths, weaknesses, opportunities, threats.');
 let autoLayout=block.layout;
 const tree=['architecture','hierarchy'].includes(layout),schedule=['gantt','workstreams'].includes(layout),meta=['dashboard','funnel','roadmap'].includes(layout);
 if(tree){
  for(const item of block.items)if(item.parent===undefined)throw new Error('Provide parent for every node: -1 for a root, otherwise its zero-based parent index. Relationships cannot be invented.');
  block.items.forEach((_,index)=>{const seen=new Set<number>();let at=index;while(at>=0){if(at>=block.items.length)throw new Error('Choose an existing parent node.');if(seen.has(at))throw new Error('A node cannot report to itself or its descendants.');seen.add(at);at=block.items[at].parent!;}});
  const depth=(i:number):number=>block.items[i].parent!<0?0:1+depth(block.items[i].parent!);
  if((!autoLayout||autoLayout==='auto')&&Math.max(...block.items.map((_,i)=>depth(i)))>=2)autoLayout='horizontal';
 }else if(block.items.some(i=>i.parent!==undefined))throw new Error('Only architecture/hierarchy accepts parent relationships.');
 if(schedule){
  if(!block.periodLabels)throw new Error('Supply actual block.periodLabels; schedule periods cannot be invented.');
  for(const item of block.items){const match=item.meta?.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/);if(!match||Number(match[1])<1||Number(match[2])<Number(match[1])||Number(match[2])>block.periodLabels.length)throw new Error(`Give every task a meta period range within 1–${block.periodLabels.length}, such as 1–2.`);}
 }else if(block.periodLabels)throw new Error('Only gantt/workstreams accepts periodLabels.');
 if(meta&&block.items.some(i=>!i.meta?.trim()))throw new Error(`Provide actual meta for every ${layout} item; sample values are unavailable.`);
 return {items:block.items.map(i=>[i.label,i.detail]),body:content.body??'',source:content.source??'',block:{items:block.items.map(i=>({...i,meta:i.meta??''})),...(autoLayout?{layout:autoLayout}:{}),...(schedule?{periodLabels:block.periodLabels,periods:block.periodLabels!.length}:{}),showMeta:schedule||meta,numbered:false}};
}
