import {editor} from './editor.svelte';
import {resourceOperation, validateResourceImport, MAX_RESOURCE_BATCH, type ResourceItem} from './resources';
import {readShelf, rememberResource} from './resource-shelf';
import type {SlideElement} from './model';
import type {InsertGeometry} from './insertion';

// Preparation and resource bookkeeping stay outside the initial editor bundle.
export function validatePlacementImages(images: SlideElement[]) {
  if(!editor.deck||!editor.slide)return;
  if(!images.length||images.length>MAX_RESOURCE_BATCH)throw new Error(`Select 1–${MAX_RESOURCE_BATCH} resources to place.`);
  validateResourceImport(editor.deck,images.map(image=>resourceOperation(editor.deck!,editor.slide!.id,image)));
}
export function placeResourceImage(image:SlideElement,geometry:InsertGeometry,revision:number,slideId:string,item?:ResourceItem): boolean {
  if(!editor.deck||editor.slide?.id!==slideId||editor.deck.revision!==revision)return false;
  const placed={...image,x:geometry.x,y:geometry.y,w:geometry.w,h:geometry.h};
  const operations=[resourceOperation(editor.deck,slideId,placed)];validateResourceImport(editor.deck,operations);
  editor.add(placed,revision);
  if(!editor.slide.elements.some(e=>e.id===image.id))return false;
  editor.selected=[image.id];
  if(item)try{localStorage.setItem('deck-studio-resource-recent',JSON.stringify(rememberResource(readShelf(localStorage.getItem('deck-studio-resource-recent'),40),item)));}catch{/* Source information is also saved with the placed object. */}
  return true;
}
