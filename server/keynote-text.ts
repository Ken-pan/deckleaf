import {loadBoundedZip, readZipXml} from '../src/core/safe-zip';
import {XMLParser} from 'fast-xml-parser';
import {importPptx} from '../src/importers/pptx';

const quoted = (text:string) => '"'+text.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r\n|[\r\n]/g,'" & return & "')+'"';
/** Keynote's PPTX importer truncates fractional point sizes. Restore them only
 * on the document copy this export creates, preserving each rich-text range. */
export async function keynoteFontRestoration(bytes:Uint8Array) {
 const zip=await loadBoundedZip(bytes),parser=new XMLParser({ignoreAttributes:false});
 const presentation=parser.parse(await readZipXml(zip,'ppt/presentation.xml'));
 const width=Number(presentation['p:presentation']['p:sldSz']['@_cx'])/12700;
 const deck=await importPptx(bytes,'export.pptx'),factor=width/deck.width;
 const commands:string[]=[];let expected=0;
 for(let i=0;i<deck.slides.length;i++)for(const e of deck.slides[i].elements){
  if(e.type!=='text'||!e.text||/[\uD800-\uDFFF]/.test(e.text))continue;
  const paragraphs=e.paragraphs??[{runs:e.runs??[{text:e.text,fontSize:e.fontSize}]}];
  const ranges:{start:number;end:number;size:number}[]=[];let offset=0;
  for(let j=0;j<paragraphs.length;j++){
   for(const r of paragraphs[j].runs){const start=offset+1;offset+=r.text.length;if(r.text.length)ranges.push({start,end:offset,size:Number(((r.fontSize??e.fontSize)*factor).toFixed(4))});}
   if(j<paragraphs.length-1)offset++;
  }
  if(!ranges.some(r=>Math.abs(r.size-Math.round(r.size))>.001))continue;
  expected++;
  commands.push(`set expectedText to ${quoted(e.text)}
    set didMatch to false
    repeat with candidate in text items of slide ${i+1} of importedDoc
      if not didMatch and (my normalizedText(object text of candidate as text)) is expectedText then
        if (count of characters of object text of candidate) is ${e.text.length} then
          ${ranges.map(r=>`set size of characters ${r.start} thru ${r.end} of object text of candidate to (${r.size} * nativeFontScale)`).join('\n          ')}
          set applied to applied + 1
          set didMatch to true
        end if
      end if
    end repeat`);
 }
 return {expected,script:`set nativeFontScale to (width of importedDoc) / ${width}\n`+commands.join('\n'),helpers:`on normalizedText(value)
  set savedDelimiters to AppleScript's text item delimiters
  repeat with separator in {linefeed, character id 11, character id 8232, character id 8233}
    set AppleScript's text item delimiters to (separator as text)
    set pieces to text items of value
    set AppleScript's text item delimiters to return
    set value to pieces as text
  end repeat
  set AppleScript's text item delimiters to savedDelimiters
  return value
end normalizedText`};
}
