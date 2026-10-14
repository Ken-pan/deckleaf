import {tablePresentation} from './table-appearance';
import {uid,type SlideElement,type Slide} from './model';
import {browserTextSize,type TextSizeMeasure} from './text-layout';

/** The same cell geometry is used by measurement, canvas, HTML and PowerPoint. */
export function tableRowHeights(e:SlideElement,size=e.fontSize,measure:TextSizeMeasure=browserTextSize):number[]{
  const rows=e.cells??[],p=tablePresentation(e),padding=p.padding;
  return rows.map((row,i)=>Math.max((p.heights?.[i]??0)*e.h,Math.ceil(Math.max(size*e.lineHeight,...row.map((text,j)=>{const w=Math.max(1,e.w*p.widths[j]-padding*2-p.borderWidth*2);return measure({...e,type:'text',text,w,fontSize:size,fontWeight:p.headerRow&&i===0?600:e.fontWeight,textSizing:'auto-height',runs:undefined,paragraphs:undefined,padding:undefined,wrap:true},{})?.h??text.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].length*size*.56/w)),0)*size*e.lineHeight;}))+padding*2+p.borderWidth)));
}
export function fitTableElement(e:SlideElement,measure:TextSizeMeasure=browserTextSize):SlideElement{
  if(e.type!=='table'||!e.tableFit||e.locked)return e;
  let lo=Math.min(e.fontSize,e.tableFit.minimumFontSize),hi=e.layoutItem?.basisFontSize??e.fontSize;
  const height=(size:number)=>tableRowHeights(e,size,measure).reduce((a,b)=>a+b,0);
  const sized=(fontSize:number):SlideElement=>({...e,fontSize,layoutItem:{widthMode:'fixed',heightMode:'fixed',...e.layoutItem,basisFontSize:e.layoutItem?.basisFontSize??e.fontSize},design:e.design?{...e.design,textScale:(e.design.textScale??1)*fontSize/e.fontSize}:undefined});
  if(height(hi)<=e.h)return sized(hi);
  for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(height(mid)<=e.h)lo=mid;else hi=mid;}
  return sized(Math.floor(lo*10)/10);
}
/** Continuations are separate native slides, preserving every cell and repeating the header. */
export function continueTable(slide:Slide,id:string,measure:TextSizeMeasure=browserTextSize):Slide[]{
  const table=slide.elements.find(e=>e.id===id);if(!table?.tableFit)return [slide];
  const fitted=fitTableElement(table,measure),rows=fitted.cells??[];
  const heights=tableRowHeights(fitted,fitted.fontSize,measure);
  if(heights.reduce((a,b)=>a+b,0)<=fitted.h)return [{...slide,elements:slide.elements.map(e=>e.id===id?fitted:e)}];
  const hasHeader=tablePresentation(fitted).headerRow,header=rows[0],headerH=hasHeader?heights[0]:0,chunks:string[][][]=[];let chunk=hasHeader?[header]:[],used=headerH;
  for(let i=hasHeader?1:0;i<rows.length;i++){
    if(heights[i]+headerH>fitted.h)throw new Error('A table row is too long. Shorten the cell text or use a larger reading layout.');
    if(used+heights[i]>fitted.h){chunks.push(chunk);chunk=hasHeader?[header]:[];used=headerH;}
    chunk.push(rows[i]);used+=heights[i];
  }
  chunks.push(chunk);
  return chunks.map((cells,i)=>{
    if(!i)return {...slide,elements:slide.elements.map(e=>e.id===id?{...fitted,cells}:e)};
    const ids=new Map([...slide.elements.map(e=>e.id),...(slide.groups??[]).map(g=>g.id)].map(id=>[id,uid('continued')]));
    return {...slide,id:uid('slide'),transition:{effect:'fade',duration:300,easing:'linear'},notes:slide.notes+' Table continuation; header repeated.',
      elements:slide.elements.map(e=>({...e,id:ids.get(e.id)!,group:e.group?ids.get(e.group):undefined,...(e.id===id?{...fitted,id:ids.get(e.id)!,cells}:{}),...(e.type==='text'&&e.y>=736?{text:'Continued'}:{})})),
      groups:slide.groups?.map(g=>({...g,id:ids.get(g.id)!,parent:g.parent?ids.get(g.parent):undefined})),autoLayouts:slide.autoLayouts?.map(l=>({...l,id:ids.get(l.id)!,order:l.order.map(id=>ids.get(id)!)}))};
  });
}
