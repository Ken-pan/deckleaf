import { z } from 'zod';

export const COLOR_ROLES = ['background', 'ink', 'muted', 'accent', 'surface', 'line', 'dark', 'onDark'] as const;
export const TEXT_ROLES = ['title', 'heading', 'body', 'caption'] as const;
export const TYPE_PROPERTIES = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const;
export type ColorRole = typeof COLOR_ROLES[number];
export type TextRole = typeof TEXT_ROLES[number];
export type TypeProperty = typeof TYPE_PROPERTIES[number];
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const TypeStyleSchema = z.object({
  fontFamily: z.string().trim().min(1).max(100).regex(/^[^";{}<>\\]+$/),
  fontSize: z.number().min(4).max(200), fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().min(.5).max(4), letterSpacing: z.number().min(-30).max(50),
}).strict();
export const DesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colors: z.object({background:color,ink:color,muted:color,accent:color,surface:color,line:color,dark:color,onDark:color}).strict(),
  typography: z.object({title:TypeStyleSchema,heading:TypeStyleSchema,body:TypeStyleSchema,caption:TypeStyleSchema}).strict(),
  pattern: z.object({kind:z.enum(['none','dots','grid']),spacing:z.number().min(12).max(160),opacity:z.number().min(0).max(.3)}).strict(),
}).strict();
export const StyleBindingSchema = z.object({
  text: z.enum(TEXT_ROLES).optional(), textScale: z.number().positive().max(30).optional(),
  font: z.enum(TEXT_ROLES).optional(),
  fill:z.enum(COLOR_ROLES).optional(), stroke:z.enum(COLOR_ROLES).optional(),
  overrides:z.array(z.enum(TYPE_PROPERTIES)).max(5).optional(),
}).strict();
export type DesignSystem = z.infer<typeof DesignSystemSchema>;
export type StyleBinding = z.infer<typeof StyleBindingSchema>;

const typeStyle = (fontFamily:string,fontSize:number,fontWeight=400) => ({fontFamily,fontSize,fontWeight,lineHeight:1.25,letterSpacing:0});
export const DEFAULT_DESIGN_SYSTEM: DesignSystem = {
  name:'Editorial',
  colors:{background:'#f4f3ee',ink:'#26362c',muted:'#687168',accent:'#73856e',surface:'#e3e7db',line:'#c9cfc1',dark:'#26362c',onDark:'#eceee4'},
  typography:{title:typeStyle('Bodoni Moda',96),heading:typeStyle('Bodoni Moda',64),body:typeStyle('Manrope',32),caption:typeStyle('Manrope',20)},
  pattern:{kind:'none',spacing:40,opacity:.08},
};
