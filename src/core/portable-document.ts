import type {Deck} from './model';

/** Legacy metadata is preserved in storage but excluded from delivery and AI contexts. */
export function withoutSlideTitles(deck:Deck):Deck {return {...deck,slides:deck.slides.map(({title,...slide})=>slide)};}

/** Carry legacy template intent forward before dropping obsolete page metadata. */
export async function portableDeck(deck:Deck):Promise<Deck> {
 const portable=withoutSlideTitles(deck);
 if(!portable.templateCollection){const {deckTemplateCollection}=await import('./templates');portable.templateCollection=deckTemplateCollection(deck);}
 return portable;
}
