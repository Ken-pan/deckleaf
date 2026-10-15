import {validateChart,type Chart} from './chart-schema';
export type ChartTextTarget={kind:'title'|'subtitle'|'categoryTitle'|'valueTitle'|'source'|'category'|'series';index?:number};
export const chartTextLabel=(t:ChartTextTarget)=>({title:'Chart title',subtitle:'Chart subtitle',categoryTitle:'Category axis title',valueTitle:'Value axis title',source:'Chart source',category:'Category label',series:'Legend name'}[t.kind]);
export const chartTextValue=(c:Chart,t:ChartTextTarget)=>t.kind==='category'?c.labels[t.index??0]:t.kind==='series'?c.series[t.index??0]?.name:c[t.kind];
export function chartWithText(c:Chart,t:ChartTextTarget,value:string):Chart{
  if((t.kind==='category'||t.kind==='series')&&(!Number.isInteger(t.index)||t.index!<0||t.index!>=(t.kind==='category'?c.labels.length:c.series.length)))throw new Error('Choose an existing chart label.');
  const text=value.trim();
  return validateChart(t.kind==='category'?{...c,labels:c.labels.map((v,i)=>i===t.index?text:v)}:t.kind==='series'?{...c,series:c.series.map((s,i)=>i===t.index?{...s,name:text}:s)}:{...c,[t.kind]:text});
}
