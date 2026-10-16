import type {Deck} from '../src/core/model';
import {validateAIProposal,type EditScope} from '../src/core/ai-editing';

/** Only a complete, unambiguous literal replacement bypasses text generation.
 * Scope, source/lock protection, revisions and application remain canonical. */
export function exactTextProposal(deck:Deck,prompt:string,scope:EditScope){
 const match=prompt.trim().match(/^(?:replace(?: exact)? text|replace)\s+["“]([^"”]{1,2000})["”]\s+with\s+["“]([^"”]{0,2000})["”][.!。]?$/i)
  ??prompt.trim().match(/^(?:将|把)(?:文字|文本)?\s*["“]([^"”]{1,2000})["”]\s*(?:替换为|改为)\s*["“]([^"”]{0,2000})["”][。.!]?$/);
 if(!match||match[1]===match[2])return;
 const targets=deck.slides.filter(slide=>scope.slideIds.includes(slide.id)).flatMap(slide=>slide.elements.filter(e=>e.type==='text'&&e.text===match[1]&&(!scope.elementIds.length||scope.elementIds.includes(e.id))).map(element=>({slide,element})));
 if(!targets.length)throw new Error('The quoted text was not found in the selected scope. Copy its current text or select the intended object.');
 if(targets.length>1)throw new Error('Several objects contain that exact text. Select the intended object before replacing it.');
 const {slide,element}=targets[0];
 return validateAIProposal(deck,{baseRevision:deck.revision,summary:'Replace the exact text',operations:[{op:'update_element',slideId:slide.id,elementId:element.id,patch:{text:match[2]}}]},scope).proposal;
}
