import {templateDeck,type LayoutId} from './templates';
import type {TemplateOptions} from './template-contracts';

export const TEMPLATE_RECIPES = [
  {id:'update',name:'Work update',hint:'Progress, evidence, issues and next actions',layouts:['cover','summary','dashboard','trend','risks','action-plan','decision','close']},
  {id:'decision',name:'Decision brief',hint:'A focused recommendation and its tradeoffs',layouts:['cover','summary','comparison','risks','decision','close']},
  {id:'review',name:'Project review',hint:'Context, evidence, alternatives and a decision',layouts:['cover','agenda','facts','annotation','before-after','comparison','metrics','action-plan','decision','close']},
  {id:'proposal',name:'Business proposal',hint:'Problem, approach, scope, proof and delivery',layouts:['cover','summary','problem','solution','facts','case-study','comparison','workstreams','decision','close']},
  {id:'product',name:'Product introduction',hint:'Audience, value, workflow and next steps',layouts:['cover','audience','problem','solution','split','annotation','metrics','roadmap','close']},
  {id:'delivery',name:'Delivery plan',hint:'Architecture, milestones, work periods and ownership',layouts:['cover','agenda','architecture','hierarchy','timeline','gantt','kanban','action-plan','close']},
  {id:'case',name:'Case study',hint:'Challenge, evidence, design choices and outcomes',layouts:['cover','facts','problem','quote','annotation','before-after','case-study','metrics','close']},
] as const satisfies readonly {id:string;name:string;hint:string;layouts:readonly LayoutId[]}[];
export type TemplateRecipeId = typeof TEMPLATE_RECIPES[number]['id'];
const PURPOSE_HEADINGS:Record<TemplateRecipeId,Record<string,string>>={
  update:{summary:'Progress and\nnext steps',dashboard:'Four signals from the period',trend:'Progress against the target',risks:'Issues and dependencies','action-plan':'Actions for the next period',decision:'The decision we need'},
  decision:{summary:'The case\nfor this choice',comparison:'Compare the viable options',risks:'Tradeoffs and mitigations',decision:'Recommendation and approval'},
  review:{agenda:'Review agenda',facts:'Context and constraints',annotation:'Evidence behind the decision','before-after':'What changed',comparison:'Alternatives we considered',metrics:'Results against the goal','action-plan':'What we will do next',decision:'The next decision'},
  proposal:{summary:'Proposal\nat a glance',problem:'The problem worth solving',solution:'Our proposed approach',facts:'Scope, team, and timing','case-study':'Relevant proof',comparison:'Options and tradeoffs',workstreams:'Delivery and ownership',decision:'Approve the next step'},
  product:{audience:'Who this helps',problem:'The job to be done',solution:'How the product helps',split:'The experience at a glance',annotation:'A closer look at the workflow',metrics:'Value and evidence',roadmap:'What comes next'},
  delivery:{agenda:'Delivery agenda',architecture:'System and dependencies',hierarchy:'Team and ownership',timeline:'Milestones and acceptance',gantt:'Work periods and dependencies',kanban:'Track delivery status','action-plan':'Next actions and owners'},
  case:{facts:'Context, role, and scope',problem:'The challenge',quote:'A voice from the research',annotation:'Evidence that shaped the work','before-after':'Before and after','case-study':'The design in practice',metrics:'What changed'},
};
const PURPOSE_FIELDS:Partial<Record<TemplateRecipeId,Record<string,[string,string][]>>>={
  update:{summary:[['Progress','What changed this period'],['Evidence','The result and its source'],['Next action','Who will do what, and when']]},
  decision:{summary:[['Recommendation','The choice you recommend'],['Evidence','Why this option is justified'],['Approval needed','The decision and its deadline']]},
  review:{agenda:[['Context','Goals and constraints'],['Evidence','Findings and alternatives'],['Decision','The next step and its owner']]},
  proposal:{summary:[['Problem','The outcome that needs to change'],['Approach','How the proposal addresses it'],['Delivery','Scope, ownership, and timing']]},
  delivery:{agenda:[['System','Architecture and dependencies'],['Plan','Milestones and work periods'],['Ownership','Responsible teams and next actions']]},
};

export function recipeTemplateDeck(collection:string,recipe:string,options:Record<string,TemplateOptions>={}) {
  const chosen=TEMPLATE_RECIPES.find(r=>r.id===recipe);
  if(!chosen)return templateDeck(collection,options);
  const seeds:Record<string,TemplateOptions>={cover:{heading:chosen.name,body:'Project or team · Date'},close:{heading:recipe==='case'?'What we learned.':'Next steps.',body:recipe==='case'?'Name the lesson to carry into the next project.':'Name the action, its owner, and the date.'}};
  for(const [id,heading] of Object.entries(PURPOSE_HEADINGS[chosen.id]))seeds[id]={heading,...(PURPOSE_FIELDS[chosen.id]?.[id]?{items:PURPOSE_FIELDS[chosen.id]![id]}:{})};
  const merged=Object.fromEntries([...new Set([...Object.keys(seeds),...Object.keys(options)])].map(id=>[id,{...seeds[id],...options[id]}]));
  return {...templateDeck(collection,merged,false,chosen.layouts),title:chosen.name};
}

export const TEMPLATE_TASKS=[
  {id:'all',name:'All tasks'},
  {id:'opening',name:'Open and summarize'},
  {id:'explain',name:'Explain and show'},
  {id:'data',name:'Data and evidence'},
  {id:'plan',name:'Plan and decide'},
] as const;
export function templateTask(id:string):string {
  if(['cover','agenda','summary','section','statement','close','q-and-a','freeform'].includes(id))return 'opening';
  if(['metrics','dashboard','category-chart','trend','composition','table','comparison','quote'].includes(id))return 'data';
  if(['gantt','kanban','swot','timeline','roadmap','workstreams','matrix','hierarchy','team','risks','decision','action-plan'].includes(id))return 'plan';
  return 'explain';
}

const searchAliases:Record<string,string>={architecture:'system architecture 架构图 系统 服务',gantt:'project schedule gantt 甘特 排期 日程规划',kanban:'board tasks status 看板 任务',swot:'strategy assessment 优势 劣势 机会 威胁',funnel:'conversion stages 漏斗 转化',cover:'封面',summary:'摘要 结论',content:'正文 内容',insights:'要点 特性',split:'photo text 图文',gallery:'photos images 图片 展示',annotation:'screenshot callouts 截图 标注',quote:'quotation research 引用 证言',metrics:'chart number result 指标 数字 结果',dashboard:'指标 总览 仪表盘','category-chart':'bar chart 类别 柱状 条形图',trend:'chart change 趋势 折线',composition:'pie donut 占比 构成 饼图',table:'spreadsheet 明细 表格',comparison:'compare options tradeoff 对比 方案',timeline:'schedule dates 时间线 里程碑',workstreams:'roadmap schedule gantt 路线图 甘特 工作流',decision:'recommendation 决策 建议','action-plan':'行动 计划',appendix:'sources references 附录 来源'};
/** Word-prefix matching keeps a search for table from matching editable chart. */
export function matchesTemplateSearch(layout:{id:string;name:string;description:string},query:string):boolean {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return true;
  const words=[layout.id,layout.name,layout.description,searchAliases[layout.id]??''].join(' ').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
  return terms.every(term=>words.some(word=>word.startsWith(term)));
}
