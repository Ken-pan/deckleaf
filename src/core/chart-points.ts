import type {Chart} from './chart-schema';
import {formatChartValue} from './chart-style';
export type ChartPoint={series:number;category:number};

export function chartPointFromRender(chart:Chart,renderSeries:number,category:number):ChartPoint|null{
  if(!Number.isInteger(renderSeries)||!Number.isInteger(category)||renderSeries<0||category<0||category>=chart.labels.length)return null;
  const round=chart.type==='pie'||chart.type==='donut',forecast=chart.forecastFrom!==undefined&&['line','area'].includes(chart.type);
  const series=round?chart.pieSeries??0:forecast?Math.floor(renderSeries/2):renderSeries;
  if(series>=chart.series.length||renderSeries>=(round?1:chart.series.length*(forecast?2:1)))return null;
  return {series,category};
}

/** Keep authored marks; editor-only line hit paths provide a usable pointer target. */
export function interactiveChartSvg(svg:string,chart:Chart):string{
  const line=chart.type==='line'||chart.type==='area';
  const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return svg.replace(/<path\b([^>]*\becmeta_data_index="(\d+)"[^>]*?)\s*(?:\/>|>\s*<\/path>)/g,(match,attributes:string,index:string)=>{
    const rendered=attributes.match(/\becmeta_series_index="(\d+)"/),point=rendered&&chartPointFromRender(chart,Number(rendered[1]),Number(index));
    if(!point)return match;
    const data=` data-chart-series="${point.series}" data-chart-category="${point.category}"`,name=escape(`${chart.series[point.series].name} · ${chart.labels[point.category]}: ${formatChartValue(chart,chart.series[point.series].values[point.category])}`);
    const target=` data-chart-point="true" role="button" tabindex="-1" aria-label="${name}"`;
    if(!line&&chart.series[point.series].values[point.category]!==0)return `<path${attributes}${data} data-chart-mark="true"${target}/>`;
    const hit=attributes.replace(/\s(?:fill|stroke|stroke-width|fill-opacity|stroke-opacity|opacity|class|style)="[^"]*"/g,'');
    return `<path${attributes}${data} data-chart-mark="true" data-chart-marker="true"/><path${hit}${data}${target} data-chart-line-hit="true" fill="transparent" stroke="transparent"/>`;
  });
}
