import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {inspectorCapabilities,dataLabelSize,shadowPatchOperations,shadowPropertyMixed,shapeTypeOperations} from '../src/core/inspector-properties';
import {DEFAULT_SHADOW} from '../src/core/shape-schema';
import {tablePageRange} from '../src/core/object-data';

test('mixed shape selections expose only properties supported by every object',()=>{
  const rect=element('rect'),ellipse=element('ellipse'),line=element('line');
  assert.deepEqual(inspectorCapabilities([rect,ellipse]),{sameType:false,shapes:true,shapeType:true,fill:true,stroke:true,radius:false});
  assert.deepEqual(inspectorCapabilities([rect,line]),{sameType:false,shapes:true,shapeType:false,fill:false,stroke:true,radius:false});
  assert.equal(inspectorCapabilities([rect,element('image')]).stroke,false);
  assert.equal(inspectorCapabilities([rect,element('text')]).fill,false);
  assert.equal(inspectorCapabilities([]).fill,false);
  assert.equal(inspectorCapabilities([element('table')]).stroke,true);
  assert.equal(dataLabelSize(element('chart',{fontSize:32})),28);
  assert.equal(dataLabelSize(element('chart',{fontSize:4})),18);
  assert.equal(dataLabelSize(element('table',{fontSize:32})),32);
});

test('batch shadow field edits preserve independent shadows and locked objects atomically',()=>{
  const slide=blankSlide();
  slide.elements=[element('rect',{id:'a',shadow:{...DEFAULT_SHADOW,color:'#112233',opacity:.3,blur:15}}),element('ellipse',{id:'b',shadow:{...DEFAULT_SHADOW,color:'#abcdef',x:7,opacity:.5}}),element('rect',{id:'locked',locked:true,shadow:{...DEFAULT_SHADOW,blur:24}}),element('text',{id:'text'})];
  const deck=newDeck('Shadows',[slide]),before=JSON.stringify(deck),ids=slide.elements.map(item=>item.id);
  const ops=shadowPatchOperations(slide,ids,{y:12});
  const after=applyOperations(deck,ops,deck.revision);
  assert.equal(ops.length,2);
  assert.deepEqual(after.slides[0].elements[0].shadow,{...slide.elements[0].shadow,y:12});
  assert.deepEqual(after.slides[0].elements[1].shadow,{...slide.elements[1].shadow,y:12});
  assert.deepEqual(after.slides[0].elements[2],slide.elements[2]);
  assert.equal(JSON.stringify(deck),before);
  assert.equal(shadowPropertyMixed(slide.elements.slice(0,2),'y'),false);
  assert.equal(shadowPropertyMixed(slide.elements.slice(0,2),'blur'),true);
});

test('shape conversion preserves each geometry and authored name, excluding lines and locked objects',()=>{
  const slide=blankSlide();slide.elements=[element('rect',{id:'a',name:'Rectangle',radius:12}),element('ellipse',{id:'b',name:'Authored shape',fill:'#abcdef',x:45}),element('rect',{id:'locked',locked:true}),element('line',{id:'line'})];
  const deck=newDeck('Shapes',[slide]);
  const after=applyOperations(deck,shapeTypeOperations(slide,slide.elements.map(e=>e.id),'ellipse'),deck.revision);
  assert.equal(after.slides[0].elements[0].radius,0);
  assert.equal(after.slides[0].elements[0].name,'Ellipse');
  assert.equal(after.slides[0].elements[1].name,'Authored shape');
  assert.equal(after.slides[0].elements[1].fill,'#abcdef');
  assert.equal(after.slides[0].elements[1].x,45);
  assert.equal(after.slides[0].elements[1].w,slide.elements[1].w);
  assert.deepEqual(after.slides[0].elements[2],slide.elements[2]);
  assert.deepEqual(after.slides[0].elements[3],slide.elements[3]);
  assert.equal(shapeTypeOperations(slide,['a'],'line').length,0);
});

test('table page bounds keep every row reachable without mounting the complete sheet',()=>{
  for(const rows of [0,1,9,10,11,99,100]){
    const visited:number[]=[];
    const first=tablePageRange(rows,-1);
    assert.equal(first.page,0);
    for(let p=0;p<first.pages;p++){
      const range=tablePageRange(rows,p);
      assert(range.end-range.start<=10);
      for(let row=range.start;row<range.end;row++)visited.push(row);
    }
    assert.deepEqual(visited,Array.from({length:rows},(_,i)=>i));
    assert.equal(tablePageRange(rows,Infinity).end,rows);
  }
});
