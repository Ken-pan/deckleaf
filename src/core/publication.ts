import {validateDeck,type Deck} from './model';

/** Build a public presentation without carrying the private import archive. */
export function publicationDocument(deck:Deck,includeNotes=false):Deck {
 const result=structuredClone(deck);
 delete result.googleSource;delete result.nativeSource;delete result.provenance;
 for(const slide of result.slides){
  if(!includeNotes)slide.notes='';
  slide.elements=slide.elements.filter(element=>!element.hidden);
  const visible=new Set(slide.elements.map(element=>element.id));
  for(const group of slide.groups??[])visible.add(group.id);
  for(const layout of slide.autoLayouts??[])layout.order=layout.order.filter(id=>visible.has(id));
  // Source renders are needed only for visible, clipped source regions.
  if(slide.source){if(slide.elements.some(element=>element.sourceRegion)&&slide.source.render)slide.source={provider:slide.source.provider,render:slide.source.render,fidelity:slide.source.fidelity,warnings:[]};else delete slide.source;}
 }
 return validateDeck(result);
}
