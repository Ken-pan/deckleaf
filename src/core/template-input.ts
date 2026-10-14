import {templateBlockId} from './template-block-map';
import type {Slide} from './model';
import {TEMPLATE_PAGES} from './template-blueprints';
import {DEFAULT_DASHBOARD_ITEMS,editableTemplateBody,editableTemplateItems,type TemplateOptions} from './template-contracts';
import {delimitedRows} from './delimited-data';
import {validateChart,type Chart} from './chart-schema';

export type TemplateInput={heading:string;headingSeed:string;body:string;items:string;dates:string;data:string;source:string;unit:string;forecast:string;forecastSeed:string};
const tsv=(rows:string[][])=>rows.map(row=>row.map(s=>/["\t\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s).join('\t')).join('\n');
export function seedTemplateInput(collection:string,id:string,slide:Slide,options:TemplateOptions={}):TemplateInput {
  const p=TEMPLATE_PAGES[collection][id],chart=options.chart??slide.elements.find(e=>e.chart)?.chart,cells=options.cells??slide.elements.find(e=>e.type==='table')?.cells;
  const title=slide.elements.find(e=>e.type==='text'&&['title','heading'].includes(e.design?.text??'')&&e.y<286);
  const heading=options.heading??title?.text??p.heading;
  const recipe=slide.groups?.find(g=>g.block)?.block;
  const items=options.items??(recipe?recipe.options.items.map(i=>[i.label,id==='dashboard'?[i.meta,i.detail].filter(Boolean).join('\n'):i.detail] as [string,string]):undefined)??(id==='dashboard'?DEFAULT_DASHBOARD_ITEMS.slice(0,options.count??4):p.fields??p.columns??[]);
  const coverBody=id==='cover'?slide.elements.find(e=>e.type==='text'&&e.design?.text==='body'&&e.y>180&&!e.pageElement)?.text:undefined;
  const data=chart?tsv([['Category',...chart.series.map(s=>s.name)],...chart.labels.map((label,i)=>[label,...chart.series.map(s=>String(s.values[i]))])]):cells?tsv(cells):'';
  const forecast=chart?.forecastFrom===undefined?'':String(chart.forecastFrom);
  return {heading,headingSeed:heading,body:options.body??coverBody??p.body,items:tsv(items.map(([a,b])=>id==='dashboard'?[a,...b.split(/[\n\t]/)]:[a,b])),dates:(options.dates??(recipe?recipe.options.items.map(i=>i.meta):[])).join('\n'),data,source:options.source??chart?.source??'',unit:chart?.suffix??'',forecast,forecastSeed:forecast};
}
/** Parse first; a rejected draft never partially changes the preview or a document. */
export async function templateInputPatch(id:string,input:TemplateInput,options:TemplateOptions,chart?:Chart):Promise<TemplateOptions> {
  const patch:TemplateOptions={heading:options.heading===undefined&&input.heading===input.headingSeed?undefined:input.heading};
  if(editableTemplateBody(id))patch.body=input.body;
  if(editableTemplateItems(id)){
    const rows=delimitedRows(input.items,'\t',false,100,8).rows;
    if(!rows.length)throw new Error('Enter at least one item.');
    if(rows.some(r=>!r[0].trim()))throw new Error('Give each item a title.');
    patch.items=rows.map(([a,...b])=>[a.trim(),b.join(id==='dashboard'?'\t':' ').trim()]);
  }
  if(templateBlockId(id)&&!['dashboard','process','solution','team','hierarchy','architecture','kanban','swot'].includes(id)){
    const dates=input.dates.split('\n').map(s=>s.trim()).filter(Boolean);
    if(dates.length&&dates.length!==patch.items?.length)throw new Error(id==='timeline'?'Enter one date for each milestone.':'Enter one metadata value for each item.');
    patch.dates=dates.length?dates:undefined;
  }
  const tabular=['table','comparison','action-plan'].includes(id)||id==='evidence'&&!chart&&Boolean(input.data.trim());
  if(tabular)patch.cells=(await import('./object-data')).parseTableData(input.data);
  if(chart){
    const data=(await import('./charts')).parseChartData(input.data);let forecast=input.forecast===''?undefined:Number(input.forecast);
    if(forecast!==undefined&&(!Number.isInteger(forecast)||forecast<1||forecast>=data.labels.length)){
      if(options.chart?.forecastFrom===undefined&&input.forecast===input.forecastSeed)forecast=undefined;
      else throw new Error('Start the forecast after the first category and before the end.');
    }
    patch.chart=validateChart({...chart,...data,legend:data.series.length>1,source:input.source,suffix:input.unit,forecastFrom:forecast,axisRange:undefined});
  }
  if(templateBlockId(id))patch.source=input.source||'Add source, period and context';
  if(tabular)patch.source=input.source||({table:'Add source, period, and definitions',comparison:'Add evidence and rationale for the recommendation','action-plan':'Add sources or assumptions for this plan'} as Record<string,string>)[id]||'Add source and context for this evidence';
  return patch;
}
export function resetTemplateContent(options:TemplateOptions):TemplateOptions {
  const {heading,body,items,dates,cells,chart,source,...rest}=options;return rest;
}
