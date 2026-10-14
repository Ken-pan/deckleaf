import type {Chart} from './chart-schema';
export function templateChartCaption(c:Chart,kind:string):string{
 if(kind==='trend')return (c.forecastFrom!==undefined?`Solid: actual · Dashed: forecast from ${c.labels[c.forecastFrom]}`:'Actual series')+(c.source?' · '+c.source:'');
 if(kind==='composition'){const series=c.series[c.pieSeries??0];return `Whole: ${series.name} · Total ${c.prefix}${series.values.reduce((a,b)=>a+b,0)}${c.suffix}`+(c.source?' · '+c.source:'');}
 return c.source;
}
