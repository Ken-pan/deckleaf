import {blankSlide,newDeck,type Deck} from './model';
import {type Operation,applyOperations,type Proposal} from './operations';
import {StorySchema,type CreationBrief} from './ai-story';
import {inlineTextWidth} from './inline-text-width';
import {reviewPresentation} from './presentation-review';
import {resolveSlideTextSizing,type TextSizeMeasure} from './text-layout';
import {templateSignature} from './template-ownership';
import {slideTextSize as creationTextSize,reviewSlideFit} from './slide-fit';
export async function createAIBase(collection:CreationBrief['collection']){
 const {COLLECTIONS}=await import('./template-collections');const system=COLLECTIONS.find(c=>c.id===collection)!.system;return {...newDeck('AI draft',[blankSlide()]),designSystem:structuredClone(system),templateCollection:collection};
}
/** AI authors content; the same native template builder owns composition and editable layout. */
export async function prepareStory(deck:Deck,raw:unknown):Promise<Operation[]>{
 const story=StorySchema.parse(raw);
 if(story.replaceBlank&&(deck.slides.length!==1||deck.slides[0].elements.length||deck.slides[0].source||deck.slides[0].groups?.length||deck.slides[0].autoLayouts?.length))throw new Error('Replace only a new empty draft. Existing content must stay intact.');
 const {deckTemplateCollection}=await import('./templates'),{authoredTemplatePages}=await import('./ai-templates');
 const collection=story.collection??deck.templateCollection??deckTemplateCollection(deck),styled=[],issues:string[]=[];
 const themeChanged=story.replaceBlank&&collection!==deck.templateCollection;
 const effective=themeChanged?{...deck,designSystem:(await import('./template-collections')).COLLECTIONS.find(c=>c.id===collection)!.system,templateCollection:collection}:deck;
 for(const [index,input] of story.slides.entries()){
  const {layout,points,notes,...content}=input;
  try{if(story.replaceBlank&&content.body&&['content','insights','team','process','solution','timeline','summary','appendix','case-study','table','comparison','category-chart','trend','composition','decision','action-plan','architecture','hierarchy','gantt','workstreams','kanban','swot','funnel','roadmap','dashboard'].includes(layout)&&inlineTextWidth(content.body,24,effective.designSystem?.typography.body.fontFamily??'Inter')>436*3)throw new Error(`Slide ${index+1} (${layout}): body is too long for the introductory column and would create extra pages instead of one. Shorten the body field to one sentence under 100 characters; preserve its full explanation in speaker notes. The point fields are not the cause of this error.`);
  const pages=await authoredTemplatePages(effective,layout,collection,{...content,...(points?.length?{items:points.map(p=>[p.heading,p.body])}:{})},index+1,notes);if(story.replaceBlank&&pages.length!==1)throw new Error(`This content creates ${pages.length} pages instead of one. Shorten point headings and descriptions, or choose a layout that fits these ${points?.length??content.cells?.length??0} entries. Preserve supporting detail in speaker notes. Do not add extra story slides or change the requested total.`);styled.push(...pages);}catch(error){issues.push(`Slide ${index+1} (${layout}): ${(error as Error).message} ${content.block?'Keep block.items with its supplied parent/meta/period fields; try block.layout:horizontal for deep trees.':'In prepare_story, items are supplied as points:[{heading,body}].'} Keep the requested reader task and fix this slide's fields.`);}
 }
 if(issues.length)throw new Error(issues.join('\n'));
 let after=deck.slides.at(-1)!.id;const operations:Operation[]=[...(themeChanged?[{op:'set_design_system' as const,system:effective.designSystem!,adopt:true,templateCollection:collection}]:[]),...(story.replaceBlank?[{op:'rename_deck' as const,title:story.title}]:[]),...styled.map(page=>{const slide=resolveSlideTextSizing(page,effective,creationTextSize);for(const e of slide.elements){const before=page.elements.find(original=>original.id===e.id);if(e.design?.text&&before&&e.fontSize!==before.fontSize)e.design={...e.design,textScale:(e.design.textScale??1)*e.fontSize/before.fontSize};}if(slide.template)slide.template={...slide.template,generated:slide.elements.map(e=>({id:e.id,signature:templateSignature(e)}))};const op:Operation={op:'add_slide',slide,afterId:after,templateCollection:collection};after=slide.id;return op;})];if(story.replaceBlank)operations.push({op:'delete_slide',slideId:deck.slides[0].id});return operations;
}
/** Headless estimates are conservative; browsers use the actual paragraph measure. */
export function creationFitIssues(deck:Deck,measure:TextSizeMeasure=creationTextSize){return reviewSlideFit(deck,undefined,measure).issues.map(issue=>issue.message);}
export function creationPreview(base:Deck,proposal:Proposal,brief:CreationBrief):Deck{const result=applyOperations(base,proposal.operations,proposal.baseRevision,'ai');if(result.slides.length!==brief.slideCount)throw new Error(`The draft needs ${brief.slideCount} slides. Keep exactly that many output pages. If native layouts create continuations, shorten visible copy or redistribute it into notes or other requested pages without dropping supplied facts.`);if(result.slides.some(s=>!s.template?.prototype||s.template.collection!==(brief.templateMode==='auto'?result.slides[0].template?.collection:brief.collection)))throw new Error('Use the selected native templates to create every page. Prepare authored content with prepare_story.');if(result.slides.some(s=>!s.elements.some(e=>e.type==='text'&&e.text.trim())))throw new Error('Every slide needs authored content. Generate the draft again.');
 const fit=creationFitIssues(result);if(fit.length)throw new Error(`Revise the composed slide layout: ${fit.slice(0,4).join(' ')} Preserve the page count and all source facts; do not shrink text to hide the problem.`);
 if(brief.delivery==='presentation'){const issues=reviewPresentation(result).issues.filter(i=>i.code==='small-type'||i.code==='outside');if(issues.length)throw new Error(`Revise the composed presentation: ${issues.slice(0,4).map(i=>`Slide ${i.number}: ${i.message}`).join(' ')} Preserve facts and relationships. Move supporting detail into notes or use a simpler composition without adding slides.`);}
 return result;}
