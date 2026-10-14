import {KeynoteStateSchema,type KeynoteState} from './keynote-source';

export type GoogleTextEdit={objectId:string;start:number;end:number;text:string};
/** Apply presentation-only visibility to the preserved native page IDs. */
export function googleVisibilityRequests(input: unknown, presentation: any): Record<string, unknown>[] {
 const current=KeynoteStateSchema.parse(input), pages=presentation.slides??[];
 if(current.slides.length!==pages.length)throw new Error('The native Google slide counts differ. Import the source again.');
 return current.slides.flatMap((slide,index)=>{
  const page=pages[index], isSkipped=Boolean(slide.hidden);
  if(isSkipped===Boolean(page.slideProperties?.isSkipped))return [];
  if(!page.objectId)throw new Error('The native Google slide is missing. Import the source again.');
  return [{updateSlideProperties:{objectId:page.objectId,slideProperties:{isSkipped},fields:'isSkipped'}}];
 });
}
/** Native export changes text in its original object. Other object properties
 * must remain unchanged so Google's native layout survives conversion. */
export function googleTextEdits(baseline:KeynoteState,input:unknown):GoogleTextEdit[]{
 const current=KeynoteStateSchema.parse(input),edits:GoogleTextEdit[]=[];
 const unsupported=()=>{throw new Error('Native Google export supports compatible text edits. Export PowerPoint for layout, style, or paragraph structure changes.');};
 if(current.width!==baseline.width||current.height!==baseline.height||current.fonts!==baseline.fonts||current.slides.length!==baseline.slides.length)unsupported();
 for(let i=0;i<baseline.slides.length;i++){
  const a=baseline.slides[i],b=current.slides[i];
  if(a.signature!==b.signature||a.notes!==b.notes||a.objects.length!==b.objects.length)unsupported();
  for(let j=0;j<a.objects.length;j++){
   const old=a.objects[j],next=b.objects[j];
   if(old.type!==next.type||old.sourceId!==next.sourceId||old.signature!==next.signature)unsupported();
   if(old.text===next.text)continue;
   if(old.type!=='text'||!old.sourceId||old.text===undefined||next.text===undefined)unsupported();
   const before=old.text!,after=next.text!;
   const lines=before.split('\n'),changed=after.split('\n');if(lines.length!==changed.length)unsupported();
   const ranges:{start:number;end:number;style:string}[]=[];let cursor=0;
   const paragraphs=old.paragraphs??[{runs:old.runs??[{text:before}]}];
   paragraphs.forEach((p,index)=>{for(const r of p.runs){const {text,...attributes}=r,style=JSON.stringify(attributes),last=ranges.at(-1);if(text.length){if(last&&last.end===cursor&&last.style===style)last.end+=text.length;else ranges.push({start:cursor,end:cursor+text.length,style});}cursor+=text.length;}if(index<paragraphs.length-1)cursor++;});
   let offset=0;
   for(let n=0;n<lines.length;n++){
    const x=lines[n],y=changed[n];if(x!==y){
     let prefix=0,suffix=0;while(prefix<x.length&&prefix<y.length&&x[prefix]===y[prefix])prefix++;
     while(suffix<x.length-prefix&&suffix<y.length-prefix&&x[x.length-1-suffix]===y[y.length-1-suffix])suffix++;
     const pairAt=(s:string,n:number)=>/[\uD800-\uDBFF]/.test(s[n-1]??'')&&/[\uDC00-\uDFFF]/.test(s[n]??'');
     if(pairAt(x,prefix)||pairAt(y,prefix))prefix--;
     if(pairAt(x,x.length-suffix)||pairAt(y,y.length-suffix))suffix--;
     const start=offset+prefix,end=offset+x.length-suffix;
     if(!ranges.some(r=>start>=r.start&&end<=r.end&&(start<r.end||start===end&&start===r.end)))unsupported();
     edits.push({objectId:old.sourceId!,start,end,text:y.slice(prefix,y.length-suffix)});
    }offset+=x.length+1;
   }
  }
 }
 return edits.sort((a,b)=>a.objectId.localeCompare(b.objectId)||b.start-a.start);
}

export function googleEditRequests(edits:GoogleTextEdit[],presentation:any):Record<string,unknown>[]{
 const objects=new Map<string,any>();const visit=(e:any)=>{objects.set(e.objectId,e);for(const c of e.elementGroup?.children??[])visit(c);};
 for(const p of presentation.slides??[])for(const e of p.pageElements??[])visit(e);
 return edits.flatMap(edit=>{
  const object=objects.get(edit.objectId);if(!object?.shape?.text)throw new Error('The native Google text object is missing. Import the source again.');
  const nativeRuns=(object.shape.text.textElements??[]).filter((x:any)=>x.textRun);
  const native=nativeRuns.find((r:any)=>(r.startIndex??0)<=edit.start&&r.endIndex>edit.start)??nativeRuns.findLast((r:any)=>r.endIndex===edit.start);
  if(!native)throw new Error('The native text style could not be matched.');
  const requests:Record<string,unknown>[]=[];
  if(edit.end>edit.start)requests.push({deleteText:{objectId:edit.objectId,textRange:{type:'FIXED_RANGE',startIndex:edit.start,endIndex:edit.end}}});
  if(edit.text){
   requests.push({insertText:{objectId:edit.objectId,insertionIndex:edit.start,text:edit.text}});
   const style={...native.textRun.style};
   const fields=Object.keys(style).join(',');if(fields)requests.push({updateTextStyle:{objectId:edit.objectId,textRange:{type:'FIXED_RANGE',startIndex:edit.start,endIndex:edit.start+edit.text.length},style,fields}});
  }
  return requests;
 });
}
