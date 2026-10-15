import { z } from 'zod';
import {COLOR_ROLES} from './design-system-schema';

export const CHART_TYPES = ['column', 'bar', 'line', 'area', 'pie', 'donut'] as const;
const label = z.string().trim().min(1).max(100);
const color=z.string().regex(/^#[\da-fA-F]{6}$/),flag=z.boolean();
const number=(min:number,max:number)=>z.number().min(min).max(max).optional();
const optionalFlag=flag.optional(),text=(max:number)=>z.string().max(max);
export const ChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  labels: z.array(label).min(1).max(100),
  series: z.array(z.object({name: label, values: z.array(z.number().finite().min(-1e12).max(1e12)).min(1).max(100)}).strict()).min(1).max(8),
  title: text(200), subtitle: text(300), source: text(300),
  colors: z.array(color).min(1).max(8),
  textColor: color,
  legend: flag, grid: flag, showValues: flag, stacked: flag,
  categoryTitle: text(80), valueTitle: text(80),
  prefix: text(12), suffix: text(12),
  visual:z.object({preset:z.enum(['clean','report','bold','minimal']).optional(),cornerRadius:number(0,16),lineWidth:number(1,8),pointSize:number(0,16),smooth:optionalFlag,areaOpacity:number(0,1),donutHole:number(30,80)}).strict().optional(),
  numberFormat:z.object({notation:z.enum(['standard','compact']).optional(),grouping:optionalFlag,decimals:z.number().int().min(0).max(4).optional()}).strict().optional(),
  legendPosition:z.enum(['auto','top','right','bottom','left']).optional(),
  axisStyle:z.object({fontSize:number(12,40),rotation:number(-90,90),showLabels:optionalFlag}).strict().optional(),
  dataLabels:z.object({position:z.enum(['auto','inside','outside']).optional(),fontSize:number(10,48),color:color.optional(),bold:optionalFlag}).strict().optional(),
  pieSeries: z.number().int().min(0).max(7).optional(),
  forecastFrom: z.number().int().min(1).max(99).optional(),
  adaptive: optionalFlag,
  sourceDisplay:z.enum(['chart','caption']).optional(),
  colorRoles:z.array(z.enum(COLOR_ROLES)).min(1).max(8).optional(),
  axisRange:z.object({min:z.number().finite(),max:z.number().finite()}).strict().refine(v=>v.max>v.min,'Max must exceed min.').optional(),
}).strict();
export type Chart = z.infer<typeof ChartSchema>;

export function validateChart(value: unknown): Chart {
  const parsed = ChartSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === 'labels'||issue.path[0] === 'series'&&issue.path[2] === 'name') throw new Error(`${issue.path[0]==='labels'?'Category':'Series'} ${Number(issue.path[1])+1}: use 1–100 characters.`);
    throw new Error(`Chart ${issue.path.join(' ')}: ${issue.message}`);
  }
  const chart = parsed.data;
  if (chart.series.some(s => s.values.length !== chart.labels.length)) throw new Error('Match one number to each category.');
  if (new Set(chart.series.map(s => s.name)).size !== chart.series.length) throw new Error('Use unique series names.');
  if (chart.pieSeries !== undefined && chart.pieSeries >= chart.series.length) throw new Error('Choose an existing series.');
  if (chart.type === 'pie' || chart.type === 'donut') {
    if (chart.series.length > 1 && chart.pieSeries === undefined) throw new Error('Choose one series for pie or donut.');
    const series = chart.series[chart.pieSeries ?? 0];
    if (series.values.some(v => v < 0) || !series.values.some(v => v > 0)) throw new Error(`${series.name}: use nonnegative values with total greater than zero.`);
  }
  return chart;
}
