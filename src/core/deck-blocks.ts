import {blockFingerprint} from './block-fingerprint';
export {blockFingerprint} from './block-fingerprint';
import { element, uid, type Deck, type Slide, type SlideElement, type SlideGroup } from './model';
import { deckDesignSystem, styledElement, contrastRatio } from './deck-design-system';
import type { ColorRole, TextRole } from './design-system-schema';
import type { Bounds } from './interactions';
import type { Operation } from './operations';
import {descendants,groupBox,ancestorIds} from './container-tree';
import {browserTextSize} from './text-layout';
import {inlineTextLines} from './inline-text-width';

export {BLOCK_IDS,BlockOptionsSchema,type BlockId,type BlockOptions,type BlockInput} from './deck-block-schema';
import {BLOCK_IDS,BlockOptionsSchema,type BlockId,type BlockOptions,type BlockInput} from './deck-block-schema';
export const BLOCK_CATEGORIES = ['All','Diagrams','Planning','Business'] as const;
export type BlockCategory=typeof BLOCK_CATEGORIES[number];
export type DeckBlock={id:BlockId;name:string;w:number;h:number;elements:SlideElement[];group:SlideGroup;fitIssues:string[]};
type BlockSpec = {id: BlockId; label: string; category: Exclude<BlockCategory, 'All'>; description: string; aliases: string; min: number; max: number; fields: [string, string, string?]; items: BlockOptions['items']};
const item = (label: string, detail = '', meta = '') => ({label, detail, meta});
export const DECK_BLOCKS: readonly BlockSpec[] = [
  {id:'architecture',label:'Architecture',category:'Diagrams',description:'Layers, services and connections',aliases:'system software cloud API 架构图 系统',min:4,max:10,fields:['Service','Responsibility'],items:[item('Web & mobile','User experience'),item('API gateway','Routing & authentication'),item('Identity','Access control'),item('Core services','Business logic'),item('Data platform','Storage & analytics')]},
  {id:'process',label:'Process flow',category:'Diagrams',description:'A sequence of steps',aliases:'workflow steps flowchart 流程图 步骤',min:2,max:8,fields:['Step','Description'],items:[item('Discover','Understand the problem'),item('Define','Align on the approach'),item('Design','Explore and test'),item('Deliver','Build and measure')]},
  {id:'organization',label:'Org chart',category:'Diagrams',description:'Teams and reporting lines',aliases:'organization hierarchy tree 组织架构 团队',min:3,max:10,fields:['Team or person','Role'],items:[item('Project lead','Direction & decisions'),item('Design','Research & experience'),item('Engineering','Build & quality'),item('Operations','Launch & support')]},
  {id:'agenda',label:'Agenda',category:'Planning',description:'A timed meeting or event schedule',aliases:'schedule meeting workshop calendar 日程 议程 会议 规划',min:2,max:12,fields:['Session','Purpose','Time'],items:[item('Welcome','Goals and introductions','09:00'),item('Context','What we know so far','09:15'),item('Working session','Explore ideas together','09:45'),item('Next steps','Decisions and owners','10:30')]},
  {id:'timeline',label:'Timeline',category:'Planning',description:'Milestones along a shared timeline',aliases:'milestone history release 时间线 里程碑',min:2,max:8,fields:['Milestone','Outcome','Date'],items:[item('Kickoff','Align the team','Week 1'),item('Prototype','Validate the approach','Week 2'),item('Build','Deliver the core','Week 4'),item('Launch','Learn from users','Week 6')]},
  {id:'roadmap',label:'Roadmap',category:'Planning',description:'Now, next and later priorities',aliases:'strategy priorities plan 路线图 计划 优先级',min:2,max:6,fields:['Phase','Priorities','Timing'],items:[item('Now','Research\nDefine scope\nValidate needs','This month'),item('Next','Prototype\nBuild the core\nRun a pilot','Next quarter'),item('Later','Launch widely\nMeasure results\nExpand coverage','Future')]},
  {id:'gantt',label:'Gantt plan',category:'Planning',description:'Tasks and overlapping work periods',aliases:'project schedule gantt 甘特图 项目 排期 日程规划',min:2,max:12,fields:['Task','Owner','Periods (e.g. 1–2)'],items:[item('Research','Design','1–2'),item('Prototype','Design','2–3'),item('Implementation','Engineering','3–5'),item('Launch','Operations','5–6')]},
  {id:'kanban',label:'Kanban board',category:'Planning',description:'Work grouped by status',aliases:'tasks status board 看板 任务 进度',min:2,max:6,fields:['Column','Tasks (one per line)'],items:[item('To do','User interviews\nScope review'),item('In progress','Prototype\nDesign review'),item('Done','Kickoff\nProject brief')]},
  {id:'comparison',label:'Comparison',category:'Business',description:'Options side by side',aliases:'versus pros cons alternatives 对比 比较 优缺点',min:2,max:6,fields:['Option','Points (one per line)'],items:[item('Option A','Faster to launch\nLower initial cost\nLimited flexibility'),item('Option B','More customization\nGreater investment\nRoom to grow')]},
  {id:'swot',label:'SWOT matrix',category:'Business',description:'Strengths, weaknesses, opportunities and threats',aliases:'strategy matrix SWOT 优势 劣势 机会 威胁 分析',min:4,max:4,fields:['Quadrant','Points (one per line)'],items:[item('Strengths','Experienced team\nClear user need'),item('Weaknesses','Limited capacity\nEarly product maturity'),item('Opportunities','Growing demand\nNew partnerships'),item('Threats','Strong competition\nChanging expectations')]},
  {id:'metrics',label:'Key metrics',category:'Business',description:'Numbers with labels and context',aliases:'KPI statistics numbers results 指标 数据 关键数字',min:2,max:6,fields:['Metric','Context','Value'],items:[item('Active users','Replace with your data','12.4K'),item('Conversion','Replace with your data','8.2%'),item('Satisfaction','Replace with your data','4.8 / 5')]},
  {id:'funnel',label:'Funnel',category:'Business',description:'Stages from reach to conversion',aliases:'conversion sales journey 漏斗 转化 销售',min:2,max:8,fields:['Stage','Description','Value'],items:[item('Awareness','People reached','10,000'),item('Interest','People engaged','4,000'),item('Consideration','Qualified leads','1,200'),item('Conversion','Customers','300')]},
];
export function blockSpec(id:BlockId){const spec=DECK_BLOCKS.find(b=>b.id===id);if(!spec)throw new Error('Choose a supported block.');return spec;}
export function defaultBlockOptions(id:BlockId):BlockOptions {const spec=blockSpec(id);return BlockOptionsSchema.parse({title:spec.label,items:spec.items.map((item,index)=>({...item,...(['architecture','organization'].includes(id)&&index>0?{parent:id==='architecture'&&index>1?1:0}:{})}))});}
export function searchDeckBlocks(query:string,category:BlockCategory='All'){const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return DECK_BLOCKS.filter(b=>(category==='All'||b.category===category)&&words.every(w=>`${b.label} ${b.description} ${b.aliases}`.toLocaleLowerCase().includes(w)));}
export const blockLayouts=(id:BlockId,fixedFrame=false)=>id==='swot'||fixedFrame&&['agenda','gantt','funnel'].includes(id)?['auto'] as const:['agenda','gantt','funnel'].includes(id)?['auto','vertical'] as const:id==='timeline'?['auto','horizontal','vertical'] as const:['auto','horizontal','vertical','grid'] as const;
export function blockLayoutLabel(id:BlockId,layout:BlockOptions['layout']){if(['agenda','gantt','funnel'].includes(id))return layout==='vertical'?'Tall':'Wide';return ({auto:'Auto',horizontal:'Horizontal',vertical:'Vertical',grid:'Grid'})[layout];}

/** Generate native objects at the requested frame, using the document's type and color roles. */
export function createDeckBlock(id:BlockId,input:BlockInput,page:Pick<Deck,'width'|'height'|'designSystem'>,slide?:Pick<Slide,'backgroundStyle'>,frame?:Pick<Bounds,'w'|'h'>):DeckBlock {
  const spec=blockSpec(id),options=BlockOptionsSchema.parse(input),items=options.items,n=items.length;
  const minimum=frame&&['metrics','agenda','process','timeline','organization','roadmap','gantt','kanban','funnel'].includes(id)?1:spec.min;
  if(n<minimum||n>spec.max)throw new Error(`Use ${spec.min}–${spec.max} items for ${spec.label}.`);
  const scale=Math.min(page.width/1440,page.height/810),system=deckDesignSystem(page);
  const vertical=options.layout==='vertical';
  const W=frame?frame.w/scale:vertical?760:1000,H=frame?frame.h/scale:Math.max(vertical?720:520,['agenda','gantt'].includes(id)?100+n*(options.density==='compact'?48:58):id==='process'&&n>4?100+Math.ceil(n/3)*220:['architecture','organization'].includes(id)&&n>6?680:0);
  const group:SlideGroup={id:uid('block'),name:spec.label},elements:SlideElement[]=[],fitIssues:string[]=[];
  const ink:ColorRole=slide?.backgroundStyle==='dark'?'onDark':'ink',padding=options.density==='compact'?16:24,gap=options.density==='compact'?12:24;
  const top=options.showTitle&&options.title?78:padding,left=padding,right=W-padding,bottom=H-padding,width=right-left,height=bottom-top;
  const accentInk=(['ink','onDark','dark','background'] as ColorRole[]).sort((a,b)=>contrastRatio(system.colors[b],system.colors.accent)-contrastRatio(system.colors[a],system.colors.accent))[0];
  const panelInk=options.tone==='accent'?accentInk:options.tone==='plain'||options.tone==='outline'?ink:'ink';
  const panelMuted=options.tone==='accent'?accentInk:options.tone==='plain'||options.tone==='outline'?ink:'muted';
  let itemIndex=-1;
  const add=(type:SlideElement['type'],attrs:Partial<SlideElement>)=>{
    const e=element(type,{...attrs,...(itemIndex>=0?{blockItem:itemIndex}:{}),group:group.id});let result=styledElement({...e,x:e.x*scale,y:e.y*scale,w:Math.max(1,e.w*scale),h:Math.max(1,e.h*scale),fontSize:Math.max(4,e.fontSize*scale),strokeWidth:e.strokeWidth*scale,radius:e.radius*scale},system,page);
    if(type==='text'&&result.text){const min=Math.max(4,(options.density==='compact'?12:14)*scale);
      const measure=()=>browserTextSize({...result,textSizing:'auto-height'}, {})??{w:result.w,h:inlineTextLines(result.text,result.fontSize,result.fontFamily,result.w)*result.fontSize*result.lineHeight+8*scale};
      let size=measure();
      while(size.h>result.h+.5&&result.fontSize>min){result={...result,fontSize:Math.max(min,result.fontSize-scale)};size=measure();}
      if(result.design?.text)result.design={...result.design,textScale:result.fontSize/(system.typography[result.design.text].fontSize*scale)};
      if(size.h>result.h+.5)fitIssues.push(`Shorten “${result.name}”, hide details or use a taller layout.`);
    }elements.push(result);
  };
  const box=(x:number,y:number,w:number,h:number,bar=false)=>{const fill:ColorRole=bar||options.tone==='accent'?'accent':'surface';add('rect',{name:bar?'Work period':'Panel',x,y,w,h,radius:options.tone==='plain'?0:8,fill:!bar&&(options.tone==='plain'||options.tone==='outline')?'transparent':system.colors[fill],stroke:options.tone==='outline'?system.colors.line:'transparent',strokeWidth:options.tone==='outline'?1.5:0,design:{...(!bar&&(options.tone==='plain'||options.tone==='outline')?{}:{fill}),...(options.tone==='outline'?{stroke:'line' as const}:{})}});};
  const text=(value:string,x:number,y:number,w:number,h:number,size=22,color:ColorRole=ink,bold=false,align:SlideElement['align']='left',role:TextRole='body')=>{
    if(!value)return;const style=system.typography[role];add('text',{name:value.split('\n')[0].slice(0,100),text:value,x,y,w,h,fontSize:size*Math.max(1,Math.min(1.2,W/1000)),fontWeight:bold&&role==='body'?Math.max(500,style.fontWeight):style.fontWeight,lineHeight:style.lineHeight,align,textSizing:'fixed',clipText:true,design:{text:role,textScale:size*Math.max(1,Math.min(1.2,W/1000))/style.fontSize,fill:color,...(bold&&role==='body'?{overrides:['fontWeight' as const]}:{})}});
  };
  const line=(x1:number,y1:number,x2:number,y2:number,color:ColorRole='line')=>add('line',{name:'Connector',x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.max(1,Math.abs(x2-x1)),h:Math.max(1,Math.abs(y2-y1)),flipY:(x2-x1)*(y2-y1)<0,strokeWidth:2,stroke:system.colors[color],design:{stroke:color}});
  const labelHeight=(label:string,detail:string,w:number,h:number,preferred:number)=>{
    if(!options.showDetails||!detail)return h;
    const style=system.typography.body,min=options.density==='compact'?12:14;
    const measure=(value:string)=>{const e=element('text',{text:value,w:w*scale,fontFamily:style.fontFamily,fontSize:Math.max(4,min*scale),lineHeight:style.lineHeight,fontWeight:500,textSizing:'auto-height'});return (browserTextSize(e,{})?.h??inlineTextLines(value,min,style.fontFamily,w)*min*style.lineHeight*scale+8*scale)/scale;};
    return Math.max(measure(label),Math.min(preferred,h-measure(detail)));
  };
  // A transparent native frame keeps repeated edits and resizing anchored to the same area.
  add('rect',{name:'Block frame',x:0,y:0,w:W,h:H,fill:'transparent'});
  if(options.showTitle)text(options.title,left,14,width,50,32,ink,false,'left','heading');
  const node=(i:BlockOptions['items'][number],x:number,y:number,w:number,h:number)=>{itemIndex=items.indexOf(i);box(x,y,w,h);const inset=Math.min(12,h*.08,w*.06),labelH=labelHeight(i.label,i.detail,w-2*inset,h-2*inset-4,48);text(i.label,x+inset,y+inset,w-2*inset,labelH,24,panelInk,true,'center');if(options.showDetails)text(i.detail,x+inset,y+inset+labelH+4,w-2*inset,Math.max(12,h-2*inset-labelH-4),18,panelMuted,false,'center');};
  const row=(i:BlockOptions['items'][number],k:number,count=n)=>{itemIndex=k;const h=height/count,y=top+k*h,meta=options.showMeta?(i.meta|| (options.numbered?String(k+1).padStart(2,'0'):'')):'';const start=meta?left+width*.16:left;line(left,y+h-6,right,y+h-6);if(meta)text(meta,left,y+12,width*.14,h-24,22,ink,true);text(i.label,start,y+10,width*.34,h-22,24,ink,true);if(options.showDetails)text(i.detail,left+width*.54,y+12,width*.46,h-24,21,ink);};
  if(id==='architecture'||id==='organization'){
    const parents=items.map((item,k)=>item.parent??(k>0?(id==='architecture'&&k>1?1:0):-1));
    const depth=(index:number,seen=new Set<number>()):number=>{if(seen.has(index))throw new Error('A node cannot report to itself or its descendants.');if(parents[index]<0)return 0;if(parents[index]>=n)throw new Error('Choose an existing parent node.');seen.add(index);return 1+depth(parents[index],seen);};
    const depths=items.map((_,i)=>depth(i)),levels=Math.max(...depths)+1;if(levels>4)throw new Error('Use up to four levels, or show peer nodes in a grid.');
    if(options.layout==='grid'){const cols=n===4?2:Math.min(3,n),rows=Math.ceil(n/cols),w=(width-gap*(cols-1))/cols,h=(height-gap*(rows-1))/rows;items.forEach((i,k)=>node(i,left+k%cols*(w+gap),top+Math.floor(k/cols)*(h+gap),w,h));}
    else{
      const horizontal=options.layout==='horizontal'||options.layout==='auto'&&depths.some(d=>depths.filter(v=>v===d).length>4);
      const boxes=items.map((_,k)=>{const peers=depths.flatMap((d,index)=>d===depths[k]?[index]:[]),order=peers.indexOf(k);
        if(horizontal){const w=(width-gap*(levels-1))/levels,h=Math.min(124,(height-gap*(peers.length-1))/peers.length);return {x:left+depths[k]*(w+gap),y:top+(height-(h+gap)*peers.length+gap)/2+order*(h+gap),w,h};}
        const long=options.showDetails&&(items[k].detail.length>80||[...items[k].detail].filter(c=>/[\u2e80-\uffff]/.test(c)).length>25),levelGap=items.some(i=>i.detail.length>80)?24:36,w=Math.min(long?560:320,(width-gap*(peers.length-1))/peers.length),h=(height-levelGap*(levels-1))/levels;return {x:left+(width-(w+gap)*peers.length+gap)/2+order*(w+gap),y:top+depths[k]*(h+levelGap),w,h};
      });
      boxes.forEach((child,k)=>{if(parents[k]<0)return;const parent=boxes[parents[k]];if(horizontal){const x=(parent.x+parent.w+child.x)/2;line(parent.x+parent.w,parent.y+parent.h/2,x,parent.y+parent.h/2,ink);line(x,parent.y+parent.h/2,x,child.y+child.h/2,ink);line(x,child.y+child.h/2,child.x,child.y+child.h/2,ink);}else{const y=(parent.y+parent.h+child.y)/2;line(parent.x+parent.w/2,parent.y+parent.h,parent.x+parent.w/2,y,ink);line(parent.x+parent.w/2,y,child.x+child.w/2,y,ink);line(child.x+child.w/2,y,child.x+child.w/2,child.y,ink);}});
      boxes.forEach((box,k)=>node(items[k],box.x,box.y,box.w,box.h));
    }
  }else if(id==='agenda'||id==='timeline'&&(vertical||options.layout==='auto'&&n>5)){items.forEach((i,k)=>row(i,k));}
  else if(id==='process'){
    if(vertical){items.forEach((i,k)=>row({...i,meta:options.numbered?String(k+1).padStart(2,'0'):''},k));}
    else{const cols=options.layout==='grid'||options.layout==='auto'&&n>4?Math.min(3,n):n,rows=Math.ceil(n/cols),w=(width-gap*(cols-1))/cols,h=Math.min((height-gap*(rows-1)-(options.stagger&&rows===1?(n-1)*24:0))/rows,items.some(i=>i.detail.length>80)?320:210),y0=top+(height-(h+gap)*rows+gap-(options.stagger&&rows===1?(n-1)*24:0))/2;
      items.forEach((i,k)=>{itemIndex=k;const x=left+k%cols*(w+gap),y=y0+Math.floor(k/cols)*(h+gap)+(options.stagger&&rows===1?k*24:0);box(x,y,w,h);if(k%cols<cols-1&&k<n-1){line(x+w,y+h/2,x+w+gap,y+h/2,ink);line(x+w+gap-6,y+h/2-5,x+w+gap,y+h/2,ink);line(x+w+gap-6,y+h/2+5,x+w+gap,y+h/2,ink);}const numberH=options.numbered?32:0;if(options.numbered)text(String(k+1).padStart(2,'0'),x+16,y+14,w-32,30,18,panelMuted,false,'left','caption');text(i.label,x+16,y+14+numberH,w-32,Math.min(66,h*.35),24,panelInk,true);if(options.showDetails)text(i.detail,x+16,y+22+numberH+Math.min(66,h*.35),w-32,Math.max(16,h-40-numberH-Math.min(66,h*.35)),20,panelMuted);});
    }
  }else if(id==='timeline'){
    const w=width/n,y=top+height*.38;line(left+w/2,y,right-w/2,y,ink);items.forEach((i,k)=>{itemIndex=k;const x=left+k*w;add('ellipse',{name:'Milestone',x:x+w/2-7,y:y-7,w:14,h:14,fill:system.colors.accent,design:{fill:'accent'}});if(options.showMeta)text(i.meta,x+10,top+height*.12,w-20,height*.2,22,ink,true,'center','caption');text(i.label,x+10,y+32,w-20,height*.21,24,ink,true,'center');if(options.showDetails)text(i.detail,x+10,y+height*.3,w-20,height*.3,20,ink,false,'center');});
  }else if(['roadmap','kanban','comparison','metrics','swot'].includes(id)){
    if(vertical&&id!=='swot'){items.forEach((i,k)=>row(i,k));}
    else{const cols=id==='swot'||n===4&&options.layout==='auto'?2:options.layout==='grid'||options.layout==='auto'&&n>4?Math.min(3,n):n,rows=Math.ceil(n/cols),w=(width-gap*(cols-1))/cols,h=(height-gap*(rows-1))/rows;
      items.forEach((i,k)=>{itemIndex=k;const x=left+k%cols*(w+gap),y=top+Math.floor(k/cols)*(h+gap),inset=20;box(x,y,w,h);
        if(id==='metrics'){
          const valueH=options.showMeta?Math.min(90,h*.28):0,labelH=h*.20,labelY=inset+(options.showMeta?valueH+8:0),detailY=labelY+labelH+8;
          if(options.showMeta)text(i.meta,x+inset,y+inset,w-2*inset,valueH,Math.min(56,h*.26)*.86,options.tone==='accent'?accentInk:'accent',false,'left','heading');
          text(i.label,x+inset,y+labelY,w-2*inset,labelH,24,panelInk,true);
          if(options.showDetails){const lines=i.detail.split('\n'),available=Math.max(16,h-inset-detailY);lines.forEach((v,j)=>text(v,x+inset,y+detailY+j*available/lines.length,w-2*inset,available/lines.length,20,panelMuted));}
        }
        else{const labelH=Math.min(64,h*.26);text(i.label,x+inset,y+inset,w-2*inset,labelH,26,panelInk,true);const metaH=id==='roadmap'&&options.showMeta&&i.meta?36:0;if(metaH)text(i.meta,x+inset,y+inset+labelH+6,w-2*inset,metaH,18,panelMuted,false,'left','caption');const dy=y+inset+labelH+metaH+16;if(options.showDetails)text(i.detail,x+inset,dy,w-2*inset,Math.max(16,y+h-inset-dy),22,panelInk);}
      });
    }
  }else if(id==='gantt'){
    const start=left+width*.28,col=(right-start)/options.periods,header=42,rowH=(height-header)/n;
    for(let k=0;k<options.periods;k++){text(options.periodLabels[k]?.trim()||`W${k+1}`,start+k*col,top,col,28,18,ink,false,'center','caption');line(start+k*col,top+header,start+k*col,bottom);}
    items.forEach((i,k)=>{itemIndex=k;const match=i.meta.match(/^\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*$/);if(!match)throw new Error(`Enter a period range from 1–${options.periods}, such as 1–2.`);const a=Number(match[1]),b=Number(match[2]);if(a<1||b>options.periods)throw new Error(`Use periods from 1–${options.periods}.`);if(b<a)throw new Error('The end period must follow the start period.');const y=top+header+k*rowH;const labelH=labelHeight(i.label,i.detail,start-left-18,rowH-8,rowH*.55);text(i.label,left,y+4,start-left-18,labelH,22,ink,true);if(options.showDetails)text(i.detail,left,y+labelH+4,start-left-18,rowH-labelH-8,17,ink);box(start+(a-1)*col+6,y+8,(b-a+1)*col-12,rowH-16,true);});
  }else if(id==='funnel'){
    const rowH=height/n;items.forEach((i,k)=>{itemIndex=k;const w=n===1?width:width-k*(width*.46/(n-1)),x=(W-w)/2,y=top+k*rowH;box(x,y,w,rowH-12);const labelH=labelHeight(i.label,i.detail,w*.6-24,rowH-24,rowH*.45);text(i.label,x+18,y+8,w*.6-24,labelH,24,panelInk,true);if(options.showDetails)text(i.detail,x+18,y+labelH+10,w*.6-24,rowH-labelH-24,18,panelMuted);if(options.showMeta)text(i.meta,x+w*.62,y+12,w*.38-18,rowH-28,24,panelInk,true,'right');});
  }
  group.block={kind:id,options,fingerprint:blockFingerprint(elements)};
  return {id,name:spec.label,w:W*scale,h:H*scale,elements,group,fitIssues};
}

export function placeDeckBlock(block:DeckBlock,geometry:Bounds,slideId:string):{operations:Operation[];ids:string[];groupId:string}{
  const scale=Math.min(geometry.w/block.w,geometry.h/block.h);if(!Number.isFinite(scale)||scale<=0)throw new Error('Choose a valid block size.');
  const group={...block.group,id:uid('block')};
  const elements=block.elements.map(e=>{const fontSize=Math.max(4,e.fontSize*scale);return {...e,id:uid(),group:group.id,x:geometry.x+e.x*scale,y:geometry.y+e.y*scale,w:Math.max(1,e.w*scale),h:Math.max(1,e.h*scale),fontSize,strokeWidth:e.strokeWidth*scale,radius:e.radius*scale,...(e.design?.text?{design:{...e.design,textScale:(e.design.textScale??1)*fontSize/e.fontSize}}:{})};});
  group.block={...block.group.block!,fingerprint:blockFingerprint(elements)};
  return {operations:[{op:'set_group',slideId,group},...elements.map(e=>({op:'add_element' as const,slideId,element:e}))],ids:elements.map(e=>e.id),groupId:group.id};
}

export function updateDeckBlock(slide:Slide,groupId:string,block:DeckBlock):{operations:Operation[];ids:string[];groupId:string}{
  const group=slide.groups?.find(g=>g.id===groupId),members=descendants(slide,groupId),frame=groupBox(slide,groupId);
  if(!group?.block||!frame)throw new Error('Choose an editable block.');if(members.some(e=>e.locked))throw new Error('Unlock the block before changing it.');
  const placed=placeDeckBlock(block,frame,slide.id),elements=placed.operations.flatMap(op=>op.op==='add_element'?[{...op.element,group:groupId}]:[]),oldIds=new Set(members.map(e=>e.id));
  const nested=slide.groups?.filter(g=>g.id!==groupId&&ancestorIds(slide,g.id).includes(groupId))??[];
  const order=slide.elements.flatMap((e,i)=>oldIds.has(e.id)?i===slide.elements.findIndex(e=>oldIds.has(e.id))?elements.map(e=>e.id):[]:[e.id]);
  const recipe={...block.group.block!,fingerprint:blockFingerprint(elements)};
  return {groupId,ids:elements.map(e=>e.id),operations:[
    ...nested.reverse().map(g=>({op:'remove_group' as const,slideId:slide.id,groupId:g.id})),
    ...(slide.autoLayouts?.some(l=>l.id===groupId)?[{op:'remove_group_layout' as const,slideId:slide.id,groupId}]:[]),
    ...members.map(e=>({op:'delete_element' as const,slideId:slide.id,elementId:e.id})),
    {op:'set_group',slideId:slide.id,group:{...group,block:recipe}},
    ...elements.map(e=>({op:'add_element' as const,slideId:slide.id,element:e})),
    {op:'reorder_elements',slideId:slide.id,ids:order},
  ]};
}
