import {isBrowserEdition} from './runtime';
import {ProposalSchema,type Proposal} from './operations';
import type {AIProgress,AISettings,AIRunOptions} from '../../server/ai';
import type {Deck} from './model';
import {WorkflowOutcomeSchema,AIInformationSchema,type WorkflowOutcome,type AIInformation} from './workflows';
import type {CreationBrief} from './ai-story';
import type {AIHistory} from './ai-session';
import type {EditScope} from './ai-editing';

export async function requestAI(input:{deck:Deck;prompt:string;settings:AISettings;scope:EditScope;activeSlideId?:string;creation?:CreationBrief;history?:AIHistory},options:Pick<AIRunOptions,'signal'|'onprogress'>={},transport:typeof fetch=fetch):Promise<Proposal|WorkflowOutcome|AIInformation> {
  if(isBrowserEdition)return (await import('./web/api')).browserJson('/api/ai/propose','POST',input,options);
  const response=await transport('/api/ai/propose',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(input),signal:options.signal});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error??'The AI request could not start. Try again.');}
  if(!response.headers.get('content-type')?.includes('text/event-stream')){const result=await response.json();return result.kind==='information'?AIInformationSchema.parse(result):result.kind==='workflow'?WorkflowOutcomeSchema.parse(result):ProposalSchema.parse(result);}
  if(!response.body)throw new Error('The AI connection closed. Try again.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',proposal:Proposal|WorkflowOutcome|AIInformation|undefined;
  try {
    while(true){
      options.signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      if(buffer.length>40_000_000)throw new Error('The proposal is too large. Reduce the scope and try again.');
      let end:number;
      while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)continue;
        const message=JSON.parse(data);
        if(message.type==='progress')options.onprogress?.(message.data as AIProgress);
        if(message.type==='error')throw new Error(message.data.message);
        if(message.type==='workflow')proposal=message.data.kind==='information'?AIInformationSchema.parse(message.data):WorkflowOutcomeSchema.parse(message.data);
        if(message.type==='proposal')proposal=ProposalSchema.parse(message.data);
      }
    }
    if(!proposal)throw new Error('The AI connection closed before the proposal finished. Try again.');
    options.signal?.throwIfAborted();return proposal;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
