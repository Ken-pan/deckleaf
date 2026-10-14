import type {SlideElement} from './model';
import type {DesignSystem} from './design-system-schema';
import type {TableStyle} from './table-schema';
export const tablePresets=[{id:'editorial',label:'Editorial',hint:'Quiet rows and clear headings'},{id:'banded',label:'Banded',hint:'Easy to scan longer tables'},{id:'grid',label:'Grid',hint:'Precise rows and columns'},{id:'contrast',label:'Contrast',hint:'A strong header for presentations'}] as const;
export function tableRendering(){
function tablePresetStyle(id:NonNullable<TableStyle['preset']>):TableStyle {
  return {preset:id,headerRow:true,banded:id==='banded',borders:id==='grid'?'grid':'rows',padding:14,borderWidth:id==='grid'?.75:.6,numericAlign:true,verticalAlign:'middle'};
}
/** Old tables keep their existing appearance until a style is explicitly chosen. */
function tableAppearance(e:SlideElement,system?:DesignSystem){
  if(!e.tableStyle)return {text:e.fill,line:e.stroke==='transparent'?'#c6cdc3':e.stroke,background:e.design&&system?system.colors.background:'#f8f8f4',header:e.design&&system?system.colors.surface:'#e1e7da'};
  const mix=(a:string,b:string,t:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  const luminance=(value:string)=>/^#[\da-f]{6}$/i.test(value)?[1,3,5].reduce((sum,i,j)=>sum+parseInt(value.slice(i,i+2),16)/255*[.2126,.7152,.0722][j],0):0;
  const style=e.tableStyle,dark=luminance(e.fill)>.65;
  const background=style.bodyFill??(dark?(system?.colors.dark??'#182521'):(system?.colors.background??'#ffffff'));
  const ink=dark?'#ffffff':'#172b26',base=background==='transparent'?(system?.colors.background??'#ffffff'):background;
  return {text:e.fill,line:style.lineColor??(e.stroke!=='transparent'?e.stroke:mix(base,ink,.16)),background,
    header:style.headerFill??(style.preset==='contrast'?(system?.colors.accent??'#294c46'):mix(base,ink,.055))};
}
/** Shared canvas/HTML/PPTX presentation; standalone exports embed these pure functions. */
function tablePresentation(e:SlideElement,system?:DesignSystem){
  const colors=tableAppearance(e,system),s=e.tableStyle?{...tablePresetStyle(e.tableStyle.preset??'grid'),...e.tableStyle}:undefined,columns=Math.max(1,...(e.cells??[]).map(r=>r.length));
  const mix=(a:string,b:string,t:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  const ink=/^#[\da-f]{6}$/i.test(e.fill)?e.fill:'#172b26',background=colors.background==='transparent'?(system?.colors.background??'#ffffff'):colors.background;
  const luminance=(hex:string)=>[1,3,5].reduce((sum,i,j)=>{const n=parseInt(hex.slice(i,i+2),16)/255;return sum+(n<=.04045?n/12.92:((n+.055)/1.055)**2.4)*[.2126,.7152,.0722][j];},0);
  const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const header=s?.headerText??(e.tableStyle&&colors.header!=='transparent'&&/^#[\da-f]{6}$/i.test(e.fill)&&contrast(e.fill,colors.header)<4.5?(contrast('#ffffff',colors.header)>contrast('#111111',colors.header)?'#ffffff':'#111111'):e.fill);
  const stored=s?.columnWidths?.slice(0,columns)??[],fallback=stored.length?stored.reduce((a,b)=>a+b,0)/stored.length:1;
  const weights=Array.from({length:columns},(_,j)=>stored[j]??fallback),total=weights.reduce((a,b)=>a+b,0);
  const rowCount=e.cells?.length??0,storedRows=s?.rowHeights?.slice(0,rowCount),rowFallback=storedRows?.length?storedRows.reduce((a,b)=>a+b,0)/storedRows.length:1;
  const rowWeights=storedRows?Array.from({length:rowCount},(_,i)=>storedRows[i]??rowFallback):undefined,rowTotal=rowWeights?.reduce((a,b)=>a+b,0)??1;
  const alignments=Array.from({length:columns},(_,j)=>{
    const explicit=s?.columnAlign?.[j];if(explicit&&explicit!=='auto')return explicit;
    const values=(e.cells??[]).slice(s?.headerRow===false?0:1).map(r=>(r[j]??'').trim()).filter(Boolean);
    const numeric=s?.numericAlign&&values.length&&values.every(v=>/^[+-]?(?:\d+(?:,\d{3})*)(?:\.\d+)?%?$/.test(v.replace(/^[\$€£¥]/,'').replace('−','-')));
    return numeric?'right':e.align;
  });
  return {...colors,headerText:header,headerRow:s?.headerRow??true,banded:s?.banded??false,stripe:s?.stripeFill??mix(background,ink,.035),
    borders:s?.borders??'grid',borderWidth:s?.borderWidth??1,padding:s?.padding??e.tableFit?.padding??12,verticalAlign:s?.verticalAlign??'top',
    widths:weights.map(w=>w/total),heights:rowWeights?.map(h=>h/rowTotal),alignments,bodyWeight:e.fontWeight};
}
function tableCellStyle(p:ReturnType<typeof tablePresentation>,row:number,column:number){
  const header=p.headerRow&&row===0,line=`${p.borderWidth}px solid ${p.line}`,grid=p.borders==='grid',rows=p.borders==='rows';
  return {color:header?p.headerText:p.text,background:header?p.header:p.banded&&(row-(p.headerRow?1:0))%2===1?p.stripe:p.background,
    fontWeight:header?600:p.bodyWeight,textAlign:p.alignments[column]??'left',verticalAlign:p.verticalAlign,padding:`${p.padding}px`,
    borderTop:grid?line:'0',borderRight:grid?line:'0',borderBottom:grid||rows?line:'0',borderLeft:grid?line:'0'};
}

return {tablePresetStyle,tableAppearance,tablePresentation,tableCellStyle};
}
export const {tablePresetStyle,tableAppearance,tablePresentation,tableCellStyle}=tableRendering();
export type TablePresentation=ReturnType<typeof tablePresentation>;
export function tablePresetMatches(style:TableStyle|undefined,id:NonNullable<TableStyle['preset']>){
  if(style?.preset!==id)return false;const base=tablePresetStyle(id);
  return Object.entries(base).every(([key,value])=>style[key as keyof TableStyle]===value)&&!['headerFill','headerText','bodyFill','stripeFill','lineColor'].some(key=>style[key as keyof TableStyle]!==undefined);
}
