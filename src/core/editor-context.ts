import {z} from 'zod';
export const EditorContextSchema=z.object({clientId:z.string().uuid(),deckId:z.string().min(1).max(120).nullable(),revision:z.number().int().min(0),activeSlideId:z.string().max(120).optional(),selectedIds:z.array(z.string().max(120)).max(3000),focused:z.boolean(),visible:z.boolean(),dirty:z.boolean(),sourceMode:z.boolean(),presenting:z.boolean(),pendingProposal:z.boolean()}).strict();
export type EditorContext=z.infer<typeof EditorContextSchema>;
