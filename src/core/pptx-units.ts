import {scaleTableStyle} from './table-schema';
import type {Deck,TextRun} from './model';
/** Preserve imported physical page/font units; normalized editor pixels are
 * not a reason to change native point sizes during export. */
export function nativePptxUnits(deck:Deck):Deck{
 const p=deck.provenance?.pageSize;if(!p||p.canvasWidth!==deck.width||p.canvasHeight!==deck.height)return deck;
 const width=p.width/72*96,height=p.height/72*96,k=width/deck.width;
 const run=(r:TextRun):TextRun=>({...r,fontSize:r.fontSize===undefined?undefined:r.fontSize*k,letterSpacing:r.letterSpacing===undefined?undefined:r.letterSpacing*k});
 return {...deck,width,height,slides:deck.slides.map(s=>({...s,elements:s.elements.map(e=>({...e,x:e.x*k,y:e.y*k,w:e.w*k,h:e.h*k,strokeWidth:e.strokeWidth*k,radius:e.radius*k,fontSize:e.fontSize*k,letterSpacing:e.letterSpacing*k,
  ...(e.type==='line'&&e.h===1?{h:1,y:(e.y+.5)*k-.5}:{}),
  tableStyle:scaleTableStyle(e.tableStyle,k),shadow:e.shadow?{...e.shadow,x:e.shadow.x*k,y:e.shadow.y*k,blur:e.shadow.blur*k}:undefined,
  padding:e.padding?{left:e.padding.left*k,right:e.padding.right*k,top:e.padding.top*k,bottom:e.padding.bottom*k}:undefined,runs:e.runs?.map(run),paragraphs:e.paragraphs?.map(p=>({...p,runs:p.runs.map(run),endStyle:p.endStyle?run(p.endStyle):undefined,spaceBefore:p.spaceBefore*k,spaceAfter:p.spaceAfter*k,indent:p.indent*k,firstLineIndent:p.firstLineIndent*k,lineSpacing:p.lineSpacing===undefined?undefined:p.lineSpacing*k}))}))}))};
}
