import {z} from 'zod';
export const StoryCollectionSchema=z.enum(['portfolio','review','proposal','pitch','report','minimal']);
export const CreationBriefSchema=z.object({brief:z.string().trim().min(1).max(10000),audience:z.string().max(300).default(''),goal:z.string().max(500).optional(),delivery:z.enum(['presentation','reading']).optional(),slideCount:z.number().int().min(2).max(12),collection:StoryCollectionSchema,templateMode:z.enum(['auto','fixed']).optional(),materials:z.string().max(20000).default('')}).strict();
export type CreationBrief=z.infer<typeof CreationBriefSchema>;
