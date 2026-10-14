import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableData,tableCells,chartData} from '../src/core/object-data';
test('table editing preserves empty cells, whitespace and ragged rows across pasted line endings',()=>{
  assert.deepEqual(tableData('Name\t\tEvidence\r\n A \t42\rLast'),[['Name','','Evidence'],[' A ','42'],['Last']]);
  assert.throws(()=>tableData(Array(101).fill('a').join('\n')),/100 rows/);
  assert.throws(()=>tableData(Array(21).fill('a').join('\t')),/20 columns/);
});
test('direct cell editing keeps multiline and tab-containing cells without reinterpreting their structure',()=>{
  const original=[['Heading','Note'],['Two\nlines','Embedded\ttab'],['Short']];
  const next=tableCells(original);next[0][1]='Edited';
  assert.deepEqual(next.slice(1),original.slice(1));assert.equal(original[0][1],'Note');
});
test('chart editing permits comma-containing labels and rejects a whole draft with invalid values',()=>{
  assert.deepEqual(chartData('North, America, 12.5\r\nSouth, 0\n'),[{label:'North, America',value:12.5},{label:'South',value:0}]);
  for(const draft of ['Missing comma','A,','A, NaN','A, Infinity','A, -1','A, 1\nB, bad'])assert.throws(()=>chartData(draft),/Row \d/);
});

test('table CSV import and export preserve quoted separators, Unicode, line breaks and blank cells',async()=>{
  const {parseTableData,tableCsv}=await import('../src/core/object-data');
  const rows=[['项目','Note',''],[' A ','Two\nlines','Embedded\ttab'],['','He said "yes", then left','']];
  assert.deepEqual(parseTableData(tableCsv(rows)),rows);
  assert.deepEqual(parseTableData('sep=;\r\nName;Note\r\n A ;"One;two"\r\n'),[['Name','Note'],[' A ','One;two']]);
  assert.deepEqual(parseTableData('a\t\n\t\n'),[['a',''],['','']]);
  assert.throws(()=>parseTableData('A,"broken'),/quoted/);
  assert.throws(()=>parseTableData(Array(101).fill('a').join('\n')),/100 rows/);
  assert.throws(()=>parseTableData(Array(21).fill('a').join('\t')),/20 columns/);
});
test('table range paste extends a copy, preserves outside cells and rejects malformed or overflowing data atomically',async()=>{
  const {pasteTableCells}=await import('../src/core/object-data');
  const original=[['Heading','Note'],['Keep','Old']];
  assert.deepEqual(pasteTableCells(original,'"Two\nlines"\t42\nNew\t',1,1).cells,[['Heading','Note',''],['Keep','Two\nlines','42'],['','New','']]);
  assert.deepEqual(original,[['Heading','Note'],['Keep','Old']]);
  assert.throws(()=>pasteTableCells(original,'1\t2\n3',0,0),/rectangular/);
  assert.throws(()=>pasteTableCells(original,'1\t2',0,19),/exceeds/);
  assert.throws(()=>pasteTableCells(original,'x'.repeat(5001),0,0),/5,000/);
});
