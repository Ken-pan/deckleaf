import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element, blankSlide, newDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {textRangeStylePatch, textRangeTarget} from '../src/core/text-range-format';
import {textPropertyState} from '../src/core/text-properties';

test('partial bold/color/size preserves surrounding characters and inherited styles',()=>{
  const e=element('text',{text:'Alpha Beta',fontSize:32,runs:[{text:'Alpha ',italic:true,color:'#112233'},{text:'Beta',fontSize:40,underline:true}]});
  const patch=textRangeStylePatch(e,{fontWeight:700,fill:'#ff0000',fontSize:56},{start:6,end:10});
  assert.deepEqual(patch.runs,[e.runs![0],{...e.runs![1],fontWeight:700,color:'#ff0000',fontSize:56}]);
  assert.equal(patch.runs!.map(r=>r.text).join(''),e.text);
  assert.equal(e.runs![1].fontSize,40);
});
test('formatting crosses paragraphs without changing bullets, spacing, baseline or unselected text',()=>{
  const e=element('text',{text:'First\nSecond',paragraphs:[{runs:[{text:'First',bold:true}],align:'left',spaceBefore:2,spaceAfter:9,indent:12,firstLineIndent:0,bullet:'•'},{runs:[{text:'Second',italic:true,baseline:'super'}],align:'right',spaceBefore:0,spaceAfter:7,indent:4,firstLineIndent:0}]});
  const patch=textRangeStylePatch(e,{fill:'#123456',align:'center'},{start:3,end:8});
  assert.equal(patch.paragraphs![0].bullet,'•');assert.equal(patch.paragraphs![0].spaceAfter,9);assert.equal(patch.paragraphs![1].runs[0].baseline,'super');
  assert.deepEqual(patch.paragraphs!.map(p=>p.align),['center','center']);
  assert.equal(patch.paragraphs![1].runs.at(-1)!.color,undefined);
  assert.equal(patch.paragraphs!.map(p=>p.runs.map(r=>r.text).join('')).join('\n'),e.text);
});
test('mixed state is read from the selected characters and whole objects use inspector semantics',()=>{
  const e=element('text',{text:'One Two',runs:[{text:'One ',fontSize:20},{text:'Two',fontSize:40,bold:true}]});
  assert.deepEqual(textPropertyState([textRangeTarget(e,{start:4,end:7})],'fontSize'),{value:40,mixed:false});
  assert.equal(textPropertyState([textRangeTarget(e,{start:0,end:7})],'fontSize').mixed,true);
  const all=textRangeStylePatch(e,{fontSize:60});assert.equal(all.fontSize,60);assert.ok(all.runs!.every(r=>r.fontSize===undefined));
  assert.deepEqual(textRangeStylePatch(e,{fontSize:60},{start:2,end:2}),{});
});
test('Unicode range boundaries never split emoji and the operation remains atomic/undoable',()=>{
  const e=element('text',{id:'text',text:'A😀B'}),slide=blankSlide();slide.elements=[e];const deck=newDeck('test',[slide]);
  const patch=textRangeStylePatch(e,{italic:true},{start:2,end:3});assert.equal(patch.runs![1].text,'😀');
  const after=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch}],deck.revision);
  assert.equal(after.revision,deck.revision+1);assert.equal(deck.slides[0].elements[0].runs,undefined);assert.equal(after.slides[0].elements[0].text,'A😀B');
  assert.deepEqual(textRangeStylePatch({...e,locked:true},{italic:true}),{});
});
