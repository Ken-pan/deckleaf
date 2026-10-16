import type {Story,CreationBrief} from '../src/core/ai-story';
import type {planCreation} from './ai-creation-plan';

/** Keep supplied text verbatim beside the relevant talking points. Never ask a
 * language model to be the sole custodian of operational rules or evidence. */
export function retainPlannedSources(story:Story,brief:CreationBrief,plan:Awaited<ReturnType<typeof planCreation>>|undefined){
 if(!plan)return;
 const label=/[\p{Script=Han}]/u.test(brief.brief)?'原始材料':'Source material';
 for(const page of plan.pages){
  const slide=story.slides[page.number-1];if(!slide)continue;
  const sources=page.sources.map(s=>s.text).filter(text=>!slide.notes?.includes(text));
  if(!sources.length)continue;
  const notes=[slide.notes,`${label}:\n${sources.join('\n')}`].filter(Boolean).join('\n\n');
  if(notes.length>30000)throw new Error(`Slide ${page.number}: shorten the spoken notes to leave room for its supplied source material. Do not omit source facts.`);
  slide.notes=notes;
 }
}
