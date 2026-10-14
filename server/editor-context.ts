import {EditorContextSchema,type EditorContext} from '../src/core/editor-context';
import {readDeck} from './store';
export class EditorContextStore {
 private windows=new Map<string,EditorContext&{seenAt:number}>();
 constructor(private getDeck=readDeck,private now=Date.now){}
 update(raw:unknown){const value=EditorContextSchema.parse(raw);this.windows.delete(value.clientId);this.windows.set(value.clientId,{...value,seenAt:this.now()});while(this.windows.size>8)this.windows.delete(this.windows.keys().next().value!);return {accepted:true};}
 async read(deckId?:string){
  const live=[...this.windows.values()].filter(value=>value.visible&&this.now()-value.seenAt<15000&&value.deckId),matching=deckId?live.filter(value=>value.deckId===deckId):live;
  const focused=matching.filter(value=>value.focused).sort((a,b)=>b.seenAt-a.seenAt),current=focused[0]??(matching.length===1?matching[0]:undefined);
  if(!current&&!deckId)return {state:matching.length?'ambiguous':'no_open_document',editorReachable:true,documents:await Promise.all([...new Set(matching.map(value=>value.deckId!))].map(async id=>{try{const deck=await this.getDeck(id);return {deckId:deck.id,title:deck.title,revision:deck.revision};}catch{return {deckId:id,unavailable:true};}})),next:matching.length?'Choose a document ID; do not guess between open windows.':'Open a document in the editor or use list_decks.'};
  const requested=deckId??current!.deckId!;let deck;
  try{deck=await this.getDeck(requested);}catch{return {state:'document_unavailable',editorReachable:true,deckId:requested,requiresSave:true,next:'Preserve the current local draft. Save or reopen the document before preparing an edit, or use list_decks to choose a saved document. Do not guess another window.'};}
  const selected=new Set(deck.slides.flatMap(slide=>slide.elements.map(e=>e.id)));
  const selectedIds=current?.selectedIds.filter(id=>selected.has(id))??[];const chosen=new Set(selectedIds);const selectedObjects=deck.slides.flatMap(slide=>slide.elements.filter(e=>chosen.has(e.id)).map(e=>({slideId:slide.id,elementId:e.id,type:e.type,name:e.name,text:e.text.slice(0,160),locked:e.locked,box:{x:e.x,y:e.y,w:e.w,h:e.h}}))).slice(0,40);
  const unsaved=Boolean(current?.dirty||current&&current.revision>deck.revision),stale=Boolean(current&&current.revision<deck.revision),active=deck.slides.find(slide=>slide.id===current?.activeSlideId);
  return {state:current?'open':'saved_document',editorReachable:true,deckId:deck.id,title:deck.title,revision:deck.revision,width:deck.width,height:deck.height,slideCount:deck.slides.length,...(current?{localRevision:current.revision,observedAt:new Date(current.seenAt).toISOString(),activeSlideId:active?.id,activeSlideNumber:active?deck.slides.indexOf(active)+1:undefined,selectedIds,selectedObjects,selectedObjectsTruncated:selectedIds.length>selectedObjects.length,sourceMode:current.sourceMode,presenting:current.presenting,pendingProposal:current.pendingProposal}:{}),requiresSave:unsaved,requiresReload:stale,next:stale?'The editor is showing an older revision. Preserve any local draft, then reopen the saved document before editing.':unsaved?'Save the current editor document before preparing an edit.':current?.pendingProposal?'Review the pending proposal before preparing another edit.':'Use search_document for targets or read_deck for details, then submit one proposal.'};
 }
}
export const editorContexts=new EditorContextStore();
