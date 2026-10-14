import {blankSlide,newDeck,type Deck} from './model';
import {type Operation,applyOperations,type Proposal} from './operations';
import {StorySchema,type CreationBrief} from './ai-story';
export async function createAIBase(collection:CreationBrief['collection']){
 const {COLLECTIONS}=await import('./template-collections');const system=COLLECTIONS.find(c=>c.id===collection)!.system;return {...newDeck('AI draft',[blankSlide()]),designSystem:structuredClone(system),templateCollection:collection};
}
/** AI authors content; the same native template builder owns composition and editable layout. */
export async function prepareStory(deck:Deck,raw:unknown):Promise<Operation[]>{
 const story=StorySchema.parse(raw);
 if(story.replaceBlank&&(deck.slides.length!==1||deck.slides[0].elements.length||deck.slides[0].source||deck.slides[0].groups?.length||deck.slides[0].autoLayouts?.length))throw new Error('Replace only a new empty draft. Existing content must stay intact.');
 const {deckTemplateCollection}=await import('./templates'),{authoredTemplatePages}=await import('./ai-templates');
 const collection=story.collection??deck.templateCollection??deckTemplateCollection(deck),styled=[];
 const themeChanged=story.replaceBlank&&collection!==deck.templateCollection;
 const effective=themeChanged?{...deck,designSystem:(await import('./template-collections')).COLLECTIONS.find(c=>c.id===collection)!.system,templateCollection:collection}:deck;
 for(const [index,input] of story.slides.entries()){
  const {layout,points,notes,...content}=input;
  try{styled.push(...await authoredTemplatePages(effective,layout,collection,{...content,...(points?.length?{items:points.map(p=>[p.heading,p.body])}:{})},index+1,notes));}catch(error){throw new Error(`Slide ${index+1} (${layout}): ${(error as Error).message} In prepare_story, items are supplied as points:[{heading,body}]. Keep the requested reader task and fix this slide's fields.`);}
 }
 let after=deck.slides.at(-1)!.id;const operations:Operation[]=[...(themeChanged?[{op:'set_design_system' as const,system:effective.designSystem!,adopt:true,templateCollection:collection}]:[]),...(story.replaceBlank?[{op:'rename_deck' as const,title:story.title}]:[]),...styled.map(slide=>{const op:Operation={op:'add_slide',slide,afterId:after,templateCollection:collection};after=slide.id;return op;})];if(story.replaceBlank)operations.push({op:'delete_slide',slideId:deck.slides[0].id});return operations;
}
export function creationPreview(base:Deck,proposal:Proposal,brief:CreationBrief):Deck{const result=applyOperations(base,proposal.operations,proposal.baseRevision,'ai');if(result.slides.length!==brief.slideCount)throw new Error(`The draft needs ${brief.slideCount} slides. Refine the brief and generate again.`);if(result.slides.some(s=>!s.template?.prototype||s.template.collection!==(brief.templateMode==='auto'?result.slides[0].template?.collection:brief.collection)))throw new Error('Use the selected native templates to create every page. Prepare authored content with prepare_story.');if(result.slides.some(s=>!s.elements.some(e=>e.type==='text'&&e.text.trim())))throw new Error('Every slide needs authored content. Generate the draft again.');return result;}
