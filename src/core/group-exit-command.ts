import type {Editor} from './editor.svelte';
import {groupExitOptions} from './group-exit';
import {selectMovedLayers} from './moved-layer-selection';

export function exitGroup(editor:Editor,toSlide:boolean,ids:string[],scope:string,revision:number|undefined,slideId:string,deckId:string|undefined):boolean {
  if(!editor.deck||!editor.slide||editor.deck.id!==deckId||editor.activeId!==slideId||editor.deck.revision!==revision||editor.selected.join(',')!==ids.join(',')||editor.selectionScope!==scope){editor.error='The selection changed. Select the objects and try again.';return false;}
  if(editor.sourceMode)return false;
  const options=groupExitOptions(editor.slide,ids,scope),plan=toSlide?options.slide:options.out;
  if(!options.available)return false;
  if(plan.reason){editor.error=plan.reason;return false;}
  if(!plan.operations.length)return false;
  editor.commit(plan.operations,'','manual',revision);
  if(editor.deck.revision===revision)return false;
  selectMovedLayers(editor,plan.ids,plan.parent);
  const name=plan.parent?editor.slide.autoLayouts?.find(l=>l.id===plan.parent)?.name??editor.slide.groups?.find(g=>g.id===plan.parent)?.name??'group':'Slide';
  editor.notify(`Moved to ${name}`);return true;
}
