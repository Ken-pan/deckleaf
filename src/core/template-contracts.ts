import type {BlockOptions} from './deck-block-schema';
import type {Chart} from './chart-schema';
export type TemplateOptions={structure?:'designed'|'block';density?:'presentation'|'reading';count?:number;mirror?:boolean;noImage?:boolean;coverVisual?:'illustration'|'photo';imageFit?:'contain'|'cover';imageShape?:'landscape'|'portrait';heading?:string;body?:string;items?:[string,string][];dates?:string[];itemOffset?:number;cells?:string[][];chart?:Chart;chartTheme?:'theme'|'local';source?:string;block?:Partial<BlockOptions>};
export type TemplateContract={task:string;required:string[];optional:string[];counts:number[];variants:string[];fallback:string;capacity:string};
export const DEFAULT_DASHBOARD_ITEMS:[string,string][]=[
 ['Completion','68%\nTarget 70% · +26 pp · Below target'],
 ['Active use','62%\nTarget 65% · +7 pp · Below target'],
 ['Response time','6 min\nTarget ≤7 min · −3 min · Met target'],
 ['Quality','94%\nTarget 95% · +4 pp · Below target'],
 ['Availability','98%\nTarget 100% · −2 pp · Below target'],
 ['Satisfaction','86%\nTarget 90% · +6 pp · Below target'],
];
const contract=(task:string,required:string[],counts:number[],capacity:string,variants=['presentation','reading'],optional=['source','context']):TemplateContract=>({task,required,optional,counts,capacity,variants,fallback:'Use a reading layout or continue on another slide; preserve all content.'});
export const TEMPLATE_CONTRACTS:Record<string,TemplateContract>={
 architecture:contract('Explain a system',['clients','services','responsibilities'],[2,3,4,5,6],'2–6 nodes with explicit connections'),
 gantt:contract('Schedule delivery',['tasks','owners','periods'],[3,4,5,6],'3–6 tasks over 2–12 periods'),
 kanban:contract('Track work by status',['status','tasks'],[2,3,4],'2–4 work states'),
 swot:contract('Assess a direction',['strengths','weaknesses','opportunities','threats'],[4],'4 named quadrants'),
 funnel:contract('Explain conversion stages',['stages','values','context'],[3,4,5],'3–5 stages with explicit values'),
 cover:contract('Introduce a subject',['heading','author','date'],[],'1–2 title lines',['image','no-image'],['subtitle','image']),
 agenda:contract('Orient the audience',['heading','items'],[3,4,5,6],'3–6 chapters'),
 summary:contract('Summarize the conclusion',['heading','conclusion','evidence','implication','decision'],[3],'1 conclusion + 3 points'),
 risks:contract('Plan for uncertainty',['risks','responses'],[2,3,4],'2–4 risks with explicit responses'),
 section:contract('Introduce a chapter',['heading','chapter'],[],'1 chapter',['standard'],['introduction']),
 close:contract('Prompt one next action',['heading','action','contact'],[],'1 action',['action','discussion']),
 statement:contract('Emphasize one idea',['heading'],[],'1 idea + 0–2 lines',['standard'],['explanation']),
 content:contract('Explain a subject',['heading','items'],[3,4,5],'3–5 points'),
 insights:contract('Present parallel information',['heading','items'],[2,3,4],'2–4 items'),
 team:contract('Explain ownership',['heading','items'],[2,3,4],'2–4 roles'),
 split:contract('Explain a visual',['heading','body','image'],[],'1 visual + context',['image-right','image-left','no-image']),
 gallery:contract('Show visual work',['heading','images','captions'],[1,2,3,4],'1–4 visuals',['landscape','portrait','contain']),
 annotation:contract('Explain a screenshot',['heading','screenshot','callouts'],[2,3,4],'1 screenshot + 2–4 callouts'),
 quote:contract('Preserve a voice',['quotation','speaker','source'],[],'Short or reading-length quotation'),
 metrics:contract('Explain one result',['metric','unit','baseline','period','source'],[],'1 primary metric'),
 dashboard:contract('Compare performance signals',['metrics','targets','changes','status'],[3,4,5,6],'3–6 metrics'),
 'category-chart':contract('Compare category values',['chart','unit','source'],[3,4,5,6,7,8],'3–8 categories',['full-width','long-labels']),
 trend:contract('Show change over time',['chart','period','source'],[1,2,3],'1–3 series',['actual','forecast']),
 composition:contract('Explain parts of a whole',['chart','total','source'],[2,3,4,5],'2–5 parts',['donut','pie']),
 table:contract('Present precise detail',['cells','source'],[4,6,8],'4–8 data rows, 3–5 columns'),
 comparison:contract('Evaluate equal criteria',['options','criteria','values','recommendation'],[2,3],'2–3 options, 3–5 criteria'),
 process:contract('Explain a sequence',['steps','outputs'],[3,4,5,6],'3–6 steps'),
 solution:contract('Explain a value chain',['steps','outputs'],[3,4,5,6],'3–6 stages'),
 timeline:contract('Place events in time',['dates','events'],[4,5,6,7],'4–7 dated events'),
 workstreams:contract('Plan parallel work',['periods','workstreams','status','dependencies'],[3,4],'3–4 streams × 3–4 periods'),
 matrix:contract('Explain priority',['axes','objects','rationale'],[4,5,6,7,8],'4–8 objects'),
 hierarchy:contract('Explain parent-child relationships',['nodes','relationships'],[4,5,6,7,8],'4–8 nodes, 2–3 levels'),
 'before-after':contract('Show a consistent change',['before','after','changes'],[2,3],'1 pair + 2–3 changes'),
 'case-study':contract('Connect action with proof',['challenge','action','result','evidence'],[3,4],'1 case, 3–4 logical blocks'),
 decision:contract('Request a decision',['recommendation','reasons','cost','risk','owner'],[2,3],'1 decision + 2–3 reasons'),
 'action-plan':contract('Assign actionable work',['actions','owners','dates','doneCriteria'],[3,4,5],'3–5 actions'),
 appendix:contract('Document methods and sources',['heading','method','references'],[3,4,5],'Continuable references'),
 freeform:contract('Provide an editable foundation',['heading'],[],'Theme, margins and optional title/source',['title','no-title']),
};
export function templateContract(id:string):TemplateContract{return TEMPLATE_CONTRACTS[id]??contract('Explain context',['heading','items'],[3],'3 points');}
export const CORE_PROTOTYPES=Object.keys(TEMPLATE_CONTRACTS).filter(id=>!['team','solution'].includes(id));

export const editableTemplateItems=(id:string)=>['architecture','gantt','kanban','swot','funnel','roadmap','workstreams','hierarchy','summary','content','agenda','insights','team','process','solution','timeline','annotation','gallery','appendix','case-study','decision','dashboard','risks'].includes(id);
export const editableTemplateBody=(id:string)=>!['facts','audience','metrics','q-and-a'].includes(id);

export function defaultTemplateCount(id:string):number{return ({architecture:5,gantt:4,kanban:3,swot:4,funnel:4,timeline:4,dashboard:4,gallery:3,table:4,'category-chart':8,composition:4,trend:1,matrix:6,hierarchy:7,'case-study':4} as Record<string,number>)[id]??3;}
