import { z } from 'zod';
import {COLOR_ROLES} from './design-system-schema';

export const CHART_TYPES = ['column', 'bar', 'line', 'area', 'pie', 'donut'] as const;
const label = z.string().trim().min(1).max(100);
export const ChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  labels: z.array(label).min(1).max(100),
  series: z.array(z.object({name: label, values: z.array(z.number().finite().min(-1e12).max(1e12)).min(1).max(100)}).strict()).min(1).max(8),
  title: z.string().max(200), subtitle: z.string().max(300), source: z.string().max(300),
  colors: z.array(z.string().regex(/^#[\da-fA-F]{6}$/)).min(1).max(8),
  textColor: z.string().regex(/^#[\da-fA-F]{6}$/),
  legend: z.boolean(), grid: z.boolean(), showValues: z.boolean(), stacked: z.boolean(),
  categoryTitle: z.string().max(80), valueTitle: z.string().max(80),
  prefix: z.string().max(12), suffix: z.string().max(12),
  visual:z.object({preset:z.enum(['clean','report','bold','minimal']).optional(),cornerRadius:z.number().min(0).max(16).optional(),lineWidth:z.number().min(1).max(8).optional(),pointSize:z.number().min(0).max(16).optional(),smooth:z.boolean().optional(),areaOpacity:z.number().min(0).max(1).optional(),donutHole:z.number().min(30).max(80).optional()}).strict().optional(),
  numberFormat:z.object({notation:z.enum(['standard','compact']).optional(),grouping:z.boolean().optional(),decimals:z.number().int().min(0).max(4).optional()}).strict().optional(),
  pieSeries: z.number().int().min(0).max(7).optional(),
  forecastFrom: z.number().int().min(1).max(99).optional(),
  adaptive: z.boolean().optional(),
  sourceDisplay:z.enum(['chart','caption']).optional(),
  colorRoles:z.array(z.enum(COLOR_ROLES)).min(1).max(8).optional(),
  axisRange:z.object({min:z.number().finite(),max:z.number().finite()}).strict().refine(v=>v.max>v.min,'The chart axis needs a positive range.').optional(),
}).strict();
export type Chart = z.infer<typeof ChartSchema>;

export function validateChart(value: unknown): Chart {
  const parsed = ChartSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === 'labels') throw new Error(`Category ${Number(issue.path[1]) + 1}: enter a name of up to 100 characters.`);
    if (issue.path[0] === 'series' && issue.path[2] === 'name') throw new Error(`Series ${Number(issue.path[1]) + 1}: enter a name of up to 100 characters.`);
    throw new Error(`Chart ${issue.path.join(' ')}: ${issue.message}`);
  }
  const chart = parsed.data;
  if (chart.series.some(s => s.values.length !== chart.labels.length)) throw new Error('Each series needs one number for every category.');
  if (new Set(chart.series.map(s => s.name)).size !== chart.series.length) throw new Error('Give each series a different name.');
  if (chart.pieSeries !== undefined && chart.pieSeries >= chart.series.length) throw new Error('Choose an existing series to display.');
  if (chart.type === 'pie' || chart.type === 'donut') {
    if (chart.series.length > 1 && chart.pieSeries === undefined) throw new Error('Choose one series to display in the pie or donut chart.');
    const series = chart.series[chart.pieSeries ?? 0];
    if (series.values.some(v => v < 0) || !series.values.some(v => v > 0)) throw new Error(`${series.name}: pie and donut charts need nonnegative values with a total greater than zero. Choose another series or chart type.`);
  }
  return chart;
}
