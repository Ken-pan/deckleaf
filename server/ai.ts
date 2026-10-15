import {type Deck} from '../src/core/model';
import {EDITING_GUIDE, EditMedia, readAIContext, validateAIProposal, validateEditScope, type EditScope} from '../src/core/ai-editing';
import {editingToolkit, strictToolSchema, type EditingServices} from '../src/core/ai-tools';
import {omitNull} from './ai-schema';
import type {Proposal} from '../src/core/operations';
import {toolFailure} from '../src/core/tool-recovery';
import {CreationBriefSchema,StorySchema,validateCreationEvidence,creationInstruction,type CreationBrief} from '../src/core/ai-story';
import {AIHistorySchema,aiFollowups,type AIHistory} from '../src/core/ai-session';
import {workflowTools,WorkflowOutcomeSchema,AIInformationSchema,validateWorkflow,type WorkflowServices,type WorkflowOutcome,type AIInformation} from '../src/core/workflows';
import {resolvePageRequest,validatePageRequest,usePageBatch,type PageRequest} from '../src/core/ai-page-request';
import {readTemplate} from '../src/core/ai-templates';
import {readAssets} from '../src/core/ai-assets';
import {PageEditsSchema} from '../src/core/ai-page-edits';
import {z} from 'zod';
import {pageBatchModelSchema,requestedChartPatch} from './ai-page-schema';

export type AISettings = {provider:'openai'|'compatible';baseUrl:string;model:string;apiKey?:string};
export type AIProgress = {stage:'context'|'model'|'tool'|'validate';message:string;tool?:string;round?:number};
export type AIRunOptions = {signal?:AbortSignal;onprogress?:(event:AIProgress)=>void;services?:EditingServices;transport?:typeof fetch;workflowServices?:WorkflowServices;creation?:CreationBrief;history?:AIHistory};
const serverKey=(provider:AISettings['provider'])=>typeof process==='undefined'?undefined:provider==='openai'?process.env.OPENAI_API_KEY:process.env.DECK_AI_KEY;
export function providerBase(settings:AISettings) {
  if(!settings||!['openai','compatible'].includes(settings.provider))throw new Error('Choose a supported AI provider in Settings.');
  const base=settings.provider==='openai'?'https://api.openai.com/v1':settings.baseUrl.replace(/\/+$/,'');
  let u:URL;try{u=new URL(base);}catch{throw new Error('Enter a valid AI provider URL in Settings.');}
  if(!['https:','http:'].includes(u.protocol)||(u.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))||u.username||u.password||u.search||u.hash)throw new Error('Use HTTPS for the model provider URL. Local providers can use HTTP on localhost. Keep credentials out of URLs.');
  return base;
}
export async function availableModels(settings:AISettings) {
  const base=providerBase(settings),key=settings.apiKey||serverKey(settings.provider);
  const response=await fetch(`${base}/models`,{headers:key?{Authorization:`Bearer ${key}`}:{},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw new Error(`Could not retrieve models (${response.status})`);
  const value:any=await response.json();return {models:(value.data??[]).map((v:any)=>v.id).filter((v:any)=>typeof v==='string'&&v.length<200).sort() as string[]};
}
const instruction=`You are Decksprig's document and workflow assistant. ${EDITING_GUIDE}
Use the tools to flexibly combine existing capabilities. For template selection read list_templates and match the reader task and available evidence. To modify a template read_template first, then prepare_template_update for content, layout or density changes; omitted fields preserve current authored values. Older unmapped templates use read_deck and propose_updates for in-place object edits. Preserve the document theme unless explicitly asked to change it. Common object changes should go straight to propose_updates with typed fields. Use prepare_elements for a text/shape batch, search_document to locate targets, and propose_edit for advanced canonical operations; discover schemas or helpers only when needed. Return an atomic proposal, never a claim that you applied it. proposalJson is JSON with baseRevision, concise English summary, operations, and optional prepared recipeIds. When using prepared recipes, do not repeat their add operations; use operations:[] or only separate adjustments. Keep existing content language unless translation is requested; use the user's language for newly authored content. Never invent URLs, credentials, font bytes, resource IDs or media references. Use respond_to_user for capability or status questions, using only observed tool results and actual request receipts. Use workflow tools for import, export, presentation, account connection, workspace commands and publishing. A queued workflow is not completed execution. Never claim a file was exported, an account connected or a site published before its receipt confirms it. Web publication prepares a concrete package and final user action; credentials are entered only in the native UI. Finish and apply document proposals before requesting workflows for the changed document. Scope is fixed for this run. On tool errors use the reported recovery action. For compatible models without tool calls, return the same JSON proposal as your final response. Null fields mean leave unchanged. Example update: {"baseRevision":0,"summary":"Shorten the selected title","operations":[{"op":"update_element","slideId":"actual-slide-id","elementId":"actual-element-id","patch":{"text":"New title"}}]}.`;
const toolMessages:Record<string,string>={propose_page_edits:'Checking every requested page…',prepare_story:'Building editable slides…',propose_updates:'Validating your changes…',prepare_element:'Preparing an object…',get_capabilities:'Checking editing capabilities…',read_deck:'Reading document context…',get_edit_schema:'Checking object settings…',search_resources:'Searching the resource library…',prepare_resource:'Preparing a resource…',read_assets:'Reading current artwork…',prepare_asset_replacements:'Preparing artwork replacements…',get_resource_catalog:'Checking resource collections…',search_fonts:'Finding available fonts…',list_templates:'Finding editable templates…',prepare_template:'Preparing template slides…',read_template:'Reading current template content…',prepare_template_update:'Adapting the native template…',prepare_arrangement:'Preparing the layout…',prepare_duplicate_slide:'Preparing a slide copy…',read_prepared_edit:'Checking prepared changes…',propose_prepared_edits:'Validating prepared changes…',propose_edit:'Validating proposed changes…'};
const finalFormat={type:'json_schema',name:'deck_edit_result',strict:true,schema:{type:'object',properties:{proposalJson:{type:'string',description:'JSON containing the atomic proposal: baseRevision, summary, operations and optional prepared recipe IDs.'}},required:['proposalJson'],additionalProperties:false}};
const creationFinalFormat={type:'json_schema',name:'deck_story_result',strict:true,schema:{type:'object',properties:{storyJson:{type:'string',description:'JSON with title, replaceBlank:true and slides of layout, heading, body, points and notes. Content only: native templates create all objects.'}},required:['storyJson'],additionalProperties:false}};
const creationTools=new Set(['prepare_story','propose_prepared_edits','read_prepared_edit','get_capabilities','read_deck','list_templates']);
const workflowFinalFormat={type:'json_schema',name:'deck_ai_result',strict:true,schema:{type:'object',properties:{resultJson:{type:'string',description:'JSON for one result: a document proposal (baseRevision,summary,operations); an action request with action:{kind,...}; or information with kind:information,message and optional requestId. Never invent request receipts or completion.'}},required:['resultJson'],additionalProperties:false}};
export async function runAI(deck:Deck,prompt:string,scope:EditScope,settings:AISettings,options:AIRunOptions={}) :Promise<Proposal|WorkflowOutcome|AIInformation> {
  const base=providerBase(settings);
  if(!settings.model?.trim())throw new Error('Choose an AI model in Settings first.');
  if(typeof prompt!=='string'||!prompt.trim())throw new Error('Describe the changes you want to make.');
  validateEditScope(deck,scope);
  const creation=options.creation?CreationBriefSchema.parse(options.creation):undefined;
  const pageRequest:PageRequest=creation?{pages:[],protectedIds:[],structural:false}:resolvePageRequest(deck,prompt),pageBatch=!creation&&usePageBatch(prompt,pageRequest);
  if(pageRequest.pages.some(p=>!scope.slideIds.includes(p.slideId))||pageRequest.deletedNumbers?.some(n=>!scope.slideIds.includes(deck.slides[n-1].id)))throw new Error('The request names pages outside the selected scope. Choose All slides to edit those pages.');
  if(pageRequest.additions?.length&&(scope.elementIds.length||scope.slideIds.length!==deck.slides.length))throw new Error('Choose All slides to insert pages in this batch.');
  if(creation&&(deck.slides.length!==1||deck.slides[0].elements.length||deck.slides[0].source))throw new Error('Start AI creation with a new empty draft.');
  const history=aiFollowups(AIHistorySchema.parse(options.history??[]));
  const key=settings.apiKey||serverKey(settings.provider);
  if(settings.provider==='openai'&&!key)throw new Error('Enter an API key in Settings or configure OPENAI_API_KEY on the local server.');
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000);
  const progress=(event:AIProgress)=>{signal.throwIfAborted();options.onprogress?.(event);};
  progress({stage:'context',message:'Reading the selected context…'});
  const media=new EditMedia(),kit=editingToolkit(async()=>deck,options.services,scope,media);
  if(options.workflowServices&&!creation)kit.tools.push(...workflowTools(async()=>deck,options.workflowServices));
  const compact=readAIContext(deck,media,{slideIds:scope.slideIds,elementIds:scope.elementIds,detail:pageBatch||scope.slideIds.length>10?'outline':'content',limit:pageBatch?40:10});
  const input=JSON.stringify({request:prompt.slice(0,10000),scope,history,historyContract:'Earlier requests explain intent only. Use the current document, revision and scope as authority; queued actions need actual receipts before claiming completion.',...(creation?{creation}:{}),pages:compact.slides.map(s=>({id:s.id,number:s.number,heading:s.heading,layout:'template' in s?s.template?.prototype:s.layout})),pageContract:'Resolve requested page numbers using this current pages map. Verify number and heading in read_template before preparing updates; never reuse a selected or historical page ID for another page.',...(pageBatch?{requiredPages:pageRequest.pages.map(p=>({number:p.number,instruction:p.instruction,artwork:p.replaceArtwork?'replace allowed':p.styleArtwork?'customize SAME resource':'preserve existing artwork',current:readTemplate(deck.slides.find(s=>s.id===p.slideId)!),assets:readAssets(deck,{slideIds:[p.slideId],limit:12}).items})),requiredDeletes:pageRequest.deletedNumbers,requiredInsertions:pageRequest.additions,batchContract:'Use propose_page_edits with ALL required edits, deletePages and additions in ONE call. All numbers and afterNumber anchors refer to the ORIGINAL baseRevision map, even when pages are added/deleted. Put only existing edited pages in pages; deletion targets belong in deletePages, new content belongs in additions. collection changes template family; chart patches existing data/display fields. Do not prepare separate recipes or submit a partial proposal. Omitted fields stay unchanged; assets.action:style NEVER changes the resource ID.'}:{}),deck:compact,responseFormat:options.workflowServices&&!creation?'Use editing tools for document proposals, request_* for editor actions, or respond_to_user for factual capability/status answers.':'Return a JSON proposal via propose_edit or as the final response.'});
  if(input.length>400_000)throw new Error('This scope contains too much text. Choose fewer slides or selected objects.');
  const openai=settings.provider==='openai';
  const batchTools=new Set(['propose_page_edits','read_deck','read_template','read_assets','search_document','search_resources','list_templates','get_resource_catalog','get_capabilities']);
  // Common template batches use semantic slots; free object edits retain the full toolkit.
  const batchSchema=PageEditsSchema.extend({pages:z.array(PageEditsSchema.shape.pages.element.omit({updates:true})).max(12)});
  const definitions=kit.tools.filter(t=>(!creation||creationTools.has(t.name))&&(!pageBatch||batchTools.has(t.name))).map(t=>({type:'function',name:t.name,description:pageBatch&&t.name==='propose_page_edits'?'Submit one complete batch using ORIGINAL page numbers. Each page exposes only compatible requested fields. heading/body are title/subtitle, items are text points, chart is editable chart data. Never put chart series in items. deletePages/additions handle structure. Omitted fields preserve current content and artwork.':t.description,parameters:pageBatch&&t.name==='propose_page_edits'?pageBatchModelSchema(deck,pageRequest,strictToolSchema(batchSchema)):strictToolSchema(t.schema),strict:true}));
  const runInstruction=instruction+(creation?'\n'+creationInstruction(creation)+' If returning final text without tools, return {storyJson:"JSON containing title, replaceBlank:true and slides"}; never return custom layout operations.':'');
  const responses:any[]=[{role:'user',content:input}],messages:any[]=[{role:'system',content:runInstruction},{role:'user',content:input}];
  const transport=options.transport??fetch;
  const redact=(message:string)=>key?message.replaceAll(key,'[redacted]'):message;
  let calls=0,failures=0,prepared=false;
  const submissions=new Set(['propose_edit','propose_prepared_edits','propose_updates','propose_page_edits']);
  for(let round=1;round<=8;round++) {
    progress({stage:'model',message:round===1?'Planning your changes…':'Refining the proposal…',round});
    const body=openai?{model:settings.model,instructions:runInstruction+(pageBatch?' For this multi-page request submit ALL requiredPages, requiredDeletes and requiredInsertions through ONE propose_page_edits call. Its number field resolves targets deterministically. Use items objects, assets.action:style for color-only changes and replace only where requested. Do not prepare separate recipes.':creation?' Final text must use the storyJson envelope.':options.workflowServices?' Final text uses the resultJson envelope. For actions use request_* tools, for capability/status answers use respond_to_user. Do not submit an empty editing proposal.':' Final text must use the provided proposalJson envelope.')+(pageBatch?'':' Submit prepared helpers through propose_prepared_edits using recipeIds, without repeating their operations.'),input:responses,store:false,tools:definitions,parallel_tool_calls:!pageBatch,text:{format:creation?creationFinalFormat:options.workflowServices?workflowFinalFormat:finalFormat},...(failures&&pageBatch?{tool_choice:{type:'function',name:'propose_page_edits'}}:failures&&!options.workflowServices&&!creation?{tool_choice:{type:'function',name:prepared?'propose_prepared_edits':'propose_edit'}}:{}),max_output_tokens:16000}:
      {model:settings.model,messages,tools:definitions.map(({type,...fn})=>({type,function:fn})),response_format:{type:'json_object'}};
    const response=await transport(`${base}/${openai?'responses':'chat/completions'}`,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify(body),signal,redirect:'error'});
    if(!response.ok){const detail:any=await response.json().catch(()=>({}));throw new Error(`The AI provider returned ${response.status}${detail.error?.message?`: ${redact(String(detail.error.message)).slice(0,500)}`:'. Check your model, account balance, and connection settings.'}`);}
    const result:any=await response.json();
    if(result.status==='incomplete'||result.error||result.choices?.[0]?.finish_reason==='length')throw new Error('The AI result is incomplete. Reduce the edit scope and try again.');
    const output=result.output??[],message=result.choices?.[0]?.message;
    if(output.some((o:any)=>o.content?.some((c:any)=>c.type==='refusal'))||message?.refusal)throw new Error('The model could not propose these changes. Rephrase the request and try again.');
    const toolCalls:any[]=openai?output.filter((o:any)=>o.type==='function_call').map((o:any)=>({id:o.call_id,name:o.name,arguments:o.arguments})): (message?.tool_calls??[]).map((o:any)=>({id:o.id,name:o.function?.name,arguments:o.function?.arguments}));
    if(openai)responses.push(...output);else if(message)messages.push(message);
    const text=openai?output.flatMap((o:any)=>o.content??[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join(''):message?.content;
    if(!toolCalls.length) {
      if(typeof text!=='string'||!text.trim())throw new Error('The AI provider returned no valid changes. Try again.');
      try {
        progress({stage:'validate',message:'Validating proposed changes…'});
        const parsed=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
        if(creation){const story=typeof parsed.storyJson==='string'?JSON.parse(parsed.storyJson):parsed;const {prepareStory,creationPreview}=await import('../src/core/ai-story-builder');const authored=StorySchema.parse({...omitNull(story),replaceBlank:true,...(creation.templateMode!=='auto'?{collection:creation.collection}:{})});validateCreationEvidence(authored,creation);const operations=await prepareStory(deck,authored);const proposal=validateAIProposal(deck,{baseRevision:deck.revision,summary:'Create the deck with native templates',operations},scope).proposal;creationPreview(deck,proposal,creation);return proposal;}
        const raw=typeof parsed.resultJson==='string'?JSON.parse(parsed.resultJson):typeof parsed.proposalJson==='string'?JSON.parse(parsed.proposalJson):parsed;
        if(pageBatch)throw new Error('Submit all requested pages through propose_page_edits. Do not finalize a partial raw proposal.');
        if(raw.kind==='information'&&options.workflowServices)return AIInformationSchema.parse({kind:'information',message:raw.message,...(raw.requestId?{receipt:await options.workflowServices.read(raw.requestId)}:{})});
        if(raw.action&&options.workflowServices)return WorkflowOutcomeSchema.parse({kind:'workflow',request:await options.workflowServices.request(deck,validateWorkflow(deck,omitNull(raw.action)))});
        if(prepared&&!raw.prepared?.length)throw new Error('Prepared changes would be omitted. Include the required recipe IDs in prepared, or submit propose_updates with recipeIds and typed updates. Combine all intended changes in one proposal.');
        const proposal=await kit.tools.find(t=>t.name==='propose_edit')!.run({proposalJson:JSON.stringify(omitNull(raw))}) as Proposal;validatePageRequest(deck,proposal,pageRequest);if(creation)(await import('../src/core/ai-story-builder')).creationPreview(deck,proposal,creation);return proposal;
      }catch(error){
        if(signal.aborted)throw signal.reason;
        if(++failures>=3)throw new Error(`The proposal could not be validated. ${redact((error as Error).message).slice(0,500)}`);
        const feedback={role:'user',content:`The proposal was rejected: ${redact((error as Error).message).slice(0,1000)}. Fix it using the original scope and current baseRevision. ${creation?'Return storyJson with authored title/slides, or use prepare_story then propose_prepared_edits. Do not submit custom layout operations.':options.workflowServices?'Use the supported workflow or status tools for actions and questions; use propose_edit only for document edits.':'Return a valid JSON proposal.'}`};responses.push(feedback);messages.push(feedback);continue;
      }
    }
    if((calls+=toolCalls.length)>24||toolCalls.length>8)throw new Error('This request needs too many steps. Split it into smaller edits.');
    if(toolCalls.some(t=>submissions.has(t.name))&&toolCalls.some(t=>t.name.startsWith('request_')))throw new Error('Finish and apply the document proposal before requesting workflow actions.');
    if(toolCalls.filter(t=>submissions.has(t.name)).length>1){
      if(!pageBatch)throw new Error('The model returned multiple competing proposals. Try a more focused request.');
      if(++failures>=3)throw new Error('The model repeatedly split this edit into competing proposals. No changes were made.');
      const feedback=JSON.stringify({error:'Multiple proposals were rejected without applying anything. Combine ALL required page numbers in ONE propose_page_edits call, using the current baseRevision. Keep the original request and scope.'});
      for(const call of toolCalls){responses.push({type:'function_call_output',call_id:call.id,output:feedback});messages.push({role:'tool',tool_call_id:call.id,content:feedback});}
      continue;
    }
    const execute=async(call:any)=>{
      signal.throwIfAborted();
      const tool=kit.tools.find(t=>t.name===call.name);let value:unknown;
      try {
        if(creation&&!creationTools.has(call.name))throw new Error('Use prepare_story and propose_prepared_edits for native template creation. Custom layout operations are unavailable during creation.');
        if(!tool)throw new Error('Unknown tool. Use get_capabilities for supported tools.');
        if(pageBatch&&!batchTools.has(call.name))throw new Error('Use propose_page_edits for ALL required pages, with typed content/layout/assets together. No separate prepared recipes are needed.');
        progress({stage:submissions.has(call.name)?'validate':'tool',message:toolMessages[call.name]??(call.name.startsWith('request_')?'Preparing the editor action…':call.name.includes('workflow')?'Checking action status…':'Preparing your changes…'),tool:call.name,round});
        const args=tool.schema.parse(omitNull(JSON.parse(call.arguments)));
        if(pageBatch&&call.name==='propose_page_edits'){
          batchSchema.parse(args);
          for(const page of args.pages){const requirement=pageRequest.pages.find(p=>p.number===page.number);if(!requirement)continue;
            if(!requirement.notesEditable)delete page.notes;
            if(!requirement.layout&&!/(?:版式|布局|模板|layout|template|reflow)/i.test(requirement.instruction))delete page.layout;
            if(!requirement.collection)delete page.collection;
            if(!/(?:密度|阅读|reading|density)/i.test(requirement.instruction))delete page.density;
            if(!requirement.chart)delete page.chart;
            else if(page.chart){for(const key of Object.keys(page.chart))if(!requirement.chart.editable.includes(key))delete page.chart[key];for(const [key,fields]of Object.entries(requirement.chart.nested??{})){if(!page.chart[key])continue;for(const field of Object.keys(page.chart[key]))if(!fields.includes(field))delete page.chart[key][field];if(!Object.keys(page.chart[key]).length)delete page.chart[key];}}
            if(requirement.chart){const chart=requestedChartPatch(deck,requirement,page.chart);if(Object.keys(chart).length)page.chart=chart;}
          }
        }
        if(prepared&&call.name==='propose_updates'&&!args.recipeIds?.length)throw new Error('Prepared changes would be omitted. Include the required recipeIds in propose_updates to combine template/artwork changes with typed updates, or use propose_prepared_edits with separate adjustments. Combine all intended changes in one proposal.');
        if(prepared&&call.name==='propose_edit'&&!JSON.parse(args.proposalJson).prepared?.length)throw new Error('Prepared changes would be omitted. Submit their recipe IDs with the separate updates in one atomic proposal.');
        if(creation&&call.name==='prepare_story'){args.replaceBlank=true;if(creation.templateMode!=='auto')args.collection=creation.collection;validateCreationEvidence(StorySchema.parse(args),creation);}
        if(creation&&call.name==='propose_prepared_edits'&&(args.updates?.length||args.removeElements?.length||args.adjustmentsJson&&JSON.parse(args.adjustmentsJson).length))throw new Error('Submit native recipeIds without custom layout adjustments. Revise authored content with prepare_story.');
        value=await tool.run(args);if(submissions.has(call.name)){validatePageRequest(deck,value as Proposal,pageRequest);if(creation)(await import('../src/core/ai-story-builder')).creationPreview(deck,value as Proposal,creation);}signal.throwIfAborted();
        if((value as any)?.recipeId)prepared=true;
        if(!submissions.has(call.name)&&JSON.stringify(value).length>160_000)throw new Error('This result is too large. Narrow the query or read fewer slides.');
      }catch(error){if(signal.aborted)throw signal.reason;value=toolFailure(error,{tool:call.name,deckId:deck.id});(value as any).error=redact((value as any).error);if(submissions.has(call.name)&&pageBatch){Object.assign(value as object,{next:{tool:'propose_page_edits',action:'repair_complete_batch'},baseRevision:deck.revision,documentUnchanged:true,requiredPages:pageRequest.pages.map(p=>({number:p.number,slideId:p.slideId,texts:p.texts,textFields:p.textFields,notesEditable:p.notesEditable,layout:p.layout,collection:p.collection,density:p.density,chart:p.chart,artwork:p.replaceArtwork?'replace requested':p.styleArtwork?'same-resource style only':'preserve'})),deletePages:pageRequest.deletedNumbers,additions:pageRequest.additions});progress({stage:'validate',message:'Correcting incomplete changes…',round});}if(submissions.has(call.name)&&++failures>=3)throw new Error(`The proposal could not be validated. ${(value as any).error}`);}
      return {call,value};
    };
    const parallel=new Set(['get_capabilities','get_edit_schema','read_deck','read_assets','search_document','list_workflows','search_fonts','list_templates','get_resource_catalog','search_resources','get_workflow_capabilities','get_connection_status']);
    const workflowResults:WorkflowOutcome[]=[],toolErrors:{tool:string;error:string;code?:string}[]=[];let information:AIInformation|undefined;
    for(let i=0;i<toolCalls.length;){
      const start=i++;if(parallel.has(toolCalls[start].name))while(i<toolCalls.length&&parallel.has(toolCalls[i].name))i++;
      const completed=await Promise.all(toolCalls.slice(start,i).map(execute));
      for(const {call,value} of completed){
        if(submissions.has(call.name)&&!(value as any)?.error)return value as Proposal;
        if((value as any)?.error)toolErrors.push({tool:call.name,error:(value as any).error,code:(value as any).code});
        if((value as any)?.kind==='information')information=AIInformationSchema.parse(value);
        if((value as any)?.kind==='workflow')workflowResults.push(WorkflowOutcomeSchema.parse(value));
        const content=JSON.stringify(value);
        responses.push({type:'function_call_output',call_id:call.id,output:content});messages.push({role:'tool',tool_call_id:call.id,content});
      }
    }
    if(workflowResults.length)return {kind:'workflow',request:workflowResults[0].request,additionalRequests:workflowResults.slice(1).map(v=>v.request),...(toolErrors.length?{failures:toolErrors}: {})};
    // Let the model see failed companion calls before finalizing an answer.
    if(information&&!toolErrors.length)return information;
  }
  throw new Error('The model did not finish a valid proposal. Narrow the request and try again.');
}

/** Backward-compatible edit-only API for integrations that expect a Proposal. */
export async function proposeAI(deck:Deck,prompt:string,scope:EditScope,settings:AISettings,options:AIRunOptions={}):Promise<Proposal>{const result=await runAI(deck,prompt,scope,settings,{...options,workflowServices:undefined});if('kind' in result)throw new Error('Use the workflow-enabled AI endpoint for editor actions.');return result;}
