import {isThemedIllustration} from './resource-purpose';
import type {GraphicRecipe} from './graphic-recipe';
import type {Deck,SlideElement} from './model';
import type {EmbeddedResource} from './resources';

export function themedIllustrationColor(e:SlideElement):string|undefined {
  return e.type==='image'&&isThemedIllustration(e.resource)&&e.design?.fill==='accent'&&!e.sourceRegion&&e.fill.toLowerCase()!==e.resource?.color?.toLowerCase()?e.fill:undefined;
}
/** Preview uses the same source/pigment engine as full-resolution resource import. */
export function themedImagePreview(e:SlideElement):string|undefined {
  const color=themedIllustrationColor(e);
  if(!color||typeof location==='undefined')return e.src;
  const url=new URL('/api/resources/preview',location.href);url.searchParams.set('id',e.resource!.id);url.searchParams.set('color',color);if(e.resource?.graphicRecipe)url.searchParams.set('recipe',JSON.stringify(e.resource.graphicRecipe));return url.pathname+url.search;
}
export type ThemeArtworkLoader=(id:string,color:string,recipe?:GraphicRecipe)=>Promise<EmbeddedResource>;
const pending=new Map<string,Promise<EmbeddedResource>>();
export const loadThemeArtwork:ThemeArtworkLoader=(id,color,recipe)=>{
  const key=JSON.stringify([id,color,recipe??null]);let request=pending.get(key);
  if(!request){request=fetch('/api/resources/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,color,...(recipe?{graphicRecipe:recipe}:{})})}).then(async response=>{if(!response.ok)throw new Error('The illustration color could not be prepared. Try again.');return response.json() as Promise<EmbeddedResource>;}).catch(error=>{pending.delete(key);throw error;});pending.set(key,request);if(pending.size>64)pending.delete(pending.keys().next().value!);}
  return request;
};
/** Materialize a portable copy; neither original PNGs nor the source revision are modified. */
export async function prepareThemeArtwork(deck:Deck,load:ThemeArtworkLoader=loadThemeArtwork):Promise<Deck>{
  const entries=deck.slides.flatMap(s=>s.elements).filter(e=>themedIllustrationColor(e));
  if(!entries.length)return deck;
  const copies=new Map<string,EmbeddedResource>();
  const key=(e:SlideElement)=>JSON.stringify([e.resource?.id,e.fill,e.resource?.graphicRecipe??null]);
  await Promise.all([...new Map(entries.map(e=>[key(e),e])).values()].map(async e=>{
    const data=await load(e.resource!.id,e.fill,e.resource!.graphicRecipe);
    if(data.resource.id!==e.resource!.id||data.resource.color?.toLowerCase()!==e.fill.toLowerCase()||(e.resource!.originalSha256&&data.resource.originalSha256!==e.resource!.originalSha256))throw new Error('The illustration source has changed. Reopen the template to use its current artwork.');
    if(e.resource!.graphicRecipe&&JSON.stringify(e.resource!.graphicRecipe)!==JSON.stringify(data.resource.graphicRecipe))throw new Error('The graphic settings could not be preserved. Try again.');
    copies.set(key(e),data);
  }));
  return {...deck,slides:deck.slides.map(s=>({...s,elements:s.elements.map(e=>{const data=copies.get(key(e));return data&&themedIllustrationColor(e)?{...e,src:data.src,resource:{...e.resource!,color:e.fill}}:e;})}))};
}
