import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {keynoteState,KeynoteStateSchema,type KeynoteState} from '../src/core/keynote-source';
import {importPptx} from '../src/importers/pptx';
import {DATA} from './store';
import type {Deck} from '../src/core/model';
const quoted=(t:string)=>'"'+t.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r\n|[\r\n]/g,'" & return & "')+'"';
export async function nativeKeynotePlan(source:NonNullable<Deck['nativeSource']>,input:unknown){
 if(source.provider!=='Keynote'||! /^[a-f0-9-]{36}$/i.test(source.id))throw new Error('Invalid native Keynote source.');
 const dir=resolve(DATA,'imports',source.id);
 const original=await readFile(resolve(dir,'source.key'));
 if(createHash('sha256').update(original).digest('hex')!==source.sha256)throw new Error('The preserved Keynote source has changed.');
 const baseline=await keynoteState(await importPptx(await readFile(resolve(dir,'converted.pptx')),'source.key'));
 const plan=nativeKeynoteEdits(baseline,input);return plan?{...plan,original}:null;
}
export function nativeKeynoteEdits(baseline:KeynoteState,input:unknown){
 const current=KeynoteStateSchema.parse(input);
 if(current.width!==baseline.width||current.height!==baseline.height||current.fonts!==baseline.fonts||current.slides.length!==baseline.slides.length)return null;
 const changed:{slide:number;before:NonNullable<KeynoteState['slides'][number]['objects'][number]['text']>;original:KeynoteState['slides'][number]['objects'][number];after:KeynoteState['slides'][number]['objects'][number]}[]=[];
 for(let i=0;i<baseline.slides.length;i++){
  const a=baseline.slides[i],b=current.slides[i];if(Boolean(a.hidden)!==Boolean(b.hidden)||a.notes!==b.notes||a.signature!==b.signature||a.objects.length!==b.objects.length)return null;
  for(let j=0;j<a.objects.length;j++){
   const old=a.objects[j],next=b.objects[j];if(old.type!==next.type||old.sourceId!==next.sourceId||old.signature!==next.signature)return null;
   if(old.text!==next.text){
    // Preserve paragraph boundaries and native layout attributes. Other edits
    // use the editable PPTX conversion, with an explicit export warning.
    if(old.type!=='text'||!old.text||next.text===undefined||/[\uD800-\uDFFF]/.test(old.text+next.text)||old.text.split('\n').length!==next.text.split('\n').length)return null;
    if(a.objects.filter(o=>o.type==='text'&&o.text===old.text).length!==1)return null;
    changed.push({slide:i+1,before:old.text,original:old,after:next});
   }
  }
 }
 if(!changed.length)return {changed:0,script:'',helpers:''};
 const commands:string[]=[];
 for(const edit of changed){
  // Let Keynote inherit the original native attributes. Reapplying effective
  // PPTX sizes would apply the native autofit scale a second time.
  const ranges:{start:number;end:number;style:string}[]=[];let cursor=0;
  const oldParagraphs=edit.original.paragraphs??[{runs:edit.original.runs??[{text:edit.before}]}];
  oldParagraphs.forEach((p,i)=>{for(const r of p.runs){const {text,...attributes}=r;const style=JSON.stringify(attributes),last=ranges.at(-1);if(text.length){if(last&&last.end===cursor&&last.style===style)last.end+=text.length;else ranges.push({start:cursor,end:cursor+text.length,style});}cursor+=text.length;}if(i<oldParagraphs.length-1)cursor++;});
  const before=edit.before.split('\n'),after=edit.after.text!.split('\n'),patches:string[]=[];let offset=0;
  for(let i=0;i<before.length;i++){
   const old=before[i],next=after[i];
   if(old!==next){let prefix=0,suffix=0;while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix])prefix++;while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
    let start=offset+prefix+1,end=offset+old.length-suffix,replacement=next.slice(prefix,next.length-suffix);
    if(end<start){if(prefix<old.length){end=start;replacement+=old[prefix];}else if(old.length){start=end=offset+old.length;replacement=old.at(-1)!+replacement;}else return null;}
    if(!ranges.some(r=>start-1>=r.start&&end<=r.end))return null;
    if(end-start>500)return null;
    // iWork broadcasts assignments to a characters collection. Delete the
    // suffix backwards, then replace one character to retain its attributes.
    patches.unshift(`${end>start?`repeat with removeAt from ${end} to ${start+1} by -1\n          set character removeAt of object text of candidate to ""\n        end repeat\n        `:''}set character ${start} of object text of candidate to ${quoted(replacement)}`);
   }offset+=old.length+1;
  }
  commands.push(`set didMatch to false
    repeat with candidate in text items of slide ${edit.slide} of importedDoc
      if not didMatch and (my normalizedText(object text of candidate as text)) is ${quoted(edit.before)} then
        ${patches.join('\n        ')}
        if (my normalizedText(object text of candidate as text)) is not ${quoted(edit.after.text!)} then error "Native text verification failed. The source is preserved."
        set didMatch to true
        set applied to applied + 1
      end if
    end repeat
    if not didMatch then error "A native text object could not be matched. The source is preserved."`);
 }
 const helpers=`on normalizedText(value)
  set savedDelimiters to AppleScript's text item delimiters
  repeat with separator in {linefeed, character id 11, character id 8232, character id 8233}
    set AppleScript's text item delimiters to separator as text
    set pieces to text items of value
    set AppleScript's text item delimiters to return
    set value to pieces as text
  end repeat
  set AppleScript's text item delimiters to savedDelimiters
  return value
end normalizedText`;
 return {changed:changed.length,helpers,script:`set documentScale to (width of importedDoc) / ${baseline.width}\n`+commands.join('\n')};
}
