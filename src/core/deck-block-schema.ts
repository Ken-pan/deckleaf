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
export const BlockRecipeSchema=z.object({kind:z.enum(BLOCK_IDS),options:BlockOptionsSchema,fingerprint:z.string().max(64)}).strict();
