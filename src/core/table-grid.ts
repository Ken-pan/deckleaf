import {delimitedRows} from './delimited-data';
import {tableCells,pasteTableCells} from './object-data';
export type Cell={row:number;column:number};
export type CellRange={anchor:Cell;head:Cell};
export function cellBounds(range:CellRange){return {top:Math.min(range.anchor.row,range.head.row),bottom:Math.max(range.anchor.row,range.head.row),left:Math.min(range.anchor.column,range.head.column),right:Math.max(range.anchor.column,range.head.column)};}
export function cellInRange(range:CellRange|undefined,row:number,column:number){if(!range)return false;const b=cellBounds(range);return row>=b.top&&row<=b.bottom&&column>=b.left&&column<=b.right;}
export function selectedCells(cells:string[][],range:CellRange){const b=cellBounds(range);return Array.from({length:b.bottom-b.top+1},(_,i)=>Array.from({length:b.right-b.left+1},(_,j)=>cells[b.top+i]?.[b.left+j]??''));}
export function cellsTsv(cells:string[][]){return cells.map(row=>row.map(v=>v===''&&cells.length===1&&row.length===1||/[\t\r\n"]/.test(v)?`"${v.replaceAll('"','""')}"`:v).join('\t')).join('\r\n');}
export function clearCellRange(cells:string[][],range:CellRange){const b=cellBounds(range),next=cells.map(row=>[...row]);for(let r=b.top;r<=b.bottom;r++){while(next[r].length<=b.right)next[r].push('');for(let c=b.left;c<=b.right;c++)next[r][c]='';}return tableCells(next);}
/** A single target grows to the source range; a selected rectangle tiles matching data. */
export function pasteCellRange(cells:string[][],text:string,range:CellRange){
  if(text.length>250_000)throw new Error('Paste up to 250 KB of cell data.');
  const {rows}=delimitedRows(text,'\t',true,100,20),b=cellBounds(range);
  if(!rows.length||!rows[0].length||rows.some(r=>r.length!==rows[0].length))throw new Error('Paste a rectangular range with the same number of columns in each row.');
  const height=b.bottom-b.top+1,width=b.right-b.left+1;
  if(height===1&&width===1)return pasteTableCells(cells,text,b.top,b.left);
  if(height%rows.length||width%rows[0].length)throw new Error('Choose a range matching the pasted data.');
  const tiled=Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[i%rows.length][j%rows[0].length]));
  return pasteTableCells(cells,cellsTsv(tiled),b.top,b.left);
}
export function resizeRowPair(heights:number[],boundary:number,delta:number,minimums:number[]){
  if(!Number.isInteger(boundary)||boundary<0||boundary>=heights.length-1||!Number.isFinite(delta))throw new Error('Choose an existing row boundary.');
  const next=[...heights],total=next[boundary]+next[boundary+1],minA=Math.min(next[boundary],minimums[boundary]),minB=Math.min(next[boundary+1],minimums[boundary+1]);
  next[boundary]=Math.max(minA,Math.min(total-minB,next[boundary]+delta));next[boundary+1]=total-next[boundary];return next;
}
