import type {Deck} from './model';
import type {DesignSystem} from './design-system-schema';
import {applyDeckDesignSystem} from './deck-design-system';

/** Only the current page and its thumbnail neighbours need draft rendering. */
export function documentStylePreview(base:Deck,system:DesignSystem,index:number):Deck {
  const start=Math.max(0,index-1),visible=base.slides.slice(start,start+3);
  const styled=applyDeckDesignSystem({...base,slides:visible},system);
  const byId=new Map(styled.slides.map(slide=>[slide.id,slide]));
  return {...base,designSystem:styled.designSystem,slides:base.slides.map(slide=>byId.get(slide.id)??slide)};
}
