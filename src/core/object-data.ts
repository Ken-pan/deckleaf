import {delimitedRows} from './delimited-data';
import type {SlideElement} from './model';

export function tablePageRange(rowCount:number, requestedPage:number, pageSize=10) {
  const pages=Math.max(1,Math.ceil(rowCount/pageSize));
  const page=Math.max(0,Math.min(pages-1,requestedPage));
  return {page,pages,start:page*pageSize,end:Math.min(rowCount,(page+1)*pageSize)};
}

// Both inspector and contextual editing use the same lossless table grammar.
export function tableData(text:string):NonNullable<SlideElement['cells']> {
  const rows=text.replace(/\r\n?/g,'\n').split('\n').map(row=>row.split('\t'));
  return tableCells(rows);
}

export function tableCells(rows:string[][]):NonNullable<SlideElement['cells']> {
  if(rows.length>100)throw new Error('Use at most 100 rows.');
  if(rows.some(row=>row.length>20))throw new Error('Use at most 20 columns.');
  if(rows.some(row=>row.some(cell=>cell.length>5000)))throw new Error('Keep each cell under 5,000 characters.');
  return rows.map(row=>[...row]);
}

export function chartData(text:string):NonNullable<SlideElement['values']> {
  const rows=text.replace(/\r\n?/g,'\n').split('\n').filter(row=>row.trim());
  if(rows.length>100)throw new Error('Use at most 100 values.');
  return rows.map((row,index)=>{
    const comma=row.lastIndexOf(','),label=row.slice(0,comma).trim(),raw=row.slice(comma+1).trim(),value=Number(raw);
    if(comma<0||!label||label.length>100||!raw||!Number.isFinite(value)||value<0)
      throw new Error(`Row ${index+1}: enter a label, comma, and nonnegative number.`);
    return {label,value};
  });
}

/** CSV/TSV import retains quoted line breaks, spaces and empty cells. */
export function parseTableData(text:string):string[][] {
  if(!text.replace(/^\uFEFF/,'').length)throw new Error('Enter at least one row of data.');
  const {rows}=delimitedRows(text,undefined,true,100,20);
  if(!rows.length)throw new Error('Enter at least one row of data.');
  return tableCells(rows);
}
export function pasteTableCells(cells:string[][],text:string,row:number,column:number){
  const {rows}=delimitedRows(text,'\t',true,100,20);
  if(!rows.length)throw new Error('Paste at least one cell.');
  const width=rows[0].length;
  if(rows.some(r=>r.length!==width))throw new Error('Paste a rectangular range with the same number of columns in each row.');
  if(row<0||column<0||row+rows.length>100||column+width>20)throw new Error('The pasted range exceeds 100 rows or 20 columns.');
  const columns=Math.max(column+width,1,...cells.map(r=>r.length)),next=cells.map(r=>[...r]);
  while(next.length<row+rows.length)next.push([]);
  for(const r of next)while(r.length<columns)r.push('');
  rows.forEach((r,i)=>r.forEach((value,j)=>next[row+i][column+j]=value));
  return {cells:tableCells(next),rows:rows.length,columns:width};
}
export function tableCsv(cells:string[][]):string {
  const quote=(value:string)=>/[",\t\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
  return '\uFEFF'+cells.map(row=>row.map(quote).join(',')).join('\r\n');
}
