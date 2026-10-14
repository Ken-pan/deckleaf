import type {Deck} from './model';
import {applyDeckDesignSystem} from './deck-design-system';
import {TEXT_ROLES,type DesignSystem} from './design-system-schema';
import {cloneDocumentData} from './document-data';

/** A new template can reuse brand rules without copying the source document. */
export function styleTemplate(template:Deck,system?:DesignSystem,fontSource?:Pick<Deck,'fonts'|'onlineFonts'>):Deck{
  if(!system)return template;
  const families=new Set(TEXT_ROLES.map(role=>system.typography[role].fontFamily.toLowerCase()));
  const fonts=fontSource?.fonts?.filter(f=>families.has(f.family.toLowerCase()));
  const onlineFonts=fontSource?.onlineFonts?.filter(f=>families.has(f.family.toLowerCase()));
  const styled=applyDeckDesignSystem(template,system);
  return {...styled,...(fonts?.length?{fonts:cloneDocumentData(fonts)}:{}),...(onlineFonts?.length?{onlineFonts:cloneDocumentData(onlineFonts)}:{})};
}
