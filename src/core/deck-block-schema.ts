import {z} from 'zod';

export const BLOCK_IDS = ['architecture','process','organization','agenda','timeline','roadmap','gantt','kanban','comparison','swot','metrics','funnel'] as const;
export type BlockId = typeof BLOCK_IDS[number];
export const BlockOptionsSchema=z.object({
  title:z.string().max(160),
  items:z.array(z.object({label:z.string().trim().min(1).max(200),detail:z.string().max(2000),meta:z.string().max(100),parent:z.number().int().min(-1).max(11).optional()}).strict()).min(1).max(12),
  layout:z.enum(['auto','horizontal','vertical','grid']).default('auto'),
  tone:z.enum(['plain','surface','outline','accent']).default('surface'),
  density:z.enum(['comfortable','compact']).default('comfortable'),
  showTitle:z.boolean().default(true),
  showDetails:z.boolean().default(true),
  showMeta:z.boolean().default(true),
  numbered:z.boolean().default(true),
  stagger:z.boolean().default(false),
  periods:z.number().int().min(2).max(12).default(6),
  periodLabels:z.array(z.string().max(30)).max(12).default([]),
}).strict();
export type BlockOptions=z.infer<typeof BlockOptionsSchema>;
export type BlockInput=z.input<typeof BlockOptionsSchema>;
export const BlockRecipeSchema=z.object({kind:z.enum(BLOCK_IDS),options:BlockOptionsSchema,fingerprint:z.string().max(64),sizing:z.enum(['scaled','presentation']).optional()}).strict();

/** Keep validation useful in the editor instead of exposing serialized schema errors. */
export function blockErrorMessage(error:unknown):string {
  if(!(error instanceof z.ZodError))return error instanceof Error?error.message:'Check the block content.';
  const issue=error.issues[0],path=issue?.path??[];
  if(path[0]==='items'&&typeof path[1]==='number'){
    const field=path[2],name=field==='label'?'label':field==='detail'?'description':'date or value';
    if(issue.code==='too_small')return `Enter a ${name} for item ${path[1]+1}.`;
    if(issue.code==='too_big')return `Keep the ${name} for item ${path[1]+1} within ${issue.maximum} characters.`;
  }
  if(path[0]==='periodLabels')return typeof path[1]==='number'?`Keep period label ${path[1]+1} within 30 characters.`:'Use up to 12 period labels.';
  if(path[0]==='periods')return 'Enter a whole number of periods from 2 to 12.';
  if(path[0]==='title')return 'Keep the block title within 160 characters.';
  return 'Check the block content and item limits.';
}
