import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,validateDeck,newDeck,blankSlide} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {reorderTableAxis,tableAxisBlock,autofillTableRange} from '../src/core/table-manipulation';
const range=(top:number,left:number,bottom=top,right=left)=>({anchor:{row:top,column:left},head:{row:bottom,column:right}});
const table=()=>({...element('table'),cells:[['Name','Value','Region'],['First','1','West'],['Second','2','East'],['Third','3','North']]});
test('reordering inserts rows with sizes, merged blocks, hidden values and local styles intact',()=>{
 const e={...table(),tableStyle:{rowHeights:[1,2,3,4],columnWidths:[1,2,1],merges:[{row:1,column:0,rowSpan:2,columnSpan:1}],cellStyles:[{row:2,column:1,fill:'#ff0000'}]}},before=JSON.stringify(e);
 assert.deepEqual(tableAxisBlock(e,'row',2),{start:1,end:2,count:2});
 const result=reorderTableAxis(e,'row',2,2,4);
 assert.deepEqual(result.cells.map(r=>r[0]),['Name','Third','First','Second']);
 assert.deepEqual(result.tableStyle?.rowHeights,[1,4,2,3]);assert.equal(result.tableStyle?.merges?.[0].row,2);assert.equal(result.tableStyle?.cellStyles?.[0].row,3);assert.equal(JSON.stringify(e),before);
 assert.throws(()=>reorderTableAxis(e,'row',3,3,2),/merged/);
});
test('column reorder remaps widths, alignment and all cell coordinates',()=>{
 const e={...table(),tableStyle:{columnWidths:[2,5,3],columnAlign:['left','right','center'] as const,cellStyles:[{row:1,column:1,italic:true}]}};
 const result=reorderTableAxis({...e,tableStyle:{...e.tableStyle,columnAlign:[...e.tableStyle.columnAlign]}},'column',1,1,0);
 assert.deepEqual(result.cells[1],['1','First','West']);assert.deepEqual(result.tableStyle?.columnWidths,[5,2,3]);assert.deepEqual(result.tableStyle?.columnAlign,['right','left','center']);assert.equal(result.tableStyle?.cellStyles?.[0].column,0);
});
test('reordering is one valid undoable document transaction',()=>{
 const e=table(),deck=newDeck('Table test',[blankSlide()]),slide={...blankSlide(),elements:[e]},base={...deck,slides:[slide]};
 const {cells,tableStyle}=reorderTableAxis(e,'row',1,1,4),after=applyOperations(base,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{cells,tableStyle}}]);
 validateDeck(after);assert.deepEqual(after.slides[0].elements[0].cells?.[3],e.cells[1]);assert.equal(after.revision,base.revision+1);
});
test('autofill continues regular numeric patterns and preserves source values',()=>{
 const e={...table(),cells:[['1','10.5%'],['2','11.0%'],['',''],['','']]},before=JSON.stringify(e);
 assert.deepEqual(autofillTableRange(e,range(0,0,1,1),range(0,0,3,1)).cells,[['1','10.5%'],['2','11.0%'],['3','11.5%'],['4','12.0%']]);assert.equal(JSON.stringify(e),before);
 assert.deepEqual(autofillTableRange(e,range(0,0,1,1),range(0,0,3,1),true).cells[3],['2','11.0%']);
});
test('autofill repeats text and irregular samples, while ISO dates and padded suffixes continue',()=>{
 const e={...table(),cells:[['2026-10-14','Item 01','A','2'],['2026-10-16','Item 02','B','7'],['','','C','3'],['','','','']]};
 const result=autofillTableRange(e,range(0,0,1,2),range(0,0,3,2));assert.deepEqual(result.cells[3].slice(0,3),['2026-10-20','Item 04','B']);
 assert.equal(autofillTableRange(e,range(0,3,2,3),range(0,3,3,3)).cells[3][3],'2');
 const bad={...e,cells:[['2026-99-01'],['2026-99-02'],['']]};assert.equal(autofillTableRange(bad,range(0,0,1,0),range(0,0,2,0)).cells[2][0],'2026-99-01');
});
test('autofill handles reverse direction, horizontal fills, styles and unchanged dimensions',()=>{
 const e={...table(),cells:[['','','5','7'],['','','','']],tableStyle:{rowHeights:[1,2],columnWidths:[1,2,3,4],cellStyles:[{row:0,column:2,fill:'#ff0000'},{row:0,column:0,fill:'#00ff00'}]}};
 const result=autofillTableRange(e,range(0,2,0,3),range(0,0,0,3));assert.deepEqual(result.cells[0],['1','3','5','7']);assert.equal(result.tableStyle?.cellStyles?.find(s=>s.column===0)?.fill,'#ff0000');assert.deepEqual(result.tableStyle?.rowHeights,[1,2]);
});
test('autofill rejects nonrectangular or merged destinations without losing hidden content',()=>{
 const e={...table(),tableStyle:{merges:[{row:2,column:0,rowSpan:1,columnSpan:2}]}};
 assert.throws(()=>autofillTableRange(e,range(1,0),range(1,0,2,0)),/Split merged/);assert.throws(()=>autofillTableRange(table(),range(1,1),range(1,1,2,2)),/one direction/);assert.throws(()=>autofillTableRange(table(),range(1,1),range(1,1,4,1)),/within/);
});
