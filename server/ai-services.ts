import {searchResources,resourceCatalog,loadResource} from './resources';
import {photoProviders} from './photo-providers';
import {characterEmbedded} from './characters';
import type {EditingServices} from '../src/core/ai-tools';
export const editingServices:EditingServices={
  searchResources,resourceCatalog,
  async importResource(input){
    if(input.id.startsWith('unsplash:'))return photoProviders.importUnsplash(input.id);
    if(input.characterRecipe&&input.id.startsWith('character:'))return characterEmbedded(input.characterRecipe);
    const data=await loadResource(input.id,input.color,false,input.graphicRecipe);
    return {src:`data:${data.type};base64,${data.bytes.toString('base64')}`,resource:data.resource};
  },
};
