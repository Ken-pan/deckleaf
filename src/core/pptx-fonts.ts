import type JSZip from 'jszip';
import type {Deck} from './model';
export type PptxFontLoader=(path:string)=>Promise<Uint8Array>;
const browserLoader:PptxFontLoader=async path=>{const r=await fetch(path);if(!r.ok)throw new Error('Native font data could not load. Retry the export.');return new Uint8Array(await r.arrayBuffer());};
type Face={family:string;style:'regular'|'bold';file:string;fsType:number};
/** Full fonts allow future edits. Only bundled, verified OFL faces are embedded. */
export async function embedPptxFonts(zip:JSZip,deck:Deck,load:PptxFontLoader=browserLoader):Promise<void>{
  if(load===browserLoader&&typeof location==='undefined')return;
  const raw=await load('/fonts/pptx/manifest.json'),faces=JSON.parse(new TextDecoder().decode(raw)) as Face[];
  const families=new Set(deck.slides.flatMap(s=>s.elements.flatMap(e=>[e.fontFamily,...[...(e.runs??[]),...(e.paragraphs?.flatMap(p=>[...p.runs,...(p.endStyle?[p.endStyle]:[])])??[])].map(r=>r.fontFamily??e.fontFamily)])));
  if(deck.designSystem){families.add(deck.designSystem.typography.title.fontFamily);families.add(deck.designSystem.typography.body.fontFamily);families.add('Noto Sans SC');if(deck.designSystem.typography.title.fontFamily==='DM Serif Display')families.add('Noto Serif SC');}
  if(deck.slides.some(s=>s.elements.some(e=>/[\u3400-\u9fff]/.test(e.text+(e.cells?.flat().join('')??'')+(e.chart?JSON.stringify(e.chart):'')+(e.values?.map(v=>v.label).join('')??'')+(e.paragraphs?.flatMap(p=>p.runs.map(r=>r.text)).join('')??''))))){families.add('Noto Sans SC');if(families.has('DM Serif Display'))families.add('Noto Serif SC');}
  const selected=faces.filter(f=>families.has(f.family));if(!selected.length)return;
  let rels=await zip.file('ppt/_rels/presentation.xml.rels')!.async('string'),xml=await zip.file('ppt/presentation.xml')!.async('string'),content=await zip.file('[Content_Types].xml')!.async('string');
  let rel=Math.max(...[...rels.matchAll(/Id="rId(\d+)"/g)].map(m=>Number(m[1])))+1;const entries=new Map<string,string[]>();
  for(const [i,face] of selected.entries()){
    if(face.fsType!==0)throw new Error('This font does not permit full editable embedding.');
    const bytes=await load(face.file),data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(data.getUint16(34,true)!==0x504c||data.getUint32(0,true)!==bytes.byteLength)throw new Error('Native font payload is invalid.');
    const id=`rId${rel++}`,path=`fonts/template-font-${i+1}.fntdata`;zip.file('ppt/'+path,bytes);
    rels=rels.replace('</Relationships>',`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${path}"/></Relationships>`);
    entries.set(face.family,[...(entries.get(face.family)??[]),`<p:${face.style} r:id="${id}"/>`]);
  }
  const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const list=`<p:embeddedFontLst>${[...entries].map(([family,refs])=>`<p:embeddedFont><p:font typeface="${esc(family)}"/>${refs.join('')}</p:embeddedFont>`).join('')}</p:embeddedFontLst>`;
  xml=xml.replace(/ embedTrueTypeFonts="[^"]*"| saveSubsetFonts="[^"]*"/g,'').replace(/<p:presentation\b/,'<p:presentation embedTrueTypeFonts="1" saveSubsetFonts="0"');
  xml=xml.replace(/(<p:defaultTextStyle\b|<p:extLst\b|<\/p:presentation>)/,list+'$1');
  if(!content.includes('Extension="fntdata"'))content=content.replace('</Types>','<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>');
  zip.file('ppt/presentation.xml',xml);zip.file('ppt/_rels/presentation.xml.rels',rels);zip.file('[Content_Types].xml',content);
}
