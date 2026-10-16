import type {Chart} from './chart-schema';
export const chartPresets=[{id:'clean',label:'Clean',hint:'Balanced charts for everyday use'},{id:'report',label:'Report',hint:'Clear values and subtle guides'},{id:'bold',label:'Bold',hint:'Strong marks for presentations'},{id:'minimal',label:'Minimal',hint:'Quiet marks with fewer labels'}] as const;
export type ChartPreset=typeof chartPresets[number]['id'];
export function chartPresetPatch(id:ChartPreset):Partial<Chart>{
  const report=id==='report',bold=id==='bold',minimal=id==='minimal';
  return {grid:!bold&&!minimal,showValues:report||bold,legend:!minimal,visual:{preset:id,cornerRadius:bold?6:report?0:4,lineWidth:bold?4:report||minimal?2:3,pointSize:minimal?0:bold?7:4,smooth:false,areaOpacity:bold?.22:.12,donutHole:bold?70:64}};
}
export function chartPresetMatches(chart:Chart,id:ChartPreset){
  const p=chartPresetPatch(id);return chart.grid===p.grid&&chart.showValues===p.showValues&&chart.legend===p.legend&&JSON.stringify(chart.visual)===JSON.stringify(p.visual);
}
export {formatChartValue} from './chart-format';
