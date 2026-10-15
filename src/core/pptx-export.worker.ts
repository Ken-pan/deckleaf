import {buildPptx} from './pptx-export';
import type {PptxExportRequest} from './background-pptx-export';
import {restoreDocumentMedia,type PackedDocumentMedia} from './document-media-transport';
import {loadPptxImage} from './pptx-image';
type Request=Omit<PptxExportRequest,'deck'> & {media:PackedDocumentMedia};
const channel=globalThis as unknown as {postMessage:(value:unknown,transfer?:Transferable[])=>void;onmessage:(event:MessageEvent<Request>)=>void};
channel.onmessage=async event=>{
  const {media,original,dimensions}=event.data;
  try{
    const deck=restoreDocumentMedia(media);
    const decoded=new Map<string,Promise<{w:number;h:number}>>();
    const bytes=await buildPptx(deck,original,async(src,name,id)=>{
      const size=id&&dimensions[id];if(size)return size;
      if(!decoded.has(src))decoded.set(src,(async()=>{
        const bitmap=await createImageBitmap(await loadPptxImage(src,name));
        try{return {w:bitmap.width,h:bitmap.height};}finally{bitmap.close();}
      })());
      return decoded.get(src)!;
    },event.data.template);
    channel.postMessage({type:'result',bytes},[bytes.buffer as ArrayBuffer]);
  }catch(error){channel.postMessage({type:'result',error:(error as Error).message});}
};
channel.postMessage({type:'ready',bitmapSupported:typeof createImageBitmap==='function'});
