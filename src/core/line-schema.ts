import {z} from 'zod';
export const LineStyleSchema = z.object({
  route: z.enum(['straight','elbow','rounded','curve','arc','step','zigzag','wave']).default('straight'),
  dash: z.enum(['solid','dashed','dotted','short-dash','long-dash','dash-dot','dash-dot-dot']).default('solid'),
  start: z.enum(['none','arrow','open-arrow','stealth','circle','circle-outline','square','diamond','bar']).default('none'),
  end: z.enum(['none','arrow','open-arrow','stealth','circle','circle-outline','square','diamond','bar']).default('none'),
  cap: z.enum(['butt','round','square']).default('round'),
  markerSize: z.number().finite().min(1).max(6).default(1),
  bend: z.number().finite().min(.1).max(.9).default(.5),
}).strict();
export type LineStyle = z.infer<typeof LineStyleSchema>;
export const DEFAULT_LINE: LineStyle = LineStyleSchema.parse({});
