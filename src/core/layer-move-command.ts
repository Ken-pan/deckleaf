import type {Editor} from './editor.svelte';
import {layerMove,type LayerDrop} from './layer-move';
import {selectMovedLayers} from './moved-layer-selection';

/** Loaded only when a move is dropped; the editor captures its base before loading. */
export function moveLayers(editor:Editor,ids:string[],drop:LayerDrop,revision:number|undefined,slideId:string,deckId:string|undefined):boolean {
  if(!editor.deck||!editor.slide||editor.deck.id!==deckId||editor.activeId!==slideId||editor.deck.revision!==revision){editor.error='The document changed. Start the move again.';return false;}
  if(editor.sourceMode)return false;
  const plan=layerMove(editor.slide,ids,drop);if(plan.reason){editor.error=plan.reason;return false;}if(!plan.operations.length)return false;
  editor.commit(plan.operations,'','manual',revision);if(editor.deck.revision===revision)return false;
  selectMovedLayers(editor,plan.ids,plan.parent);return true;
}
