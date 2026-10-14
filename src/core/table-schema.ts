import {z} from 'zod';
const color=z.string().regex(/^(#[\da-fA-F]{6}|transparent)$/);
export const TABLE_PRESETS=['editorial','banded','grid','contrast'] as const;
export const TableStyleSchema=z.object({
  preset:z.enum(TABLE_PRESETS).optional(),headerRow:z.boolean().optional(),banded:z.boolean().optional(),
  borders:z.enum(['rows','grid','none']).optional(),padding:z.number().min(0).max(1000).optional(),borderWidth:z.number().min(0).max(100).optional(),
  numericAlign:z.boolean().optional(),verticalAlign:z.enum(['top','middle','bottom']).optional(),
  headerFill:color.optional(),headerText:color.optional(),bodyFill:color.optional(),stripeFill:color.optional(),lineColor:color.optional(),
  columnAlign:z.array(z.enum(['auto','left','center','right'])).max(20).optional(),columnWidths:z.array(z.number().positive().max(20000)).min(1).max(20).optional(),
  rowHeights:z.array(z.number().positive().max(20000)).min(1).max(100).optional(),
}).strict();
export type TableStyle=z.infer<typeof TableStyleSchema>;

export function scaleTableStyle(style:TableStyle|undefined,scale:number):TableStyle|undefined {
  if(!style)return undefined;
  return {...style,padding:(style.padding??14)*scale,borderWidth:(style.borderWidth??(style.preset&&style.preset!=='grid'?.6:.75))*scale};
}
