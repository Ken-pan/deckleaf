import {scaleTableStyle} from './table-schema';
import type {Slide,SlideElement} from './model';

/** Keep editable container geometry and sizing rules in the target page's coordinate space. */
export function scaleTemplateSlide(slide:Slide,width:number,height:number):Slide {
  const sx=width/1440,sy=height/810,k=Math.min(sx,sy);
  const item=(value:SlideElement['layoutItem'])=>value?{...value,...Object.fromEntries(Object.entries(value).filter(([key])=>/^(basis|min|max)/.test(key)).map(([key,value])=>[key,Math.max(key==='basisFontSize'?4:1,(value as number)*(key==='basisFontSize'?k:key.endsWith('W')||key.endsWith('Width')?sx:sy))]))}:undefined;
  return {...slide,
    layout:slide.layout?{...slide.layout,margins:{left:slide.layout.margins.left*sx,right:slide.layout.margins.right*sx,top:slide.layout.margins.top*sy,bottom:slide.layout.margins.bottom*sy},gutter:slide.layout.gutter*k}:undefined,
    autoLayouts:slide.autoLayouts?.map(l=>({...l,x:l.x*sx,y:l.y*sy,w:Math.max(1,l.w*sx),h:Math.max(1,l.h*sy),textFitHeight:l.textFitHeight===undefined?undefined:l.textFitHeight*sy,gap:l.gap*k,lineGap:l.lineGap===undefined?undefined:l.lineGap*k,padding:{left:l.padding.left*sx,right:l.padding.right*sx,top:l.padding.top*sy,bottom:l.padding.bottom*sy}})),
    groups:slide.groups?.map(g=>({...g,layoutItem:item(g.layoutItem)})),
    elements:slide.elements.map(e=>({...e,x:e.x*sx,y:e.y*sy,w:Math.max(1,e.w*sx),h:Math.max(1,e.h*sy),fontSize:Math.max(4,e.fontSize*k),strokeWidth:e.strokeWidth*k,radius:e.radius*k,layoutItem:item(e.layoutItem),tableStyle:scaleTableStyle(e.tableStyle,k),tableFit:e.tableFit?{minimumFontSize:Math.max(4,e.tableFit.minimumFontSize*k),padding:e.tableFit.padding*k}:undefined}))};
}
