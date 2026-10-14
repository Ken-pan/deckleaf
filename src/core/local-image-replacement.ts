import {editor} from './editor.svelte';
import {resourceOperation, validateResourceImport} from './resources';
import type {SlideElement} from './model';
import type {ResourceReplacementOptions} from './resource-replacement';

export function replaceLocalImage(image: SlideElement, targetId: string, origin: {deckId:string;slideId:string;revision:number}, options?: ResourceReplacementOptions) {
  const deck = editor.deck;
  if (!deck || deck.id !== origin.deckId || editor.slide?.id !== origin.slideId || deck.revision !== origin.revision) throw new Error('The document has changed. Choose the image again.');
  const operations = [resourceOperation(deck, origin.slideId, image, targetId, options)];
  validateResourceImport(deck, operations);
  editor.commit(operations, '', 'manual', origin.revision);
  if (editor.deck?.revision === origin.revision) throw new Error(editor.error || 'The image could not be replaced. Try again.');
  editor.selected = [targetId];
  editor.notify('Image replaced');
}
