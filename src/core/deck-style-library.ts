import {COLLECTIONS} from './template-collections';
import { z } from 'zod';
import { DesignSystemSchema, TEXT_ROLES, type DesignSystem } from './design-system-schema';
import { cloneDocumentData, sameDocumentData } from './document-data';
import { contrastRatio, DESIGN_PRESETS } from './deck-design-system';

export type PresetScope = 'all' | 'colors' | 'fonts';
export const DOCUMENT_STYLE_PRESETS=[...COLLECTIONS.map(c=>c.system),...DESIGN_PRESETS.filter(system=>!COLLECTIONS.some(c=>c.system.name===system.name))];
const LibrarySchema=z.array(z.object({id:z.string().min(1).max(100),system:DesignSystemSchema}).strict()).max(24);
export type SavedDeckStyle=z.infer<typeof LibrarySchema>[number];
export const DECK_STYLE_LIBRARY_KEY='deck-studio-style-library-v1';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
export function readDeckStyleLibrary(storage:Storage):SavedDeckStyle[]{
  try{return LibrarySchema.parse(JSON.parse(storage.getItem(DECK_STYLE_LIBRARY_KEY)??'[]'));}catch{return [];}
}
export function saveDeckStyle(storage:Storage,items:SavedDeckStyle[],system:DesignSystem):SavedDeckStyle[]{
  system=DesignSystemSchema.parse(system);
  const existing=items.find(item=>item.system.name.toLowerCase()===system.name.toLowerCase());
  const next=LibrarySchema.parse([...items.filter(item=>item.id!==existing?.id),{id:existing?.id??crypto.randomUUID(),system}]);
  storage.setItem(DECK_STYLE_LIBRARY_KEY,JSON.stringify(next));return next;
}
export function removeDeckStyle(storage:Storage,items:SavedDeckStyle[],id:string):SavedDeckStyle[]{
  const next=LibrarySchema.parse(items.filter(item=>item.id!==id));storage.setItem(DECK_STYLE_LIBRARY_KEY,JSON.stringify(next));return next;
}
export function isPresetSelected(current:DesignSystem,preset:DesignSystem,scope:PresetScope):boolean {
  return scope==='colors'?sameDocumentData(current.colors,preset.colors):scope==='fonts'?TEXT_ROLES.every(role=>current.typography[role].fontFamily===preset.typography[role].fontFamily&&current.typography[role].fontWeight===preset.typography[role].fontWeight):sameDocumentData({...current,name:''},{...preset,name:''});
}
export function customizeStyleName(name:string):string{return DOCUMENT_STYLE_PRESETS.some(system=>system.name===name)?'Custom':name;}
export function mergeStylePreset(current:DesignSystem,preset:DesignSystem,scope:PresetScope):DesignSystem {
  if(scope==='all')return cloneDocumentData(preset);
  const next=cloneDocumentData({...current,name:customizeStyleName(current.name)});
  if(scope==='colors')next.colors=cloneDocumentData(preset.colors);
  else for(const role of TEXT_ROLES)next.typography[role]={...next.typography[role],fontFamily:preset.typography[role].fontFamily,fontWeight:preset.typography[role].fontWeight};
  return next;
}
/** Changes only failing text roles, with the smallest tested blend toward black or white. */
export function readableTextColor(foreground:string,background:string,target=4.5):string {
  if(contrastRatio(foreground,background)>=target)return foreground;
  const end=contrastRatio('#000000',background)>contrastRatio('#ffffff',background)?'#000000':'#ffffff';
  const blend=(amount:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(foreground.slice(i,i+2),16)*(1-amount)+parseInt(end.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
  // Integer RGB quantization is included in every contrast check.
  for(let n=1;n<=100;n++){const candidate=blend(n/100);if(contrastRatio(candidate,background)>=target)return candidate;}
  return end;
}
export function improveStyleContrast(system:DesignSystem):DesignSystem {
  const next=cloneDocumentData(system);
  next.colors.ink=readableTextColor(system.colors.ink,system.colors.background);
  next.colors.muted=readableTextColor(system.colors.muted,system.colors.background);
  next.colors.onDark=readableTextColor(system.colors.onDark,system.colors.dark);
  next.name=customizeStyleName(next.name);return next;
}
