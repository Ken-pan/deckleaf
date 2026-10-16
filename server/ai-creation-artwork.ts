import type {EditingServices} from '../src/core/ai-tools';
import type {Operation} from '../src/core/operations';
import {templateSignature} from '../src/core/template-ownership';

export async function creationArtwork(query:string,services?:EditingServices){
 if(!query.trim()||!services)return [];
 let result=await services.searchResources(new URLSearchParams({kind:'illustration',q:query,view:'illustrations'}));
 // Multiword catalog search requires every term. A subject noun can still find
 // useful artwork when a task phrase such as "book return" is too specific.
 if(!result.items.length&&query.trim().split(/\s+/).length>1)result=await services.searchResources(new URLSearchParams({kind:'illustration',q:query.trim().split(/\s+/)[0],view:'illustrations'}));
 if(!result.items.length&&/s$/i.test(query.trim().split(/\s+/)[0]))result=await services.searchResources(new URLSearchParams({kind:'illustration',q:query.trim().split(/\s+/)[0].replace(/s$/i,''),view:'illustrations'}));
 const terms=query.toLowerCase().split(/\s+/).map(word=>word.replace(/s$/,'')),exact=result.items.filter(item=>terms.some(term=>[item.title,...(item.tags??[])].some(text=>text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).some(word=>word.replace(/s$/,'')===term))));
 return (exact.length?exact:result.items).filter(item=>item.kind==='illustration').slice(0,12).map(({id,title,tags})=>({id,title,tags}));
}
/** Only a discovered local-library ID may replace the fresh cover's native frame. */
export async function applyCreationArtwork(operations:Operation[],id:string|undefined,available:{id:string}[],services?:EditingServices){
 if(!id)return;
 if(!services||!available.some(item=>item.id===id))throw new Error('Choose coverResourceId only from the supplied coverArtwork choices; never invent an asset ID.');
 const slide=operations.find(op=>op.op==='add_slide');
 if(!slide||slide.op!=='add_slide'||slide.slide.template?.prototype!=='cover')throw new Error('Selected cover artwork needs the first slide to use the cover layout.');
 const frame=slide.slide.elements.find(e=>e.type==='image');if(!frame)throw new Error('Selected cover artwork needs noImage:false and coverVisual:illustration.');
 const asset=await services.importResource({id});
 if(asset.resource.kind!=='illustration')throw new Error('Choose an illustration from the supplied coverArtwork choices.');
 Object.assign(frame,{src:asset.src,resource:asset.resource,name:asset.resource.title,fit:'contain'});
 const generated=slide.slide.template.generated?.find(entry=>entry.id===frame.id);if(generated)generated.signature=templateSignature(frame);
}
