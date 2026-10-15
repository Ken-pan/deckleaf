import {z} from 'zod';
const color=z.string().regex(/^(#[\da-fA-F]{6}|transparent)$/);
export const TABLE_PRESETS=['editorial','banded','grid','contrast'] as const;
const address={row:z.number().int().min(0).max(99),column:z.number().int().min(0).max(19)};
export const TableMergeSchema=z.object({...address,rowSpan:z.number().int().min(1).max(100),columnSpan:z.number().int().min(1).max(20)}).strict().refine(m=>m.rowSpan*m.columnSpan>1,'Merge at least two cells.');
export const TableCellStyleSchema=z.object({...address,fill:color.optional(),color:color.optional(),fontWeight:z.number().int().min(100).max(900).optional(),italic:z.boolean().optional(),align:z.enum(['left','center','right']).optional(),verticalAlign:z.enum(['top','middle','bottom']).optional()}).strict();
export type TableMerge=z.infer<typeof TableMergeSchema>;
export type TableCellStyle=z.infer<typeof TableCellStyleSchema>;
export const TableStyleSchema=z.object({
  preset:z.enum(TABLE_PRESETS).optional(),headerRow:z.boolean().optional(),banded:z.boolean().optional(),
  borders:z.enum(['rows','grid','none']).optional(),padding:z.number().min(0).max(1000).optional(),borderWidth:z.number().min(0).max(100).optional(),
  numericAlign:z.boolean().optional(),verticalAlign:z.enum(['top','middle','bottom']).optional(),
  headerFill:color.optional(),headerText:color.optional(),bodyFill:color.optional(),stripeFill:color.optional(),lineColor:color.optional(),
  columnAlign:z.array(z.enum(['auto','left','center','right'])).max(20).optional(),columnWidths:z.array(z.number().positive().max(20000)).min(1).max(20).optional(),
  rowHeights:z.array(z.number().positive().max(20000)).min(1).max(100).optional(),
  merges:z.array(TableMergeSchema).max(1000).optional(),cellStyles:z.array(TableCellStyleSchema).max(2000).optional(),
}).strict();
export type TableStyle=z.infer<typeof TableStyleSchema>;

export function validateTableStyle(cells:string[][],style:TableStyle|undefined){
  const rows=cells.length,columns=Math.max(0,...cells.map(r=>r.length)),occupied=new Set<string>(),styled=new Set<string>();
  for(const m of style?.merges??[]){
    if(m.row+m.rowSpan>rows||m.column+m.columnSpan>columns)throw new Error('Merged cells must stay inside the table.');
    for(let r=m.row;r<m.row+m.rowSpan;r++)for(let c=m.column;c<m.column+m.columnSpan;c++){const key=`${r}:${c}`;if(occupied.has(key))throw new Error('Merged cells cannot overlap.');occupied.add(key);}
  }
  for(const s of style?.cellStyles??[]){const key=`${s.row}:${s.column}`;if(s.row>=rows||s.column>=columns)throw new Error('Cell styles must stay inside the table.');if(styled.has(key))throw new Error('Choose one style per cell.');styled.add(key);}
}

export function scaleTableStyle(style:TableStyle|undefined,scale:number):TableStyle|undefined {
  if(!style)return undefined;
  return {...style,padding:(style.padding??14)*scale,borderWidth:(style.borderWidth??(style.preset&&style.preset!=='grid'?.6:.75))*scale};
}
