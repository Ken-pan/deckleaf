import {XMLParser} from 'fast-xml-parser';
import type {SlideElement,TextRun} from './model';
export function textLayoutFingerprint(e:SlideElement){return JSON.stringify({text:e.text,runs:e.runs,paragraphs:e.paragraphs,w:e.w,h:e.h,fontFamily:e.fontFamily,fontSize:e.fontSize,fontWeight:e.fontWeight,fill:e.fill,lineHeight:e.lineHeight,letterSpacing:e.letterSpacing,align:e.align,verticalAlign:e.verticalAlign,italic:e.italic,underline:e.underline,wrap:e.wrap,textSizing:e.textSizing,maxLines:e.maxLines,padding:e.padding});}
// Content edits invalidate native line breaks, but do not invalidate the font's
// source metrics. Compare effective typography independently of run text/length.
export function textMetricsFingerprint(e:SlideElement){
 const runs=e.paragraphs?.flatMap(p=>p.runs)??e.runs??[{text:e.text}],styles=[...new Set(runs.filter(r=>r.text).map(r=>JSON.stringify({family:r.fontFamily??e.fontFamily,size:r.fontSize??e.fontSize,weight:r.fontWeight??(r.bold===undefined?e.fontWeight:r.bold?700:400),italic:r.italic??e.italic,spacing:r.letterSpacing??e.letterSpacing})))].sort();
 const paragraphs=[...new Set((e.paragraphs??[{}]).map(p=>JSON.stringify({lineHeight:('lineHeight'in p?p.lineHeight:undefined)??e.lineHeight,lineSpacing:'lineSpacing'in p?p.lineSpacing:undefined,spaceBefore:('spaceBefore'in p?p.spaceBefore:undefined)??0,spaceAfter:('spaceAfter'in p?p.spaceAfter:undefined)??0})))].sort();
 return JSON.stringify({family:e.fontFamily,size:e.fontSize,weight:e.fontWeight,italic:e.italic,lineHeight:e.lineHeight,letterSpacing:e.letterSpacing,padding:e.padding,verticalAlign:e.verticalAlign,styles,paragraphs});
}
/** Read native SVG text spans, never execute or rasterize the SVG. Figma's
 * native wrap/truncation decisions become editable runs in the PPTX. */
export function figmaVisibleLayout(svg:string,e:SlideElement,scale=1):{runs:TextRun[];lineSpacing?:number;wrapSlack?:number}|undefined{
 if(svg.length>200000)return undefined;
 try{const root=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,htmlEntities:true}).parse(svg).svg;
  const texts=Array.isArray(root.text)?root.text:root.text?[root.text]:[],out:TextRun[]=[],spacings:number[]=[];let lastY:number|undefined;
  for(const text of texts){const spans=Array.isArray(text.tspan)?text.tspan:text.tspan?[text.tspan]:[];
   for(const span of spans){const content=typeof span==='string'?span:span['#text'];if(typeof content!=='string')return undefined;const y=Number(span.y??lastY??0);if(!Number.isFinite(y))return undefined;if(lastY!==undefined&&Math.abs(y-lastY)>.1){out.push({text:'\n'});spacings.push((y-lastY)*scale);}lastY=y;
    const size=Number(span['font-size']??text['font-size']??e.fontSize/scale),weight=span['font-weight']??text['font-weight'];
    out.push({text:content,fontFamily:span['font-family']??text['font-family']??e.fontFamily,fontSize:size*scale,fontWeight:weight==='bold'?700:weight===undefined?e.fontWeight:Number(weight),color:span.fill??text.fill??e.fill,italic:(span['font-style']??text['font-style'])==='italic'||e.italic,underline:e.underline,letterSpacing:e.letterSpacing});
   }
  }
  const normalize=(s:string)=>s.replace(/\s+/g,' ').trim().toLocaleLowerCase();
  const visible=normalize(out.map(r=>r.text).join('')),full=normalize(e.text);let wrapSlack:number|undefined;
  // Figma's non-outlined SVG omits its generated ellipsis. The wrapped spans
  // still identify the exact visible prefix; preserve the terminal glyph.
  if(e.maxLines!==undefined&&visible.length<full.length&&full.startsWith(visible)){const last=out.at(-1)!;last.text=last.text.trimEnd();
   // The SVG can include a terminal glyph underneath the generated ellipsis.
   // Keep the painted partial word rather than discarding the entire fragment.
   if(/[\p{L}\p{N}]/u.test(full[visible.length]??'')&&/[\p{L}\p{N}]$/u.test(visible)){last.text=last.text.replace(/[\p{L}\p{N}]$/u,'').trimEnd();wrapSlack=Math.min(100,e.fontSize/4);}
   last.text+='…';}
  const spacing=spacings[0];return out.length?{runs:out,...(wrapSlack?{wrapSlack}:{}),...(spacing>=1&&spacing<=2000&&spacings.every(v=>Math.abs(v-spacing)<.05)?{lineSpacing:spacing}:{})}:undefined;
 }catch{return undefined;}
}
export function figmaVisibleRuns(svg:string,e:SlideElement,scale=1):TextRun[]|undefined{return figmaVisibleLayout(svg,e,scale)?.runs;}
export function renderedPptxText(e:SlideElement):SlideElement{
 const layout=e.nativeTextLayout;if(e.type!=='text'||!layout)return e;
 const wrapped=layout.fingerprint===textLayoutFingerprint(e),metrics=wrapped||layout.metricsFingerprint===textMetricsFingerprint(e);if(!metrics)return e;
 const text=wrapped?layout.runs.map(r=>r.text).join(''):e.text,runs=wrapped?layout.runs:e.runs;
 // Some consumers discard DrawingML's no-wrap rule. Give a native, single-line
 // right-aligned label bounded layout slack while retaining its painted anchor.
 const slack=wrapped&&e.rotation%360===0?Math.max(layout.wrapSlack??0,e.align==='right'&&!text.includes('\n')?e.fontSize*4:0):0,anchor=e.align==='right'?1:e.align==='center'?.5:0;
 // DrawingML percent spacing is relative to the destination font's intrinsic
 // line height. Figma's FONT_SIZE_% spacing is relative to the font size itself.
 // Source SVG baseline distances therefore need absolute point spacing.
 const lineSpacing=layout.lineSpacing??e.fontSize*e.lineHeight;
 // Figma also records spacing as a percentage of its font's intrinsic height.
 // Preserve that source value for consumers (including Google) which translate
 // absolute PPTX spacing back to a font-size percentage during conversion.
 const intrinsic=layout.intrinsicLineHeight,halfLeading=intrinsic?Math.max(0,lineSpacing-lineSpacing/intrinsic)/2:0,padding=e.padding??{left:0,right:0,top:0,bottom:0};
 const paragraphs=wrapped?[{runs:layout.runs,align:e.align,spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]:(e.paragraphs??[{runs:runs??[{text:e.text}],align:e.align,spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]);
 return {...e,x:e.x-slack*anchor,w:e.w+slack,text,runs,paragraphs:paragraphs.map(p=>({...p,...(intrinsic?{lineHeight:intrinsic,lineSpacing:undefined}:{lineSpacing})})),padding:halfLeading?{...padding,top:padding.top+(e.verticalAlign==='top'?halfLeading:0),bottom:padding.bottom+(e.verticalAlign==='bottom'?halfLeading:0)}:e.padding,wrap:wrapped?false:e.wrap,textFit:wrapped?'none':e.textFit};
}
export function renderedStyleFingerprint(e:SlideElement,scale=1){
 const runs=e.paragraphs?.flatMap((p,i)=>[...(i?[{text:'\n'}]:[]),...p.runs])??e.runs??[{text:e.text}],result:{length:number;style:string}[]=[];
 for(const r of runs){if(!r.text)continue;const style=JSON.stringify({family:r.fontFamily??e.fontFamily,size:Math.round((r.fontSize??e.fontSize)*scale*100)/100,weight:(r.fontWeight??(r.bold===undefined?e.fontWeight:r.bold?700:400))>=600?700:400,italic:r.italic??e.italic,underline:r.underline??e.underline,color:(r.color??e.fill).toLowerCase(),spacing:Math.round((r.letterSpacing??e.letterSpacing)*scale*100)/100,baseline:r.baseline??'normal'}),last=result.at(-1);if(last?.style===style)last.length+=r.text.length;else result.push({length:r.text.length,style});}
 return JSON.stringify(result);
}
