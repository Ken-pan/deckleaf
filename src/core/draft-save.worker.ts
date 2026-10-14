import {restoreDraft} from './draft-media-transport';
import {writeStoredDraft} from './draft-store';

const channel=globalThis as unknown as {postMessage:(value:unknown)=>void;onmessage:(event:MessageEvent)=>void};
channel.onmessage=async event=>{
  const {id,body}=event.data;
  try{
    await writeStoredDraft(restoreDraft(body));
    channel.postMessage({type:'result',id});
  }catch(error){channel.postMessage({type:'result',id,error:(error as Error).message});}
};
channel.postMessage({type:'ready'});
