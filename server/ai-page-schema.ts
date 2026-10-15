import type {Deck} from '../src/core/model';import type {PageRequest,PageRequirement} from '../src/core/ai-page-request';import {readTemplate} from '../src/core/ai-templates';import type {Chart} from '../src/core/chart-schema';
const unquote=(s:string)=>s.replace(/「[^」]*」|“[^”]*”/g,v=>' '.repeat(v.length));
const valueSchema=(s:any)=>s?.anyOf?.find((v:any)=>v.type!=='null')??s;
const pick=(object:any,keys:Set<string>)=>{object.properties=Object.fromEntries(Object.entries(object.properties).filter(([key])=>keys.has(key)));object.required=Object.keys(object.properties);return object;};
/** Exact data addresses compile against the live chart, never a model's copied array. */
export function requestedChartPatch(deck:Deck,page:PageRequirement,raw:Partial<Chart>={}):Partial<Chart>{
 const requirement=page.chart;if(!requirement)return raw;const current=readTemplate(deck.slides.find(s=>s.id===page.slideId)!).content.chart;if(!current)return raw;
 const patch={...raw};if(requirement.type)patch.type=requirement.type as Chart['type'];if(requirement.labels)patch.labels=[...requirement.labels];
 if(!requirement.allowSeriesChange&&(requirement.points.length||requirement.series.length)){
  patch.series=structuredClone(current.series);for(const series of patch.series){const complete=requirement.series.find(s=>s.name===series.name);if(complete)series.values=[...complete.values];for(const point of requirement.points.filter(p=>p.series===series.name)){const index=(patch.labels??current.labels).indexOf(point.label);if(index>=0)series.values[index]=point.value;}}
 }
 return patch;
}
/** Model-only schemas expose actual requested slots, while MCP keeps the full typed API. */
export function pageBatchModelSchema(deck:Deck,request:PageRequest,schema:any){
 const wire=structuredClone(schema),pageTemplate=wire.properties.pages.items;
 const pages=request.pages.map(p=>{const current=readTemplate(deck.slides.find(s=>s.id===p.slideId)!),intent=unquote(p.instruction),keys=new Set(['number']),copyChange=/(?:润色|重写|rewrite|reword)/i.test(intent);
  const copyIntent=intent.replace(/图表的?标题|副标题|小标题|chart title/gi,'secondary caption');
  if(copyChange||/(?:标题|heading|title)[^。；;\n]{0,16}(?:改为|改成|修改|缩短)|(?:修改|缩短|change|edit|update)[^。；;\n]{0,12}(?:标题|heading|title)/i.test(copyIntent))keys.add('heading');
  if(current.content.body!==undefined&&(copyChange||/(?:正文|副标题|body|subtitle)[^。；;\n]{0,16}(?:改为|改成|修改|缩短)|(?:修改|缩短|change|edit|update)[^。；;\n]{0,12}(?:正文|副标题|body|subtitle)/i.test(intent)))keys.add('body');
  if(current.content.items&&(copyChange||/(?:小标题|正文)[^。；;\n]{0,16}(?:改为|改成|修改)|(?:修改|更新|改成)[^。；;\n]{0,12}(?:条|三栏|小标题|items)|(?:三栏|三段|各项)/i.test(intent)))keys.add('items');
  if(p.layout||/(?:重排|reflow|改版式|调整布局)/i.test(intent))keys.add('layout');if(p.collection)keys.add('collection');if(p.density)keys.add('density');
  if(/(?:备注|讲稿|notes)[^。；;\n]{0,15}(?:改为|改成|修改|更新|清空)|(?:修改|补充|增加|更新)[^。；;\n]{0,15}(?:备注|讲稿|notes)/i.test(intent))keys.add('notes');
  if(p.styleArtwork||p.replaceArtwork)keys.add('assets');
  const chartKeys=new Set(p.chart?.editable??[]);if(p.chart&&!p.chart.allowSeriesChange&&(p.chart.points.length||p.chart.series.length))chartKeys.delete('series');if(p.chart?.labels)chartKeys.delete('labels');if(p.chart?.type)chartKeys.delete('type');if(chartKeys.size)keys.add('chart');
  const entry=pick(structuredClone(pageTemplate),keys);entry.properties.number={type:'integer',enum:[p.number]};
  if(entry.properties.layout&&p.layout)entry.properties.layout={type:'string',enum:[p.layout]};if(entry.properties.collection)entry.properties.collection={type:'string',enum:[p.collection]};if(entry.properties.density)entry.properties.density={type:'string',enum:[p.density]};
  if(entry.properties.chart){entry.properties.chart=pick(structuredClone(valueSchema(entry.properties.chart)),chartKeys);for(const [key,fields]of Object.entries(p.chart?.nested??{}))if(entry.properties.chart.properties[key])entry.properties.chart.properties[key]=pick(structuredClone(valueSchema(entry.properties.chart.properties[key])),new Set(fields));}
  return entry;
 });
 wire.properties.pages={type:'array',minItems:pages.length,maxItems:pages.length,items:pages.length===1?pages[0]:pages.length?{anyOf:pages}:pageTemplate};
 const deleted=request.deletedNumbers??[];if(deleted.length)wire.properties.deletePages={type:'array',minItems:deleted.length,maxItems:deleted.length,items:{type:'integer',enum:deleted}};else delete wire.properties.deletePages;
 const additions=request.additions??[];if(additions.length){const template=valueSchema(wire.properties.additions).items,variants=additions.map(a=>{const entry=pick(structuredClone(template),new Set(['afterNumber','layout','heading',...(a.collection?['collection']:[]),...(a.texts.length>1?['body']:[]),...(/(?:条|点|items)/i.test(a.instruction)?['items']:[]),...(/(?:图表|chart)/i.test(a.instruction)?['chart']:[])]));entry.properties.afterNumber={type:'integer',enum:[a.afterNumber]};if(a.layout)entry.properties.layout={type:'string',enum:[a.layout]};if(a.collection)entry.properties.collection={type:'string',enum:[a.collection]};return entry;});const count=additions.reduce((n,a)=>n+a.count,0);wire.properties.additions={type:'array',minItems:count,maxItems:count,items:variants.length===1?variants[0]:{anyOf:variants}};}else delete wire.properties.additions;
 wire.required=Object.keys(wire.properties);return wire;
}
