import {z} from 'zod';
const key=z.string().regex(/^[a-z][a-z0-9-]{0,99}$/);
const hex=z.string().regex(/^#[\da-f]{6}$/i).transform(value=>value.toLowerCase());
export const CharacterRecipeSchema = z.object({
  characterId: key, sceneId: key, variantId: key,
  // Recipes already stored in documents keep their original rendering behavior.
  renderVersion: z.enum(['1', '2', '3']).default('1'),
  skinMode: z.enum(['classic', 'natural']).default('classic'), skinColor: hex.default('#e8bb98'),
  clothesColor: hex.default('#2f5bff'), hairColor: hex.default('#161616'), accentColor: hex.default('#2f5bff'),
}).strict().transform(recipe=>recipe.renderVersion==='3'?{...recipe,hairColor:'#161616',accentColor:recipe.clothesColor}:recipe);
export type CharacterRecipe = z.infer<typeof CharacterRecipeSchema>;
