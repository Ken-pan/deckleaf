import type {Deck} from './model';
import type {EditScope} from './ai-editing';
import type {Proposal} from './operations';
import {applyOperations} from './operations';
export type ArrangementIntent={slideId:string;elementIds:string[];axis:'x'|'y'};
/** Bind only explicit distribution requests with unambiguous object names/IDs. */
export function arrangementIntent(deck:Deck,prompt:string,scope:EditScope):ArrangementIntent[]{
 const result:ArrangementIntent[]=[];
 for(const clause of prompt.split(/[。；;\n]|\.(?:\s|$)/)){
  if(/(?:do not|don't|never|不要|不需|禁止)/i.test(clause)||!/(?:evenly\s+distribute|distribute.*evenly|均匀分布|等距分布)/i.test(clause))continue;
  const axis=/horizontal|水平|横向/i.test(clause)?'x':/vertical|垂直|纵向/i.test(clause)?'y':undefined;if(!axis)continue;
  for(const slide of deck.slides.filter(s=>scope.slideIds.includes(s.id))){
   const lower=clause.toLocaleLowerCase(),named=slide.elements.filter(e=>(e.name.trim().length>2&&lower.includes(e.name.toLocaleLowerCase()))||lower.includes(e.id.toLocaleLowerCase()));
   const selected=/selected|所选|选中/i.test(clause)?slide.elements.filter(e=>scope.elementIds.includes(e.id)):[];
   const ids=[...new Set([...named,...selected].map(e=>e.id))];if(ids.length>=3)result.push({slideId:slide.id,elementIds:ids,axis});
  }
 }
 return result;
}
export function validateArrangementIntent(deck:Deck,proposal:Proposal,intents:ArrangementIntent[]){
 if(!intents.length)return;const after=applyOperations(deck,proposal.operations,proposal.baseRevision,'ai');
 for(const intent of intents){const slide=after.slides.find(s=>s.id===intent.slideId),items=intent.elementIds.map(id=>slide?.elements.find(e=>e.id===id));
  if(items.some(e=>!e))throw new Error('Keep every object named in the distribution request.');
  const ordered=items.filter((e):e is NonNullable<typeof e>=>Boolean(e)).sort((a,b)=>a[intent.axis]-b[intent.axis]),size=intent.axis==='x'?'w':'h',gaps=ordered.slice(1).map((e,i)=>e[intent.axis]-(ordered[i][intent.axis]+ordered[i][size]));
  if(Math.max(...gaps)-Math.min(...gaps)>1)throw new Error(`The requested ${intent.axis==='x'?'horizontal':'vertical'} distribution is missing. Use prepare_arrangement with slideId:${intent.slideId}, elementIds:${JSON.stringify(intent.elementIds)}, action:distribute, axis:${intent.axis}, then include it with every other requested change.`);
 }
}

/** An explicit new-slide-only notes request must not rewrite existing notes. */
export function notesOnlyOnAddedSlides(prompt:string){
 if(/(?:original|existing|current|all)\s+(?:slides?|deck)[^.;\n]{0,25}(?:notes|speaker)|(?:notes|speaker notes)[^.;\n]{0,25}(?:original|existing|current|all)\s+(?:slides?|deck)|(?:原有|现有|所有)页[^。；\n]{0,15}(?:备注|讲稿)/i.test(prompt))return false;
 return /(?:each|every|all|the)\s+(?:new|added|newly added)\s+slides?[^.;\n]{0,16}(?:notes|speaker)|(?:notes|讲稿|备注)[^.;。；\n]{0,30}(?:only\s+(?:to|for|on)\s+(?:the\s+)?(?:new|added)|仅[^。；\n]{0,6}新增)|(?:仅|只)[^。；\n]{0,10}(?:新增|新加|新建)页[^。；\n]{0,20}(?:备注|讲稿)/i.test(prompt);
}
export function validateAddedSlideNotes(deck:Deck,proposal:Proposal){
 if(!proposal.operations.some(op=>op.op==='add_slide'))return;
 const after=applyOperations(deck,proposal.operations,proposal.baseRevision,'ai');
 if(deck.slides.some(s=>{const next=after.slides.find(n=>n.id===s.id);return next&&next.notes!==s.notes;}))throw new Error('Speaker notes were requested only for added slides. Keep every original slide’s notes unchanged. Put new notes in the added slide content and omit existing-slide note updates. Preserve the other requested changes.');
}
