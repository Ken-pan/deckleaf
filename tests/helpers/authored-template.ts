import {COLLECTIONS,createLayout,type CollectionId} from '../../src/core/templates';
import {newDeck} from '../../src/core/model';
import {applyDeckDesignSystem} from '../../src/core/deck-design-system';
import {refreshPageElements} from '../../src/core/page-elements';

/** An authored collection sequence, independent of the curated starter story. */
export function authoredTemplateDeck(id:CollectionId){
 const c=COLLECTIONS.find(c=>c.id===id)!;
 const deck=newDeck(c.title,c.legacyLayouts!.map((layout,i)=>createLayout(layout,i+1,c.id)));
 return refreshPageElements(applyDeckDesignSystem({...deck,templateCollection:c.id},c.system));
}
export function authoredPageIndex(id:CollectionId,layout:string){return COLLECTIONS.find(c=>c.id===id)!.legacyLayouts!.indexOf(layout as any);}
