import {z} from 'zod';
import {EDIT_OPERATIONS, EDITING_GUIDE, EditMedia, editSchema, readAIContext, validateAIProposal, type EditScope} from './ai-editing';
import {type Deck, ElementSchema, element, uid} from './model';
import {type Operation} from './operations';
import {searchFonts} from './fonts';
import {alignElements,distributeElements} from './arrangement-operations';
import {moveElements} from './operations';
import {createGroupLayout,groupElements} from './group-commands';
import {type ResourcePage, type EmbeddedResource} from './resources';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {SimpleUpdatesSchema,SimpleElementsSchema,SearchDocumentSchema,SearchDocumentResultSchema,ToolCategorySchema,toolRoutes,searchDocument,simplePatch} from './agent-tools';
import {ChartSchema} from './chart-schema';
import {StorySchema} from './ai-story';
import {TemplateContentSchema} from './ai-story';
import {TemplateUpdateSchema,templateCatalog,readTemplate,prepareTemplateUpdate,authoredTemplatePages} from './ai-templates';
import {ReadAssetsSchema,ReplaceAssetsSchema,readAssets,prepareAssetReplacements} from './ai-assets';

export type EditingServices = {
  searchResources:(params:URLSearchParams)=>Promise<ResourcePage>;
  importResource:(input:{id:string;color?:string;graphicRecipe?:unknown;characterRecipe?:unknown})=>Promise<EmbeddedResource>;
  resourceCatalog:()=>Promise<unknown>;
};
export type AITool = {name:string;description:string;schema:z.AnyZodObject;openWorld?:boolean;title?:string;outputSchema?:z.AnyZodObject;run:(args:any)=>Promise<unknown>};
const ids=z.array(z.string()).max(3000);
const json=z.string().max(2_000_000);
const parse=(value:string)=>{try{return JSON.parse(value);}catch{throw new Error('Invalid JSON. Supply one JSON object without Markdown fences.');}};
export function editingToolkit(getDeck:()=>Promise<Deck>, services?:EditingServices, scope?:EditScope, media=new EditMedia()) {
  const recipes=new Map<string,{baseRevision:number;operations:Operation[]}>();
  const readable=async()=>{const deck=await getDeck();return deck;};
  const remember=(operations:Operation[],baseRevision:number)=>{
    if(!operations.length)throw new Error('These objects do not need that change.');
    if(recipes.size>=24)throw new Error('Too many prepared edits. Submit the current proposal first.');
    const recipeId=uid('recipe'); recipes.set(recipeId,{operations,baseRevision});
    return {recipeId,baseRevision,changes:operations.length,instruction:'Finish with propose_prepared_edits using this recipeId in recipeIds. Do not copy prepared additions into another proposal. adjustmentsJson is only for separate updates, or omit it. Nothing is applied yet.',
      slides:operations.flatMap(op=>op.op==='add_slide'?[{id:op.slide.id,objects:op.slide.elements.map(e=>({id:e.id,type:e.type,name:e.name,text:e.text.slice(0,120)}))}]:[])};
  };
  const restrict=(deck:Deck,slideIds?:string[],elementIds?:string[])=>{
    if(scope&&slideIds?.some(id=>!scope.slideIds.includes(id)))throw new Error('Read only slides inside the selected scope.');
    if(scope?.elementIds.length&&elementIds?.some(id=>!scope.elementIds.includes(id)))throw new Error('Read only objects inside the selected scope.');
    return {slideIds:slideIds?.length?slideIds:scope?.slideIds,elementIds:elementIds?.length?elementIds:scope?.elementIds};
  };
  const tools:AITool[]=[
    {name:'get_capabilities',description:'Discover every supported editing operation, helper and editor workflow. Read this before choosing unfamiliar tools. No document mutation.',schema:z.object({category:ToolCategorySchema.optional(),detail:z.enum(['brief','full']).optional()}).strict(),run:async({category='all',detail='brief'})=>({
      operations:EDIT_OPERATIONS,guide:detail==='full'?EDITING_GUIDE:'Read IDs and revision. Propose one scoped atomic change for review. Keep locked/source content and credentials protected. Queue native actions separately and check their receipts.',guideResource:'deck-studio://guide',routes:category==='all'?toolRoutes:{[category]:toolRoutes[category as keyof typeof toolRoutes]},
      editing:['rich text and paragraphs','shapes and shadows','image crop and resource replacement','editable tables and charts','prototype share links','nested containers and auto layout','object ordering and visibility','slide structure','speaker notes','transitions and object animations','design system and local overrides','headers, footers and page numbers','local and online font registration'],
      helpers:['prepare_story','prepare_element','read_assets','search_resources','prepare_resource','prepare_asset_replacements','search_fonts','list_templates','read_template','prepare_template','prepare_template_update','prepare_arrangement','prepare_duplicate_slide'],
      workflowTools:'get_workflow_capabilities and request_import/export/presentation/account_connection/publish/workspace_action',workflows:[{name:'Import PowerPoint, PDF, Keynote, Figma or Google Slides',entry:'Document menu → Import',requirement:'User-selected file or connected source; source fidelity requires review.'},{name:'Export PowerPoint, PDF, HTML, Keynote, Google Slides or Broadser',entry:'Export',requirement:'Accepted document; native/cloud availability is shown in the export panel.'},{name:'Present, presenter view, timing and source comparison',entry:'Present or Source reference',requirement:'Editor view action; never a document edit.'},{name:'History, undo, redo, local documents and settings',entry:'Document menu or Settings',requirement:'Editor owns application, recovery and credentials.'}],
      contract:{atomic:true,reviewable:true,undoable:true,scope:scope??'entire saved document',media:'Opaque local references. Byte payloads never enter model context.'}})},
    {name:'read_deck',description:'Read current revision and stable IDs. Outline is small; content can be paged and narrowed by slide/object IDs. Images and fonts stay local.',schema:z.object({detail:z.enum(['outline','content']).optional(),slideIds:ids.optional(),elementIds:ids.optional(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(40).optional()}),run:async args=>{const deck=await readable();return readAIContext(deck,media,{...args,...restrict(deck,args.slideIds,args.elementIds)});}},
    {name:'read_assets',title:'Find replaceable artwork',description:'Inspect existing template/document icons, illustrations, photos, patterns and textures: actual object/resource IDs, purpose, frame, current color/recipes, library filters, license and replacement restrictions. Scoped and paginated; no media bytes. Use before replacing or recoloring assets.',schema:ReadAssetsSchema,run:async input=>{const deck=await readable();return readAssets(deck,{...input,...restrict(deck,input.slideIds,input.elementIds)},scope);}},
    {name:'prepare_asset_replacements',title:'Prepare artwork replacements',description:'Replace or customize 1–12 existing image objects in one revision-bound recipe. Read_assets first, search_resources for actual resourceId (never invent IDs), or reuse document artwork with sourceSlideId/sourceElementId. Omit resourceId to recolor/customize the current library asset. color inherits the current asset; graphic sets strength/scale/rotation for patterns/textures/accents. characterRecipeJson preserves existing variant settings. Auto fit keeps icons/illustrations proportional, photo crops in their frame and patterns filling a region. Replacements preserve IDs, frames, grouping, motion and source attribution; new artwork resets the previous crop. Locked/source regions reject. Finish with propose_prepared_edits for preview/apply/undo; no document mutation.',openWorld:true,schema:ReplaceAssetsSchema,run:async input=>{const deck=await readable();for(const item of input.replacements){restrict(deck,[item.slideId],[item.elementId]);if(item.sourceSlideId&&item.sourceElementId)restrict(deck,[item.sourceSlideId],[item.sourceElementId]);}const {operations,...details}=await prepareAssetReplacements(deck,input,services);validateAIProposal(deck,{baseRevision:deck.revision,summary:'Replace document artwork',operations},scope);const {validateResourceImport}=await import('./resources');validateResourceImport(deck,operations);return {...remember(operations,deck.revision),...details};}},
    {name:'get_edit_schema',description:'Read the canonical JSON schema for one operation. Covers all manual editing fields. Omit optional fields you are not changing.',schema:z.object({operation:z.enum(EDIT_OPERATIONS as [string,...string[]]),fields:z.array(z.string()).min(1).max(20).optional()}),run:async({operation,fields})=>{const schema:any=editSchema(operation);if(fields){const target=schema.properties?.patch??schema.properties?.element??schema;const keys=Object.keys(target.properties??{});if(fields.some((field:string)=>!keys.includes(field)))throw new Error('Unknown schema field. Available fields: '+keys.join(', '));const keep=new Set([...fields,...target.required??[]]);target.properties=Object.fromEntries(Object.entries(target.properties).filter(([key])=>keep.has(key)));}return schema;}},
    {name:'prepare_element',description:'Create text, shapes, images, tables, charts or prototypes using manual editor defaults and a new stable ID. Supply propertiesJson with only authored properties such as text,x,y,w,h,fontSize,cells,chart,src,resource. Returns a recipe; never applies it. Prefer this over echoing a full add_element schema.',schema:z.object({slideId:z.string(),type:ElementSchema.shape.type,propertiesJson:json}),run:async({slideId,type,propertiesJson})=>{
      const deck=await readable();restrict(deck,[slideId]);if(scope?.elementIds.length)throw new Error('Choose This slide to add an object.');
      const properties=ElementSchema.omit({id:true,type:true}).partial().strict().parse(media.hydrate(parse(propertiesJson)));
      const created=element(type,properties),operations:Operation[]=[{op:'add_element',slideId,element:created}];
      validateAIProposal(deck,{baseRevision:deck.revision,summary:'Prepared object',operations},scope);
      return {...remember(operations,deck.revision),object:{id:created.id,type:created.type,name:created.name,text:created.text,x:created.x,y:created.y,w:created.w,h:created.h}};
    }},
    {name:'search_fonts',description:'Find installed library fonts and imported document families, with supported weights and Chinese coverage. Font bytes stay local.',schema:z.object({query:z.string().max(120),category:z.enum(['all','sans','serif','display','mono','handwriting']).optional(),language:z.string().max(30).optional(),offset:z.number().int().min(0).optional()}),run:async args=>{const deck=await readable(),all=searchFonts(args.query,args.category??'all',args.language??'all');const offset=args.offset??0;return {items:all.slice(offset,offset+20).map(({family,category,weights,chinese})=>({family,category,weights,chinese})),nextOffset:offset+20<all.length?offset+20:null,documentFonts:deck.fonts?.map(({family,weight,style})=>({family,weight,style})),onlineFonts:deck.onlineFonts};}},
    {name:'list_templates',description:'Discover native template families, reader tasks and authored-content inputs. Match parallel findings to insights, sequences to process, dates to timeline, actual data to charts/tables. Sample evidence must never fill a slide. Query matches layout ID, name and task.',schema:z.object({collection:z.string().max(40).optional(),query:z.string().max(120).optional()}),run:({collection,query})=>templateCatalog(collection,query)},
    {name:'read_template',description:'Read the current authored template fields and notes from live objects, including manual edits. Use before changing layout/content/density. Older unmapped templates can be modified through read_deck/propose_updates.',schema:z.object({slideId:z.string()}).strict(),run:async({slideId})=>{const deck=await readable();restrict(deck,[slideId]);if(scope?.elementIds.length)throw new Error('Choose This slide to read template content.');const slide=deck.slides.find(s=>s.id===slideId);if(!slide)throw new Error('Slide no longer exists.');return {baseRevision:deck.revision,...readTemplate(slide)};}},
    {name:'prepare_template_update',description:'Modify a mapped native template in place: set density:reading for reading layouts, change layout/family, heading/body/items/cells/chart, density or notes. Read_template first; omit content fields to preserve live values. Use contentMode:replace with complete authored content only when intentionally repurposing a page; merge is the default. Preserves slide identity, document theme, local type/color overrides and custom objects. Imported/locked evidence stays protected. Returns one recipe for review; never applies it. Requires This slide or All slides.',schema:TemplateUpdateSchema,run:async input=>{const deck=await readable();restrict(deck,[input.slideId]);if(scope?.elementIds.length)throw new Error('Choose This slide to modify its template.');const {operations,...details}=await prepareTemplateUpdate(deck,input);validateAIProposal(deck,{baseRevision:deck.revision,summary:'Modify the native template',operations},scope);return {...remember(operations,deck.revision),...details};}},
    {name:'prepare_template',description:'Prepare editable template slides at document dimensions without applying them. Supply actual content; returned recipeId goes in propose_edit.prepared. Requires All slides.',schema:z.object({collection:z.string().max(40),layout:z.string().max(60),afterId:z.string().optional(),contentJson:json}),run:async({collection,layout,afterId,contentJson})=>{
      const deck=await readable();if(scope&&(scope.elementIds.length||scope.slideIds.length!==deck.slides.length))throw new Error('Select All slides to add template slides.');
      const {COLLECTIONS,templateLayouts}=await import('./templates');
      if(!COLLECTIONS.some(c=>c.id===collection)||!templateLayouts(collection).some(l=>l.id===layout))throw new Error('Unknown collection or layout. Use list_templates first.');
      const content=TemplateContentSchema.parse(parse(contentJson));
      if(afterId&&!deck.slides.some(s=>s.id===afterId))throw new Error('Slide no longer exists.');
      let after=afterId??deck.slides.at(-1)!.id;
      const operations:Operation[]=(await authoredTemplatePages(deck,layout,collection,content,deck.slides.length+1)).map(slide=>{const op:Operation={op:'add_slide',slide,afterId:after,templateCollection:collection as any};after=slide.id;return op;});
      validateAIProposal(deck,{baseRevision:deck.revision,summary:'Prepare native templates',operations},scope);
      return {...remember(operations,deck.revision),content:'Authored content only. Read_template can inspect and reflow these pages later.'};
    }},
    {name:'prepare_arrangement',description:'Use the same deterministic alignment, distribution, movement and group helpers as manual editing. Returns a recipe for one atomic proposal; locked objects remain protected.',schema:z.object({slideId:z.string(),elementIds:ids.min(1),action:z.enum(['align','distribute','move','group','auto-layout']),direction:z.enum(['left','center','right','top','middle','bottom']).optional(),reference:z.enum(['auto','page','content','selection','group']).optional(),axis:z.enum(['x','y']).optional(),dx:z.number().min(-20000).max(20000).optional(),dy:z.number().min(-20000).max(20000).optional()}),run:async args=>{
      const deck=await readable();restrict(deck,[args.slideId],args.elementIds);const slide=deck.slides.find(s=>s.id===args.slideId);if(!slide||args.elementIds.some((id:string)=>!slide.elements.some(e=>e.id===id)))throw new Error('Object no longer exists.');
      let ops:Operation[]=[];
      if(args.action==='align'){if(!args.direction)throw new Error('Choose an alignment direction.');ops=alignElements(deck,args.slideId,args.elementIds,args.direction,args.reference??'auto');}
      if(args.action==='distribute'){if(!args.axis)throw new Error('Choose x or y distribution.');ops=distributeElements(deck,args.slideId,args.elementIds,args.axis);}
      if(args.action==='move')ops=moveElements(deck,args.slideId,args.elementIds,args.dx??0,args.dy??0);
      if(args.action==='group')ops=groupElements(slide,args.elementIds);
      if(args.action==='auto-layout')ops=createGroupLayout(slide,args.elementIds);
      validateAIProposal(deck,{baseRevision:deck.revision,summary:'Prepared arrangement',operations:ops},scope);
      return remember(ops,deck.revision);
    }},
    {name:'prepare_duplicate_slide',description:'Duplicate a slide preserving sources, media, nested groups, styles and authored timing with new stable IDs. Returns a recipe. Requires All slides.',schema:z.object({slideId:z.string()}),run:async({slideId})=>{
      const deck=await readable();if(scope&&(scope.elementIds.length||scope.slideIds.length!==deck.slides.length))throw new Error('Select All slides to duplicate a slide.');
      const original=deck.slides.find(s=>s.id===slideId);if(!original)throw new Error('Slide no longer exists.');
      const slide=structuredClone(original),mapping=new Map<string,string>();
      for(const item of [...slide.elements,...(slide.groups??[]),...(slide.autoLayouts??[])])if(!mapping.has(item.id))mapping.set(item.id,uid('node'));
      slide.id=uid('slide');slide.elements=slide.elements.map(e=>({...e,id:mapping.get(e.id)!,group:e.group?mapping.get(e.group):undefined}));
      slide.groups=slide.groups?.map(g=>({...g,id:mapping.get(g.id)!,parent:g.parent?mapping.get(g.parent):undefined}));
      slide.autoLayouts=slide.autoLayouts?.map(l=>({...l,id:mapping.get(l.id)!,order:l.order.map(id=>mapping.get(id)!)}));
      if(slide.template){slide.template.slots=slide.template.slots?.map(slot=>({...slot,elementId:mapping.get(slot.elementId)??slot.elementId}));slide.template.generated=slide.template.generated?.map(e=>({...e,id:mapping.get(e.id)??e.id}));slide.template.generatedGroups=slide.template.generatedGroups?.map(id=>mapping.get(id)??id);}
      return remember([{op:'add_slide',slide,afterId:slideId}],deck.revision);
    }},
    {name:'read_prepared_edit',description:'Inspect prepared operations before submitting or adjusting them. Media stays local. Nothing is applied.',schema:z.object({recipeId:z.string(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(10).optional()}),run:async({recipeId,offset=0,limit=3})=>{const recipe=recipes.get(recipeId);if(!recipe)throw new Error('Prepared edit has expired. Prepare it again.');const deck=await readable();if(deck.revision!==recipe.baseRevision)throw new Error('The document changed after this edit was prepared. Prepare it again at the current revision.');const ops=recipe.operations;return {baseRevision:recipe.baseRevision,operations:media.compact(ops.slice(offset,offset+limit)),nextOffset:offset+limit<ops.length?offset+limit:null};}},
    {name:'propose_edit',description:'Validate ONE atomic proposal for review; never apply silently. proposalJson contains {baseRevision,summary,operations,prepared?}. prepared is an array of recipeIds executed before operations. Fix validation errors using the current revision and original scope.',schema:z.object({proposalJson:json}),run:async({proposalJson})=>{
      const raw=parse(proposalJson);const prepared=z.array(z.string()).max(24).parse(raw.prepared??[]);
      if(new Set(prepared).size!==prepared.length)throw new Error('Use each prepared edit once.');
      const operations=prepared.flatMap(ref=>{const recipe=recipes.get(ref);if(!recipe)throw new Error('Prepared edit has expired. Prepare it again.');if(recipe.baseRevision!==raw.baseRevision)throw new Error('The document revision changed after this edit was prepared. Read the current document and prepare it again.');return recipe.operations;});
      const created=new Set(operations.flatMap(op=>op.op==='add_element'?[op.element.id]:op.op==='add_slide'?[op.slide.id,...op.slide.elements.map(e=>e.id)]:[]));
      if(Array.isArray(raw.operations)&&raw.operations.some((op:any)=>op.op==='add_element'&&created.has(op.element?.id)||op.op==='add_slide'&&created.has(op.slide?.id)))throw new Error('A prepared recipe already creates this object or slide. Keep its recipeId in prepared and remove the duplicate add operation from operations. Use update_element for separate adjustments.');
      const image=(e:any)=>JSON.stringify(['type','text','x','y','w','h','fontSize','fill','rotation','src','chart','cells'].map(key=>e[key]));
      const additions=operations.flatMap(op=>op.op==='add_element'?[op]:[]);
      if(Array.isArray(raw.operations)&&raw.operations.some((op:any)=>op.op==='add_element'&&additions.some(prepared=>prepared.slideId===op.slideId&&image(prepared.element)===image(ElementSchema.parse(media.hydrate(op.element))))))throw new Error('This object is already included in a prepared edit. Submit the recipe with propose_prepared_edits and omit repeated additions.');
      delete raw.prepared;raw.operations=[...operations,...z.array(z.unknown()).parse(raw.operations??[])];
      const omitNull=(v:any):any=>Array.isArray(v)?v.map(omitNull):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,item])=>item!==null).map(([key,item])=>[key,omitNull(item)])):v;
      return validateAIProposal(await readable(),media.hydrate(omitNull(raw)),scope).proposal;
    }},
  ];
  tools.push(
    {name:'prepare_story',title:'Prepare an editable deck story',description:'Prepare 2–12 complete editable slides in one typed call. Supply a real title and authored heading/body/points/notes for every slide. points:[{heading,body}] is required for item layouts; timeline needs one point per date. cells (header + rows) belong only to table/comparison/action-plan. Uses the existing native template layouts and current design system. replaceBlank is allowed only for a single empty new draft; existing content stays intact. Requires All slides. Returns one revision-bound recipe for propose_prepared_edits; never applies changes.',schema:StorySchema,run:async input=>{const deck=await readable();if(scope&&(scope.elementIds.length||scope.slideIds.length!==deck.slides.length))throw new Error('Select All slides to prepare a deck story.');const {prepareStory}=await import('./ai-story-builder');const operations=await prepareStory(deck,input);validateAIProposal(deck,{baseRevision:deck.revision,summary:'Prepare the deck story',operations},scope);return {...remember(operations,deck.revision),title:input.title};}},
    {name:'search_document',title:'Find document content',description:'Find object IDs or speaker notes by text/name/ID before editing. Scoped, paginated excerpts only; no media bytes. Use returned revision and IDs in propose_updates.',schema:SearchDocumentSchema,outputSchema:SearchDocumentResultSchema,run:async input=>searchDocument(await readable(),input,scope)},
    {name:'propose_updates',title:'Propose object changes',description:'Fast path for text, position, size, color and font changes. Typed updates need no JSON string or full object schema. Supply the read baseRevision and target IDs; include recipeIds to combine prepared template/artwork changes with these updates in ONE atomic proposal for review. Advanced fields use get_edit_schema and propose_edit.',schema:SimpleUpdatesSchema,run:async({baseRevision,summary,recipeIds,updates})=>tools.find(t=>t.name==='propose_edit')!.run({proposalJson:JSON.stringify({baseRevision,summary,prepared:recipeIds,operations:updates.map((input:any)=>({op:'update_element',slideId:input.slideId,elementId:input.elementId,patch:simplePatch(input)}))})})},
    {name:'prepare_elements',title:'Prepare text and shapes',description:'Prepare up to 24 text/shape objects in one typed call using manual defaults and generated IDs. box is x/y/w/h; style is optional. Returns one revision-bound recipe for propose_prepared_edits. Images, tables/charts and advanced fields use prepare_element.',schema:SimpleElementsSchema,run:async({slideId,elements})=>{const deck=await readable();restrict(deck,[slideId]);if(scope?.elementIds.length)throw new Error('Choose This slide to add objects.');const operations:Operation[]=elements.map((input:any)=>{if(input.type==='text'&&!input.text?.trim())throw new Error('Provide text for each text object.');return {op:'add_element',slideId,element:element(input.type,{name:input.name,text:input.text,...input.box,...input.style})};});validateAIProposal(deck,{baseRevision:deck.revision,summary:'Prepared objects',operations},scope);return {...remember(operations,deck.revision),objects:operations.map(op=>{const e=(op as Extract<Operation,{op:'add_element'}>).element;return {id:e.id,type:e.type,text:e.text,x:e.x,y:e.y,w:e.w,h:e.h};})};}}
  );
  tools.push({name:'propose_prepared_edits',description:'Finish prepared elements, templates, copies or layouts by submitting their recipeIds directly. Do not echo prepared operations. Only additional update operations belong in adjustmentsJson. Validates one atomic proposal for editor review.',schema:z.object({baseRevision:z.number().int().min(0),summary:z.string().max(3000),recipeIds:z.array(z.string()).min(1).max(24),adjustmentsJson:json.optional()}),run:async({baseRevision,summary,recipeIds,adjustmentsJson})=>tools.find(t=>t.name==='propose_edit')!.run({proposalJson:JSON.stringify({baseRevision,summary,prepared:recipeIds,operations:adjustmentsJson?parse(adjustmentsJson):[]})})});
  if(services)tools.splice(3,0,
    {name:'get_resource_catalog',description:'Discover available resource collections, categories and provider availability. No credentials returned.',schema:z.object({}),run:()=>services.resourceCatalog()},
    {name:'search_resources',description:'Search existing icons, illustrations, patterns, textures and licensed photos. Returns at most 20 matches. Use read_assets search filters to match the current family; view:illustrations with illustrationType:spot/scene/accent finds artwork, view:graphics finds patterns/textures. set and style filter icons; family filters graphics. Follow nextOffset before advancing page when hasMore. Photos may require an available external provider.',openWorld:true,schema:z.object({kind:z.enum(['icon','illustration','photo']),query:z.string().max(120),collection:z.string().max(60).optional(),source:z.string().max(80).optional(),set:z.string().max(40).optional(),category:z.string().max(80).optional(),family:z.string().max(80).optional(),view:z.enum(['illustrations','graphics']).optional(),illustrationType:z.enum(['spot','scene','accent']).optional(),style:z.enum(['all','outline','solid','duotone']).optional(),page:z.number().int().min(1).max(1000).optional(),offset:z.number().int().min(0).max(63).optional()}),run:async args=>{
      const params=new URLSearchParams({kind:args.kind,q:args.query});for(const key of ['collection','source','set','category','page','family','view','illustrationType','style'])if(args[key]!==undefined)params.set(key,String(args[key]));
      const page=await services.searchResources(params),offset=args.offset??0;
      return {...page,items:page.items.slice(offset,offset+20),nextOffset:offset+20<page.items.length?offset+20:null};
    }},
    {name:'prepare_resource',description:'Load an existing resource with its original attribution. Returns an opaque src reference for an image object. Preserve the returned resource metadata. No document mutation.',openWorld:true,schema:z.object({id:z.string().max(200),color:z.string().regex(/^#[\da-fA-F]{6}$/).optional(),recipeJson:json.optional()}),run:async({id,color,recipeJson})=>{
      const recipe=recipeJson?parse(recipeJson):undefined;
      const resource=await services.importResource({id,color,...(id.startsWith('character:')?{characterRecipe:recipe}:{graphicRecipe:recipe})});
      return media.compact(resource);
    }});
  return {tools,media,guide:EDITING_GUIDE};
}

// OpenAI strict tools require all properties and no additional properties.
// Optional inputs become nullable on the wire, then are omitted before dispatch.
export function strictToolSchema(schema:z.AnyZodObject) {
  const result:any=zodToJsonSchema(schema,{$refStrategy:'none'});delete result.$schema;
  const strict=(node:any):void=>{
    if(!node||typeof node!=='object')return;
    delete node.default;
    // Fixed tuples use a homogeneous array on provider wires. Canonical Zod
    // still validates every position and exact length before dispatch.
    if(node.type==='array'&&Array.isArray(node.items)){node.items={anyOf:node.items};delete node.additionalItems;}
    // Provider schemas support a subset of JSON Schema formats. Zod still
    // enforces URLs and other semantic constraints before any tool executes.
    if(node.format&&!['date-time','time','date','duration','email','hostname','ipv4','ipv6','uuid'].includes(node.format))delete node.format;
    if(node.type==='object'&&node.properties){const required=new Set(node.required??[]);for(const [key,value] of Object.entries(node.properties)){strict(value);if(!required.has(key))node.properties[key]={anyOf:[value,{type:'null'}]};}node.required=Object.keys(node.properties);node.additionalProperties=false;}
    else for(const value of Object.values(node))if(Array.isArray(value))value.forEach(strict);else if(value&&typeof value==='object')strict(value);
  };strict(result);return result;
}
