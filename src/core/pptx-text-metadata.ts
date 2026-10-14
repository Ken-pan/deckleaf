import JSZip from 'jszip';
import {readZipXml} from './safe-zip';
import {z} from 'zod';
import {TextRunSchema,ParagraphSchema,ElementSchema,type Deck} from './model';
import {renderedStyleFingerprint} from './native-text-layout';
const path='customXml/deck-studio-text.xml';
const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const schema=z.object({version:z.literal(2),canvasWidth:z.number().min(100).max(10000),canvasHeight:z.number().min(100).max(10000),slides:z.array(z.array(z.object({name:z.string().max(120),text:z.string().max(50000),renderedText:z.string().max(50000),renderedStyle:z.string().max(200000),maxLines:z.number().int().min(1).max(1000).optional(),wrap:z.boolean(),textFit:z.enum(['none','normal','shape']).optional(),fontFamily:z.string().max(100),fontSize:z.number().positive(),lineHeight:z.number().min(.5).max(4).optional(),fill:z.string(),x:z.number(),y:z.number(),w:z.number().positive(),h:z.number().positive(),padding:ElementSchema.shape.padding,renderedPadding:ElementSchema.shape.padding,renderedFrame:z.object({x:z.number(),y:z.number(),w:z.number().positive(),h:z.number().positive()}),runs:z.array(TextRunSchema).max(5000).optional(),paragraphs:z.array(ParagraphSchema).max(5000).optional(),nativeTextLayout:ElementSchema.shape.nativeTextLayout}).strict()).max(3000)).max(500)}).strict();
export async function writePptxTextMetadata(zip:JSZip,deck:Deck,authored=deck){
 const slides=authored.slides.map((s,i)=>s.elements.filter(e=>!e.hidden&&e.type==='text'&&(e.maxLines!==undefined||e.nativeTextLayout)).map(e=>{const rendered=deck.slides[i].elements.find(v=>v.id===e.id)!,scale=authored.width/deck.width;return {name:e.id,text:e.text,renderedText:rendered.text,renderedStyle:renderedStyleFingerprint(rendered,scale),maxLines:e.maxLines,wrap:e.wrap,textFit:e.textFit,fontFamily:e.fontFamily,fontSize:e.fontSize,lineHeight:e.lineHeight,fill:e.fill,x:e.x,y:e.y,w:e.w,h:e.h,padding:e.padding,renderedPadding:Object.fromEntries(Object.entries(rendered.padding??{left:0,right:0,top:0,bottom:0}).map(([key,value])=>[key,value*scale])),renderedFrame:{x:rendered.x*scale,y:rendered.y*scale,w:rendered.w*scale,h:rendered.h*scale},runs:e.runs,paragraphs:e.paragraphs,nativeTextLayout:e.nativeTextLayout};}));
 if(!slides.some(s=>s.length))return;
 const value=JSON.stringify({version:2,canvasWidth:authored.width,canvasHeight:authored.height,slides});if(value.length>5_000_000)throw new Error('The text truncation metadata is too large.');
 zip.file(path,`<?xml version="1.0" encoding="UTF-8"?><deck:text xmlns:deck="https://deck.studio/pptx/text/1">${escape(value)}</deck:text>`);
 const types=zip.file('[Content_Types].xml');if(types)zip.file('[Content_Types].xml',(await types.async('string')).replace('</Types>',`<Override PartName="/${path}" ContentType="application/xml"/></Types>`));
 const rel='ppt/_rels/presentation.xml.rels',file=zip.file(rel);if(file)zip.file(rel,(await file.async('string')).replace('</Relationships>',`<Relationship Id="rIdDeckStudioText" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../${path}"/></Relationships>`));
}
export async function readPptxTextMetadata(zip:JSZip){
 const file=zip.file(path);if(!file)return undefined;if((file as any)._data?.uncompressedSize>5_000_000)return undefined;
 try{const raw=await readZipXml(zip,path,5_000_000);if(raw.length>5_000_000)return undefined;const {XMLParser}=await import('fast-xml-parser');const parsed=new XMLParser({removeNSPrefix:true}).parse(raw);return schema.parse(JSON.parse(parsed.text));}catch{return undefined;}
}
