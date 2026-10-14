import {z} from 'zod';
export const GraphicRecipeSchema=z.object({
  strength:z.number().finite().min(.25).max(2).default(1).transform(value=>Math.round(value*1000)/1000),
  scale:z.number().finite().min(.5).max(3).default(1).transform(value=>Math.round(value*1000)/1000),
  rotation:z.number().finite().min(0).max(180).default(0).transform(value=>Math.round(value*1000)/1000),
}).strict();
export type GraphicRecipe=z.infer<typeof GraphicRecipeSchema>;
