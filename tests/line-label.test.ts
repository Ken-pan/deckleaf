import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import {element,blankSlide,newDeck,validateDeck} from '../src/core/model';
import {DEFAULT_LINE,LINE_ROUTES} from '../src/core/lines';
import {createLinePaths} from '../src/core/line-path';
import {createLineLabelRendering,lineLabelPoint,lineLabelElement} from '../src/core/line-label';
import {lineLocalToWorld,lineBendPoint} from '../src/core/line-editing';
import {shapeTextElement,shapeTextPatch,canEditText} from '../src/core/shape-text';
import {applyOperations} from '../src/core/operations';
import {buildPptx} from '../src/core/pptx-export';
import {buildHtml} from '../src/core/export';

test('labels sit at half path length and stay upright through flips, rotations and every route',()=>{
  const elbow=element('line',{w:300,h:100,line:{...DEFAULT_LINE,route:'elbow',bend:.2}});
  assert.deepEqual(lineLabelPoint(elbow),{x:100,y:100});
  const portable=runInNewContext(`(${createLineLabelRendering.toString()})`,{__name:(fn:Function)=>fn})(createLinePaths());
  for(const route of LINE_ROUTES)for(const rotation of [0,37,90,180])for(const flipX of [false,true])for(const flipY of [false,true]){
    const e=element('line',{x:100,y:120,w:300,h:140,rotation,flipX,flipY,text:'审核通过',line:{...DEFAULT_LINE,route:route.value}}),before=JSON.stringify(e);
    const label=lineLabelElement(e),center=lineLocalToWorld(e,lineLabelPoint(e));
    assert(Math.abs(label.x+label.w/2-center.x)<.001);assert(Math.abs(label.y+label.h/2-center.y)<.001);
    assert.equal(label.rotation,0);assert(!label.flipX&&!label.flipY);assert(label.w>0&&label.h>0);
    assert.equal(JSON.stringify(portable.lineLabelElement(e)),JSON.stringify(label));assert.equal(JSON.stringify(e),before);
  }
});

test('label transactions preserve connector geometry and stroke, and persist separate text styling',()=>{
  const slide=blankSlide(),line=element('line',{x:12,y:40,w:300,h:1,stroke:'#123456',strokeWidth:4,line:{...DEFAULT_LINE,end:'arrow'}});slide.elements=[line];
  const deck=newDeck('Line labels',[slide]),draft={...shapeTextElement(line),text:'Approved',fill:'#ee0000',fontSize:24};
  const next=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:line.id,patch:shapeTextPatch(line,draft)}],deck.revision);
  const saved=validateDeck(JSON.parse(JSON.stringify(next))).slides[0].elements[0];
  assert(canEditText(saved));assert.equal(saved.text,'Approved');assert.equal(saved.shapeText?.color,'#ee0000');
  for(const key of ['x','y','w','h','stroke','strokeWidth','line','fill'] as const)assert.deepEqual(saved[key],line[key]);
  assert.equal(line.text,'');assert.equal(lineLabelElement(saved).fill,'#ee0000');
  const cleared=shapeTextPatch(saved,{...shapeTextElement(saved),text:'\n'});assert.equal(cleared.text,'');assert.equal(cleared.runs,undefined);
});

test('bend handles do not overlap a connector label',()=>{
  for(const route of ['elbow','rounded','step'] as const){
    const e=element('line',{w:600,h:240,text:'Label',line:{...DEFAULT_LINE,route}}),point=lineBendPoint(e),label=lineLabelElement(e);
    if(point){const world=lineLocalToWorld(e,point);assert(world.x<label.x||world.x>label.x+label.w||world.y<label.y||world.y>label.y+label.h);}
  }
});

test('multiline and rich label text reserves room without resizing the connector',()=>{
  const line=element('line',{w:300,h:1,fontSize:16,text:'A\n大字',runs:[{text:'A\n'},{text:'大字',fontSize:40,bold:true}]});
  const label=lineLabelElement(line);assert(label.h>=40*line.lineHeight*2+8);assert(label.w>32);
  assert.equal(line.h,1);assert.equal(line.w,300);
});

test('HTML and PowerPoint include an editable middle label with preserved text color',async()=>{
  const slide=blankSlide(),line=element('line',{fontFamily:'Arial',x:80,y:100,w:400,h:120,text:'Approved',shapeText:{color:'#ff6600'},line:{...DEFAULT_LINE,route:'rounded',end:'arrow'}});slide.elements=[line];
  const deck=newDeck('Label export',[slide]);
  const html=await (await buildHtml(deck)).text();assert(html.includes('lineLabelStyle(e,t)'));assert(html.includes('Approved'));
  const zip=await JSZip.loadAsync(await buildPptx(deck));const xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert(xml.includes('Approved'));assert(xml.includes(line.id+':label'));assert.match(xml,/srgbClr val="ff6600"/i);assert.match(xml,/<a:custGeom>/);
});
