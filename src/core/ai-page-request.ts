import type {Deck,Slide} from './model';
import type {Proposal} from './operations';
import {applyOperations} from './operations';
import {deckDesignSystem} from './deck-design-system';
import {AI_TEMPLATE_LAYOUTS} from './ai-story';

type ArtworkField='x'|'y'|'w'|'h'|'group'|'animation'|'motionKey'|'rotation'|'opacity';
type ChartRequirement={type?:string;points:{series:string;label:string;value:number}[];series:{name:string;values:number[]}[];labels?:string[];preserveFrame:boolean;editable:string[];nested?:Record<string,string[]>;allowSeriesChange?:boolean};
export type PageRequirement={number:number;slideId:string;instruction:string;replaceArtwork:boolean;styleArtwork:boolean;colors:string[];texts:string[];textFields?:{key:string;value:string}[];notesEditable?:boolean;layout?:string;collection?:string;density?:'reading'|'presentation';chart?:ChartRequirement;preserveCopy:boolean;preserveArtwork:ArtworkField[]};
export type PageRequest={pages:PageRequirement[];protectedIds:string[];structural:boolean;deletedNumbers?:number[];additions?:{afterNumber:number;count:number;instruction:string;texts:string[];layout?:string;collection?:string}[];globalTheme?:boolean;reorder?:boolean};
const numerals:Record<string,number>={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12};
const number=(s:string)=>numerals[s]??Number(s);
function pageNumbers(raw:string){return raw.split(/[、,，和及&]/).flatMap(part=>{const range=part.split(/[-–到至]/);if(range.length===2){const a=number(range[0]),b=number(range[1]);return a<=b&&b-a<30?Array.from({length:b-a+1},(_,i)=>a+i):[];}const n=number(part);return Number.isInteger(n)?[n]:[];});}
function preservedArtwork(clause:string):ArtworkField[]{
 const fields=new Set<ArtworkField>(),phrases=[...clause.matchAll(/(?:保留|保持)([^，,。；;\n]*)|([^，,。；;\n]*)(?:不动|不变)|(?:keep|preserve)\s+([^.;\n]*?)(?=\ballow|\bchange|[.;\n]|$)/gi)].map(m=>m[1]??m[2]??m[3]);
 for(const phrase of phrases){
  if(/位置|position/i.test(phrase)){fields.add('x');fields.add('y');}
  if(/尺寸|大小|size|dimensions/i.test(phrase)){fields.add('w');fields.add('h');}
  if(/框架|frame/i.test(phrase))for(const key of ['x','y','w','h','rotation'] as const)fields.add(key);
  if(/分组|group/i.test(phrase))fields.add('group');
  if(/动画|动效|animation|motion/i.test(phrase)){fields.add('animation');fields.add('motionKey');}
  if(/旋转|rotation/i.test(phrase))fields.add('rotation');
  if(/透明度|opacity/i.test(phrase))fields.add('opacity');
 }
 return [...fields];
}
const withoutQuotedCopy=(text:string)=>text.replace(/「[^」]*」|“[^”]*”|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,s=>' '.repeat(s.length));
const positiveActions=(text:string)=>withoutQuotedCopy(text).replace(/(?:不得|不要|禁止|不允许|不能|不(?=新增|添加|删除|更换|替换|修改|调整)|do not|never|without)[^，,。；;\n]*/gi,'');
const quotedTexts=(text:string)=>[...text.matchAll(/「([^」]+)」|“([^”]+)”/g)].map(m=>m[1]??m[2]);
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function templateIntent(intent:string){
 const tokens=[...intent.matchAll(new RegExp(`\\b(${AI_TEMPLATE_LAYOUTS.join('|')})\\b`,'gi'))];
 const aliases:Record<string,string>={portfolio:'portfolio',Editorial:'portfolio',review:'review',Studio:'review',proposal:'proposal',Monograph:'proposal',pitch:'pitch',Signal:'pitch',report:'report',Ledger:'report',minimal:'minimal',Minimalist:'minimal'};
 const family=/(?:家族|模板|family|collection|template)/i.test(intent)?Object.keys(aliases).flatMap(key=>[...intent.matchAll(new RegExp(`\\b${key}\\b`,'gi'))].map(m=>({key,index:m.index!}))).sort((a,b)=>a.index-b.index).at(-1)?.key:undefined;
 return {layout:/(?:版式|布局|layout)/i.test(intent)?tokens.at(-1)?.[1].toLowerCase():undefined,collection:family?aliases[family]:undefined};
}
function chartIntent(slide:Slide,clause:string):ChartRequirement|undefined{
 const chart=slide.elements.find(e=>e.type==='chart')?.chart,intent=positiveActions(clause);if(!chart||!/(?:图表|系列|chart|series)/i.test(intent))return;
 const points:ChartRequirement['points']=[],series:ChartRequirement['series']=[];
 for(const s of chart.series){for(const label of chart.labels){const m=new RegExp(`${escape(s.name)}(?:系列)?\\s*${escape(label)}\\s*(?:改为|改成|=)\\s*(-?\\d+(?:\\.\\d+)?)`,'i').exec(intent);if(m)points.push({series:s.name,label,value:Number(m[1])});}
  const m=new RegExp(`${escape(s.name)}(?:系列)?\\s*(?:改为|改成|更新为)\\s*\\[([^\\]]+)\\]`,'i').exec(intent);if(m){const values=m[1].split(/[,，、]/).map(v=>Number(v.trim()));if(values.every(Number.isFinite))series.push({name:s.name,values});}
 }
 const labels=/(?:标签|labels)\s*(?:改为|改成|更新为|=)\s*\[([^\]]+)\]/i.exec(intent)?.[1].split(/[,，、]/).map(v=>v.trim());
 const type=/(?:图表|类型|chart|type)[^。；;\n]{0,18}(?:改为|改成|换成|为|to)\s*(column|bar|line|area|pie|donut)\b/i.exec(intent)?.[1];
 const editable=new Set<string>();if(type)editable.add('type');if(points.length||series.length)editable.add('series');if(labels)editable.add('labels');
 for(const [word,key]of [['数值','showValues'],['图例位置','legendPosition'],['图例','legend'],['网格','grid'],['来源','source'],['source','source'],['颜色','colors'],['图表标题','title'],['数据标签','dataLabels'],['坐标轴','axisStyle'],['平滑','visual'],['线宽','visual'],['小数','numberFormat']]as const)if(new RegExp(`${word}[^，,。；;\\n]{0,12}(?:改为|改成|调整|修改|显示|隐藏|开启|关闭|设置)|(?:调整|修改|显示|隐藏|开启|关闭|设置)[^，,。；;\\n]{0,8}${word}`,'i').test(intent))editable.add(key);
 if(!editable.size&&/(?:修改|调整)[^。；;\n]{0,10}(?:图表|chart)/i.test(intent))for(const key of ['legend','grid','showValues','colors','textColor','visual','numberFormat','legendPosition','axisStyle','dataLabels'])editable.add(key);
 const allowSeriesChange=/(?:新增|添加|增加|删除|移除)[^，,。\n]{0,12}(?:系列|series)|(?:add|remove|delete)[^,.;\n]{0,12}series/i.test(intent);
 const nested:Record<string,string[]>={};for(const [word,key]of [['坐标轴','axisStyle'],['数据标签','dataLabels']]as const){const part=new RegExp(`${word}([^。；;\\n]*)`).exec(intent)?.[1];if(!part||!editable.has(key))continue;const fields=new Set<string>();for(const [term,field]of [['字号','fontSize'],['字体大小','fontSize'],['旋转','rotation'],['角度','rotation'],['位置','position'],['颜色','color'],['粗体','bold'],['加粗','bold'],['显示标签','showLabels'],['隐藏标签','showLabels']]as const)if(new RegExp(`${term}[^，,。；;\\n]{0,12}(?:改为|改成|调整|修改|设置)|(?:设置|显示|隐藏|开启|关闭)[^，,。；;\\n]{0,8}${term}`).test(part))fields.add(field);if(fields.size)nested[key]=[...fields];}
 const preserved=preservedArtwork(intent);return {type,points,series,labels,editable:[...editable],nested,allowSeriesChange,preserveFrame:/(?:图表|chart)/i.test(intent)&&preserved.some(k=>['x','y','w','h'].includes(k))};
}
function mergeChartIntent(previous:ChartRequirement|undefined,current:ChartRequirement|undefined){
 if(!previous||!current)return current??previous;
 const unique=<T,>(values:T[],key:(value:T)=>string)=>[...new Map(values.map(value=>[key(value),value])).values()];
 return {...previous,...current,type:current.type??previous.type,labels:current.labels??previous.labels,points:unique([...previous.points,...current.points],p=>p.series+'\0'+p.label),series:unique([...previous.series,...current.series],s=>s.name),editable:[...new Set([...previous.editable,...current.editable])],nested:Object.fromEntries([...new Set([...Object.keys(previous.nested??{}),...Object.keys(current.nested??{})])].map(k=>[k,[...new Set([...(previous.nested?.[k]??[]),...(current.nested?.[k]??[])])]])),preserveFrame:previous.preserveFrame||current.preserveFrame,allowSeriesChange:previous.allowSeriesChange||current.allowSeriesChange};
}
function textFieldIntent(slide:Slide,clause:string){
 const plain=withoutQuotedCopy(clause),fields:{key:string;value:string}[]=[];
 const markers=/(图表标题|小标题|三栏标题|各栏标题|副标题|正文|主标题|标题|来源|备注|讲稿)\s*(?:分别)?\s*(?:改为|改成|设为|修改为)/g;
 for(const m of plain.matchAll(markers)){const start=m.index!+m[0].length,stop=/[。；;\n]/.exec(plain.slice(start)),values=quotedTexts(clause.slice(start,stop?start+stop.index:clause.length));if(!values.length)continue;const name=m[1];if(name==='来源'||name==='图表标题'){if(slide.elements.some(e=>e.type==='chart'))fields.push({key:name==='来源'?'chart.source':'chart.title',value:values[0]});}
  else if(['小标题','三栏标题','各栏标题'].includes(name)||name==='正文'&&slide.template?.slots?.some(s=>s.key.startsWith('items.')))values.forEach((value,i)=>fields.push({key:`items.${i}.${name==='正文'?'body':'heading'}`,value}));
  else fields.push({key:name==='备注'||name==='讲稿'?'notes':name==='正文'||name==='副标题'?'body':'heading',value:values[0]});
 }
 return fields;
}
// Number labels refresh when structure changes; all authored page content stays protected.
const authoredPage=(slide:Slide)=>({...slide,elements:slide.elements.map(e=>e.pageElement?.kind==='page-number'?{...e,text:'[page-number]'}:e)});
/** Only explicit page addresses are binding. Quoted authored copy is not an address. */
export function resolvePageRequest(deck:Deck,prompt:string):PageRequest{
 const unquoted=withoutQuotedCopy(prompt);
 const pattern=/第\s*([\d一二三四五六七八九十]+(?:\s*[、,，和及&–到至-]\s*[\d一二三四五六七八九十]+)*)\s*页|\bslides?\s+([\d]+(?:\s*(?:,|and|&|–|to|-)\s*\d+)*)/gi;
 const matches=[...unquoted.matchAll(pattern)].filter(m=>!/(?:使用|来自|复用|参考|参照|from|reuse|using)\s*$/i.test(unquoted.slice(Math.max(0,m.index!-18),m.index))),pages=new Map<number,PageRequirement>(),protectedIds=new Set<string>(),deletedNumbers=new Set<number>(),additions:NonNullable<PageRequest['additions']>=[];
 for(const [index,match] of matches.entries()){
  const start=match.index!,end=matches[index+1]?.index??prompt.length,clause=prompt.slice(start,end),raw=(match[1]??match[2]).replace(/\band\b/gi,',').replace(/\bto\b/gi,'-').replace(/\s+/g,''),numbers=pageNumbers(raw);
  const tail=unquoted.slice(start+match[0].length,end),prefix=unquoted.slice(Math.max(0,start-18),start);
  const protectedOnly=/^\s*[:：]?\s*(?:全部|都|完全)?\s*(?:保持不变|保持原样|内容不改|不动|不修改|不要修改|作为参考|仅供参考|unchanged|keep unchanged|for reference)/i.test(tail)||/(?:不要修改|不修改|保持|leave|do not change|keep)\s*$/i.test(prefix)&&/^\s*(?:不变|原样|unchanged|[，,。;；]|$)/i.test(tail);
  for(const n of numbers){const slide=deck.slides[n-1];if(!slide)throw new Error(`Slide ${n} does not exist. Use the current page numbers.`);if(protectedOnly){protectedIds.add(slide.id);continue;}
   const positive=positiveActions(clause),intent=withoutQuotedCopy(clause);
   if(/(?:删除|移除|delete|remove)\s*(?:原|original)?\s*$/i.test(prefix)||/^\s*[:：]?\s*(?:删除|移除|delete|remove)/i.test(tail)){deletedNumbers.add(n);continue;}
   const insertion=/^\s*[:：]?\s*(?:在)?(?:本页|该页|此页)?(?:之)?(后|前|after|before)[^。；;\n]{0,10}(?:新增|添加|插入|add|insert)\s*([\d一二三四五六七八九十]+)?\s*(?:页|slides?)/i.exec(tail);
   if(insertion){additions.push({afterNumber:/前|before/i.test(insertion[1])?n-1:n,count:number(insertion[2]??'1'),instruction:clause,texts:quotedTexts(clause),...templateIntent(intent)});continue;}
   const artwork=/(?:插画|图标|图片|素材|照片|纹理|illustration|icon|image|artwork|asset|photo|texture)/i.test(intent),replaceArtwork=artwork&&positive.split(/[，,。；;\n]/).some(part=>/(?:插画|图标|图片|素材|照片|纹理|illustration|icon|image|artwork|asset|photo|texture)/i.test(part)&&/(?:换成|更换|替换|换掉|replace|swap)/i.test(part)&&!/(?:模板|家族|版式|template|family|layout)[^。\n]{0,10}(?:换成|更换|替换|replace|swap)/i.test(part)),styleArtwork=artwork&&/(?:调色|recolor|tint)|(?:颜色|主色|色彩|样式|强度|缩放)[^，,。；;\n]{0,15}(?:改为|改成|修改|调整)|(?:修改|调整|改变)[^，,。；;\n]{0,15}(?:颜色|主色|色彩|样式|强度|缩放)|(?:set|change|update)[^.;\n]{0,20}(?:color|style)|\bcolor\s+(?:the\s+)?(?:icon|image|artwork|illustration)/i.test(positive);
   const texts=quotedTexts(clause),template=templateIntent(intent);
   const density=/(?:密度|density|版式|layout)/i.test(positive)?/\breading\b|阅读密度/i.test(positive)?'reading':/\bpresentation\b|演示密度/i.test(positive)?'presentation':undefined:undefined;
   const copyEdit=/(?:标题|正文|文字|文案)[^。\n]{0,15}(?:改为|改成|修改|调整|缩短|替换)|(?:修改|调整|缩短)[^。\n]{0,12}(?:标题|正文|文字|文案)/i.test(clause),preserveCopy=/(?:保留|保持)[^。\n]{0,35}(?:标题和正文|标题与正文|三条原则)/i.test(clause)||(replaceArtwork||styleArtwork)&&!copyEdit;
   const notesEditable=/(?:修改|补充|增加|添加|更新|清空|删除)[^，,。\n]{0,15}(?:备注|讲稿|notes)|(?:备注|讲稿|notes)[^，,。\n]{0,15}(?:改为|改成|修改|更新|清空|delete|change|update)/i.test(positive);
   const previous=pages.get(n);pages.set(n,{number:n,slideId:slide.id,instruction:previous?previous.instruction+'\n'+clause:clause,replaceArtwork:replaceArtwork||previous?.replaceArtwork||false,styleArtwork:styleArtwork||previous?.styleArtwork||false,colors:[...(previous?.colors??[]),...(clause.match(/#[\da-fA-F]{6}\b/g)??[])],texts:[...(previous?.texts??[]),...texts],textFields:[...(previous?.textFields??[]),...textFieldIntent(slide,clause)],notesEditable:notesEditable||previous?.notesEditable,layout:template.layout??previous?.layout,collection:template.collection??previous?.collection,density:density??previous?.density,chart:mergeChartIntent(previous?.chart,chartIntent(slide,clause)),preserveCopy:preserveCopy||previous?.preserveCopy||false,preserveArtwork:[...new Set([...(previous?.preserveArtwork??[]),...preservedArtwork(intent)])]});
  }
 }
 for(const p of pages.values())if(protectedIds.has(p.slideId))throw new Error(`Slide ${p.number} is requested both for editing and preservation. Clarify that page's changes.`);
 for(const n of deletedNumbers)if(pages.has(n)||protectedIds.has(deck.slides[n-1].id))throw new Error(`Slide ${n} is requested for deletion and editing/preservation.`);
 const actions=positiveActions(prompt),globalTheme=/(?:统一|修改|调整|更换|改变|应用)\s*(?:整套|全部|所有|全局|全文)(?:页面|幻灯片|文档)?的?(?:主题|风格)|(?:整套|全局|全文)(?:的)?(?:主题|风格)\s*(?:改为|改成|换成|更新|调整)|(?:change|apply|update)\s+(?:the\s+)?(?:theme|styles?)\s+(?:across|throughout)/i.test(actions),reorder=/(?:重排|调整|改变)[^。\n]{0,8}(?:页序|页面顺序)|reorder\s+(?:the\s+)?slides?/i.test(actions);
 return {pages:[...pages.values()],protectedIds:[...protectedIds],deletedNumbers:[...deletedNumbers],additions,globalTheme,reorder,structural:Boolean(deletedNumbers.size||additions.length||globalTheme||reorder||/(?:新增|删除|复制|增减|添加)[^。\n]{0,20}(?:页|slide)|(?:add|delete|duplicate)\s+(?:the\s+)?slides?/i.test(actions))};
}
export function usePageBatch(prompt:string,request:PageRequest){const actions=positiveActions(prompt),structure=(request.deletedNumbers?.length??0)+(request.additions?.length??0);return request.pages.length+structure>1&&!request.globalTheme&&!request.reorder&&(!request.structural||structure>0)&&/(?:修改|改为|改成|调整|调色|更换|替换|重排|缩短|新增|删除|添加|change|edit|update|reflow|recolor|replace|refine|add|delete)/i.test(actions)&&!/(?:修改|更新|调整|新增|添加|插入)[^。\n]{0,18}(?:表格|富文本|动效|动画|原型)|(?:修改|新增|添加|插入)[^。\n]{0,18}(?:对象|形状)|(?:移动|放大|缩小)[^，,。；;\n]{0,20}(?:标题|正文|文字|插画|图标|图片)|(?:标题|正文|文字|插画|图标|图片)的?(?:位置|尺寸|字号|字体)[^，,。；;\n]{0,12}(?:改为|改成|调整|修改)|(?:修改|调整)[^，,。；;\n]{0,8}(?:标题|正文|文字|插画|图标|图片)的?(?:位置|尺寸|字号|字体)|(?:复用|使用)[^。\n]{0,15}第\s*\d+\s*页|(?:edit|update|add|insert)[^.;\n]{0,20}(?:table|prototype|animation|shape)|(?:move|resize)[^.;\n]{0,20}(?:title|text|image|icon|illustration)/i.test(actions);}
export function assetColor(deck:Deck,e:Slide['elements'][number]){return e.design?.fill?deckDesignSystem(deck).colors[e.design.fill]:e.resource?.color??e.fill;}
const assets=(slide?:Slide)=>slide?.elements.filter(e=>e.type==='image'&&!e.hidden)??[];
export function validatePageRequest(deck:Deck,proposal:Proposal,request:PageRequest){
 if(!request.pages.length&&!request.deletedNumbers?.length&&!request.additions?.length)return;
 const after=applyOperations(deck,proposal.operations,proposal.baseRevision,'ai'),targets=new Set(request.pages.map(p=>p.slideId)),deleted=new Set((request.deletedNumbers??[]).map(n=>deck.slides[n-1].id)),original=new Set(deck.slides.map(s=>s.id)),issues:string[]=[];
 const check=(condition:boolean,message:string)=>{if(!condition)issues.push(message);};
 if(!request.structural)check(after.slides.length===deck.slides.length,'Keep the existing slide count; the request only changes named pages.');
 for(const s of deck.slides){const next=after.slides.find(v=>v.id===s.id);if(next&&!request.pages.find(p=>p.slideId===s.id)?.notesEditable)check(next.notes===s.notes,`Slide ${deck.slides.indexOf(s)+1}: speaker notes were not requested for editing.`);}
 if(!request.globalTheme)check(JSON.stringify(after.designSystem)===JSON.stringify(deck.designSystem),'Keep the current document theme; this request only changes named pages.');
 for(const s of deck.slides){const next=after.slides.find(p=>p.id===s.id);if(deleted.has(s.id)){check(!next,`Slide ${deck.slides.indexOf(s)+1} must be deleted.`);continue;}check(Boolean(next),`Slide ${deck.slides.indexOf(s)+1} must remain in the document.`);if(!next)continue;const changed=JSON.stringify(authoredPage(s))!==JSON.stringify(authoredPage(next));if(changed&&(request.protectedIds.includes(s.id)||!request.globalTheme&&!targets.has(s.id)))issues.push(`Slide ${deck.slides.indexOf(s)+1} was not requested for editing. Keep it unchanged and submit only the named pages.`);}
 if(!request.reorder)check(JSON.stringify(after.slides.filter(s=>original.has(s.id)).map(s=>s.id))===JSON.stringify(deck.slides.filter(s=>!deleted.has(s.id)).map(s=>s.id)),'Keep the relative order and IDs of all surviving original slides.');
 const added=after.slides.filter(s=>!original.has(s.id)),insertions=request.additions??[];
 if(!request.structural||deleted.size||insertions.length)check(added.length===insertions.reduce((n,a)=>n+a.count,0),'Include exactly the requested new slides; do not omit or duplicate an insertion.');
 if(insertions.length){let index=0;const order:string[]=[];for(let n=0;n<=deck.slides.length;n++){if(n&&!deleted.has(deck.slides[n-1].id))order.push(deck.slides[n-1].id);for(const insertion of insertions.filter(a=>a.afterNumber===n)){const group=added.slice(index,index+insertion.count);index+=insertion.count;order.push(...group.map(s=>s.id));const copy=group.flatMap(s=>s.elements.map(e=>e.text)).join('\n');for(const t of insertion.texts)check(copy.includes(t),`New slide after original ${n} is missing requested text: ${t}.`);if(insertion.layout)check(group.every(s=>s.template?.prototype===insertion.layout),`New slide after original ${n} needs layout:${insertion.layout}.`);if(insertion.collection)check(group.every(s=>s.template?.collection===insertion.collection),`New slide after original ${n} needs collection:${insertion.collection}.`);}}
  check(JSON.stringify(after.slides.map(s=>s.id))===JSON.stringify(order),'Insert new slides after the requested ORIGINAL anchors, not renumbered pages.');
 }
 for(const p of request.pages){try{const before=deck.slides.find(s=>s.id===p.slideId)!,next=after.slides.find(s=>s.id===p.slideId);if(!next)continue;
  check(p.notesEditable||next.notes===before.notes,`Slide ${p.number}: speaker notes were not requested for editing.`);
  const copy=next.elements.filter(e=>!e.hidden).map(e=>e.type==='chart'?JSON.stringify(e.chart):e.text).join('\n')+(p.notesEditable?'\n'+next.notes:'');for(const text of p.texts)check(copy.includes(text),`Slide ${p.number} is missing requested text: ${text}. Complete every requested field before submitting.`);
  for(const field of p.textFields??[]){const actual=field.key==='notes'?next.notes:field.key.startsWith('chart.')?(next.elements.find(e=>e.type==='chart')?.chart as any)?.[field.key.slice(6)]:next.elements.find(e=>e.id===next.template?.slots?.find(s=>s.key===field.key)?.elementId)?.text;check(actual===field.value,`Slide ${p.number}: field ${field.key} must contain ${field.value}; do not put it in a different text field.`);}
  if(p.preserveCopy){const headingEdit=/(?:^|[：:，,。;\n])\s*(?:把)?(?:主)?标题\s*(?:改为|改成|修改)|(?:change|update|edit)[^.;\n]{0,10}(?:heading|title)/i.test(p.instruction),headingId=headingEdit?before.template?.slots?.find(s=>s.key==='heading')?.elementId:undefined;for(const e of before.elements.filter(e=>e.type==='text'&&!e.hidden&&!e.pageElement&&e.id!==headingId))if(e.text&&!copy.includes(e.text))throw new Error(`Slide ${p.number}: preserve its current copy; text changes were not requested.`);}
  if(p.layout&&next.template?.prototype!==p.layout)throw new Error(`Slide ${p.number} needs layout:${p.layout}. Preserve the requested page-to-layout mapping.`);
  if(p.collection&&next.template?.collection!==p.collection)throw new Error(`Slide ${p.number} needs collection:${p.collection}. Complete every requested template-family change.`);
  if(p.density&&next.template?.density!==p.density)throw new Error(`Slide ${p.number} needs density:${p.density}. Do not omit the requested template reflow.`);
  if(p.chart){const old=before.elements.find(e=>e.type==='chart')!,chart=next.elements.find(e=>e.type==='chart');if(!chart?.chart)throw new Error(`Slide ${p.number}: preserve its editable chart.`);if(p.chart.type)check(chart.chart.type===p.chart.type,`Slide ${p.number}: chart type must be ${p.chart.type}.`);for(const point of p.chart.points)check(chart.chart.series.find(s=>s.name===point.series)?.values[chart.chart.labels.indexOf(point.label)]===point.value,`Slide ${p.number}: ${point.series}/${point.label} must be ${point.value}.`);for(const series of p.chart.series)check(JSON.stringify(chart.chart.series.find(s=>s.name===series.name)?.values)===JSON.stringify(series.values),`Slide ${p.number}: retain all requested values for series ${series.name}.`);if(p.chart.labels)check(JSON.stringify(chart.chart.labels)===JSON.stringify(p.chart.labels),`Slide ${p.number}: include every requested category label in order.`);else check(JSON.stringify(chart.chart.labels)===JSON.stringify(old.chart?.labels),`Slide ${p.number}: category labels were not requested for replacement.`);for(const key of new Set([...Object.keys(old.chart!),...Object.keys(chart.chart)]))if(!p.chart.editable.includes(key))check(JSON.stringify((chart.chart as any)[key])===JSON.stringify((old.chart as any)[key]),`Slide ${p.number}: chart ${key} was not requested for editing.`);if(!p.chart.allowSeriesChange)check(JSON.stringify(chart.chart.series.map(s=>s.name))===JSON.stringify(old.chart!.series.map(s=>s.name)),`Slide ${p.number}: keep the requested series count and order.`);if(p.chart.points.length&&!p.chart.series.length&&!p.chart.labels){for(const series of old.chart!.series){const values=[...series.values];for(const point of p.chart.points.filter(p=>p.series===series.name))values[old.chart!.labels.indexOf(point.label)]=point.value;check(JSON.stringify(chart.chart.series.find(s=>s.name===series.name)?.values)===JSON.stringify(values),`Slide ${p.number}: preserve all other values in series ${series.name}.`);}}for(const [key,fields]of Object.entries(p.chart.nested??{})){const previous=(old.chart as any)[key]??{},current=(chart.chart as any)[key]??{};for(const field of new Set([...Object.keys(previous),...Object.keys(current)]))if(!fields.includes(field))check(JSON.stringify(current[field])===JSON.stringify(previous[field]),`Slide ${p.number}: chart ${key}.${field} was not requested for editing.`);}
  if(p.chart.preserveFrame)check(chart.id===old.id&&(['x','y','w','h'] as const).every(k=>chart[k]===old[k]),`Slide ${p.number}: keep the existing chart ID and frame.`);}
  const old=assets(before),current=assets(next);
  if(p.preserveArtwork.length)for(const e of old){const n=current.find(a=>a.id===e.id);if(!n||p.preserveArtwork.some(k=>JSON.stringify(e[k])!==JSON.stringify(n[k])))throw new Error(`Slide ${p.number}: keep the existing artwork ID and requested properties: ${p.preserveArtwork.join(', ')}.`);}
  if(!p.replaceArtwork){if(old.length!==current.length)throw new Error(`Slide ${p.number}: preserve its existing artwork count; do not introduce another image while reflowing.`);for(const e of old){const n=current.find(a=>a.id===e.id);if(!n||n.resource?.id!==e.resource?.id)throw new Error(`Slide ${p.number}: artwork replacement was not requested. Keep the existing resource ID; color/style changes must customize that resource.`);if(!p.styleArtwork&&(n.src!==e.src||JSON.stringify(n.resource)!==JSON.stringify(e.resource)))throw new Error(`Slide ${p.number}: preserve the existing artwork and its style. The request only changes text or layout.`);}}
  if(p.styleArtwork&&p.colors.length){const color=p.colors.at(-1)!.toLowerCase();if(!current.some(e=>assetColor(after,e)?.toLowerCase()===color&&(!e.resource?.color||e.resource.color.toLowerCase()===color)))throw new Error(`Slide ${p.number}: apply the requested artwork color ${color} to the actual asset, not only the object fill.`);}
  if(p.replaceArtwork&&old.length&&!old.some(e=>{const n=current.find(a=>a.id===e.id);return n&&n.resource?.id!==e.resource?.id;}))throw new Error(`Slide ${p.number}: replace the requested artwork with a different actual library resource.`);
  const changed=JSON.stringify(before)!==JSON.stringify(next),alreadyMatches=p.styleArtwork&&!p.replaceArtwork&&p.colors.length&&old.some(e=>assetColor(deck,e)?.toLowerCase()===p.colors.at(-1)!.toLowerCase())&&p.texts.every(t=>copy.includes(t));
  if(!changed&&!alreadyMatches)throw new Error(`Slide ${p.number} was omitted. Include all requested page edits in one proposal.`);
 }catch(error){issues.push((error as Error).message);}}
 if(issues.length)throw new Error(issues.slice(0,12).join('\n'));
}
