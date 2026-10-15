import type {SlideElement} from './model';
import type {TableMerge,TableCellStyle,TableStyle} from './table-schema';
import {validateTableStyle} from './table-schema';
import {tableColumnStyle} from './table-columns';
import {tablePresentation} from './table-appearance';
import {cellBounds,type Cell,type CellRange} from './table-grid';
import type {DesignSystem} from './design-system-schema';
export const tableColumns=(cells:string[][])=>Math.max(1,...cells.map(row=>row.length));
export function cellMerge(style:TableStyle|undefined,row:number,column:number){return style?.merges?.find(m=>row>=m.row&&row<m.row+m.rowSpan&&column>=m.column&&column<m.column+m.columnSpan);}
export function cellOwner(style:TableStyle|undefined,cell:Cell):Cell{const m=cellMerge(style,cell.row,cell.column);return m?{row:m.row,column:m.column}:cell;}
/** Selecting any part of a merged cell selects its complete rectangle. */
export function expandMergedRange(style:TableStyle|undefined,range:CellRange):CellRange{
  const b=cellBounds(range);let changed=true;
  while(changed){changed=false;for(const m of style?.merges??[]){if(m.row>b.bottom||m.row+m.rowSpan-1<b.top||m.column>b.right||m.column+m.columnSpan-1<b.left)continue;const next={top:Math.min(b.top,m.row),bottom:Math.max(b.bottom,m.row+m.rowSpan-1),left:Math.min(b.left,m.column),right:Math.max(b.right,m.column+m.columnSpan-1)};if(JSON.stringify(next)!==JSON.stringify(b)){Object.assign(b,next);changed=true;}}}
  return {anchor:{row:range.anchor.row<=range.head.row?b.top:b.bottom,column:range.anchor.column<=range.head.column?b.left:b.right},head:{row:range.anchor.row<=range.head.row?b.bottom:b.top,column:range.anchor.column<=range.head.column?b.right:b.left}};
}
function localStyle(e:SlideElement,system?:DesignSystem){return e.tableStyle?{...e.tableStyle}:tableColumnStyle(e,tablePresentation(e,system).widths,system);}
export function mergeTableRange(e:SlideElement,range:CellRange,split=false,system?:DesignSystem){
  const b=cellBounds(expandMergedRange(e.tableStyle,range)),tableStyle=localStyle(e,system);
  const merges=(tableStyle.merges??[]).filter(m=>m.row>b.bottom||m.row+m.rowSpan-1<b.top||m.column>b.right||m.column+m.columnSpan-1<b.left);
  if(!split){if(b.top===b.bottom&&b.left===b.right)throw new Error('Select at least two cells to merge.');merges.push({row:b.top,column:b.left,rowSpan:b.bottom-b.top+1,columnSpan:b.right-b.left+1});}
  const next={...tableStyle,merges:merges.length?merges:undefined};validateTableStyle(e.cells??[],next);return {tableStyle:next};
}
export function styleTableRange(e:SlideElement,range:CellRange,patch:Omit<Partial<TableCellStyle>,'row'|'column'>|null,system?:DesignSystem){
  const tableStyle=localStyle(e,system),b=cellBounds(expandMergedRange(e.tableStyle,range));
  const entries=new Map((tableStyle.cellStyles??[]).map(s=>[`${s.row}:${s.column}`,s]));
  for(let row=b.top;row<=b.bottom;row++)for(let column=b.left;column<=b.right;column++){
    const key=`${row}:${column}`;
    if(!patch){entries.delete(key);continue;}
    const next={...entries.get(key),row,column,...patch};for(const key of Object.keys(next) as (keyof TableCellStyle)[])if(next[key]===undefined)delete next[key];
    if(Object.keys(next).length>2)entries.set(key,next);else entries.delete(key);
  }
  const cellStyles=[...entries.values()].sort((a,b)=>a.row-b.row||a.column-b.column);return {tableStyle:{...tableStyle,cellStyles:cellStyles.length?cellStyles:undefined}};
}
/** One patch remaps every address and size; deletion removes only the requested data. */
export function changeTableAxis(e:SlideElement,axis:'row'|'column',index:number,count:number,insert:boolean){
  const rows=e.cells??[['']],columns=tableColumns(rows),length=axis==='row'?rows.length:columns,limit=axis==='row'?100:20;
  if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||index<0||index>(insert?length:length-count))throw new Error('Choose an existing row or column.');
  if(insert&&length+count>limit)throw new Error(`Use up to ${limit} ${axis}s.`);
  if(!insert&&length-count<1)throw new Error(`Keep at least one ${axis}.`);
  const cells=rows.map(row=>Array.from({length:columns},(_,c)=>row[c]??''));
  if(axis==='row')cells.splice(index,insert?0:count,...(insert?Array.from({length:count},()=>Array(columns).fill('')):[]));
  else cells.forEach(row=>row.splice(index,insert?0:count,...(insert?Array(count).fill(''):[])));
  if(!e.tableStyle)return {cells,tableStyle:undefined};
  const s=e.tableStyle,coordinate=axis==='row'?'row':'column',span=axis==='row'?'rowSpan':'columnSpan';
  const remap=(n:number)=>insert?n+(n>=index?count:0):n<index?n:n>=index+count?n-count:undefined;
  const merges:TableMerge[]=[];
  for(const m of s.merges??[]){
    const start=m[coordinate],end=start+m[span],copy={...m};
    if(insert){copy[coordinate]=start>=index?start+count:start;copy[span]=m[span]+(start<index&&index<end?count:0);}
    else{const kept=Array.from({length:m[span]},(_,j)=>remap(start+j)).filter((n):n is number=>n!==undefined);if(!kept.length)continue;copy[coordinate]=kept[0];copy[span]=kept.length;}
    if(copy.rowSpan*copy.columnSpan>1)merges.push(copy);
  }
  const cellStyles=(s.cellStyles??[]).flatMap(cell=>{const n=remap(cell[coordinate]);return n===undefined?[]:[{...cell,[coordinate]:n}];});
  function weights(values:number[]|undefined){if(!values)return undefined;const fallback=values.reduce((a,b)=>a+b,0)/values.length,next=Array.from({length},(_,i)=>values[i]??fallback);next.splice(index,insert?0:count,...(insert?Array(count).fill(next[Math.min(index,length-1)]??fallback):[]));return next;}
  const columnAlign=axis==='column'&&s.columnAlign?Array.from({length:columns},(_,i)=>s.columnAlign![i]??'auto'):s.columnAlign;
  if(axis==='column'&&columnAlign)columnAlign.splice(index,insert?0:count,...(insert?Array(count).fill('auto'):[]));
  const tableStyle={...s,merges:merges.length?merges:undefined,cellStyles:cellStyles.length?cellStyles:undefined,rowHeights:axis==='row'?weights(s.rowHeights):s.rowHeights,columnWidths:axis==='column'?weights(s.columnWidths):s.columnWidths,columnAlign};
  validateTableStyle(cells,tableStyle);return {cells,tableStyle};
}
export function pastedTableStyle(e:SlideElement,range:CellRange){return mergeTableRange(e,range,true).tableStyle;}
