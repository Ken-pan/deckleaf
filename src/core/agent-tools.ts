import {z} from 'zod';
import {ElementSchema,type Deck,type SlideElement} from './model';

export const AgentBoxSchema=ElementSchema.pick({x:true,y:true,w:true,h:true}).required().strict();
export const AgentStyleSchema=ElementSchema.pick({fill:true,stroke:true,strokeWidth:true,fontFamily:true,fontSize:true,fontWeight:true,align:true,opacity:true,radius:true,italic:true}).partial().strict();
export const SimpleUpdatesSchema=z.object({baseRevision:z.number().int().min(0),summary:z.string().min(1).max(3000),recipeIds:z.array(z.string()).min(1).max(24).optional().describe('Include the prepared template/artwork recipe IDs when combining them with these object updates.'),updates:z.array(z.object({slideId:z.string(),elementId:z.string(),text:z.string().max(100000).optional(),box:AgentBoxSchema.optional(),style:AgentStyleSchema.optional()}).strict()).min(1).max(100)}).strict();
export const SimpleElementsSchema=z.object({slideId:z.string(),elements:z.array(z.object({type:z.enum(['text','rect','ellipse','diamond','line']),name:z.string().max(1000).optional(),text:z.string().max(100000).optional(),box:AgentBoxSchema,style:AgentStyleSchema.optional()}).strict()).min(1).max(24)}).strict();
export const SearchDocumentSchema=z.object({query:z.string().trim().min(1).max(160),kind:z.enum(['all','objects','notes']).optional(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(40).optional()}).strict();
const hit=z.object({slideId:z.string(),slideNumber:z.number(),kind:z.enum(['object','notes']),elementId:z.string().optional(),type:z.string().optional(),name:z.string().optional(),text:z.string(),locked:z.boolean().optional(),hidden:z.boolean().optional()});
export const SearchDocumentResultSchema=z.object({deckId:z.string(),revision:z.number(),items:z.array(hit),total:z.number(),nextOffset:z.number().nullable()});
export function searchDocument(deck:Deck,input:z.infer<typeof SearchDocumentSchema>,scope?:{slideIds:string[];elementIds:string[]}) {
 const query=input.query.normalize('NFKC').toLowerCase(),matches=(text:string)=>text.normalize('NFKC').toLowerCase().includes(query);
 const items:z.infer<typeof hit>[]=[];
 const excerpt=(text:string)=>{const index=text.normalize('NFKC').toLowerCase().indexOf(query);return text.slice(Math.max(0,index-40),Math.max(0,index-40)+220);};
 deck.slides.forEach((slide,index)=>{
  if(scope&&!scope.slideIds.includes(slide.id))return;
  if(input.kind!=='objects'&&!scope?.elementIds.length&&matches(slide.notes))items.push({slideId:slide.id,slideNumber:index+1,kind:'notes',text:excerpt(slide.notes)});
  if(input.kind==='notes')return;
  for(const e of slide.elements){if(scope?.elementIds.length&&!scope.elementIds.includes(e.id))continue;if([e.id,e.name,e.text].some(matches))items.push({slideId:slide.id,slideNumber:index+1,kind:'object',elementId:e.id,type:e.type,name:e.name,text:excerpt(e.text),locked:e.locked,hidden:e.hidden});}
 });
 const offset=input.offset??0,limit=input.limit??12;return {deckId:deck.id,revision:deck.revision,items:items.slice(offset,offset+limit),total:items.length,nextOffset:offset+limit<items.length?offset+limit:null};
}
export function simplePatch(input:{text?:string;box?:z.infer<typeof AgentBoxSchema>;style?:z.infer<typeof AgentStyleSchema>}):Partial<SlideElement>{const patch={...input.box,...input.style,...(input.text!==undefined?{text:input.text}:{})};if(!Object.keys(patch).length)throw new Error('Provide text, box or style to change this object.');return patch;}

export const ToolCategorySchema=z.enum(['all','editing','resources','templates','workflows']);
export const toolRoutes={
 editing:{when:'Build an editable story or change existing text, geometry or style.',tools:['propose_page_edits','prepare_story','search_document','read_deck','propose_updates','prepare_elements','prepare_arrangement','propose_prepared_edits','get_edit_schema','propose_edit'],start:'For multi-page text/layout/artwork changes, submit all current page numbers through propose_page_edits. Find IDs with search_document. Use propose_updates for common changes; get_edit_schema + propose_edit for advanced fields. Prepared helpers return recipeIds.'},
 resources:{when:'Find, replace or customize template/document fonts, photos, icons, illustrations, patterns and textures.',tools:['read_assets','search_fonts','get_resource_catalog','search_resources','prepare_asset_replacements','prepare_resource','prepare_element','propose_prepared_edits'],start:'Read assets to identify targets and current family. Search actual library IDs or reuse document artwork. Prepare_asset_replacements preserves frames and attribution in one recipe; omit resourceId to customize current artwork. Prepare_resource + prepare_element inserts new artwork. Propose recipes at the same revision.'},
 templates:{when:'Create template slides or source-preserving slide copies.',tools:['list_templates','read_template','prepare_template','prepare_template_update','prepare_duplicate_slide','propose_prepared_edits'],start:'Choose by reader task and evidence. Read live template fields before modifying content/layout/density; omitted fields remain unchanged. Prepare then propose recipes with the same revision.'},
 workflows:{when:'Import/export, present, connect accounts, publish or operate workspace controls.',tools:['get_workflow_capabilities','get_connection_status','list_workflows','get_workflow_status','request_import','request_export','request_presentation','request_account_connection','request_publish','request_workspace_action'],start:'Queue an action, keep its request ID, then inspect the receipt. File selection, sign-in and final Publish use the editor.'},
};
