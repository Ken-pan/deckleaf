import {createLinePaths} from '../src/core/line-path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import {DEFAULT_LINE,LINE_PRESETS,LINE_ROUTES,LINE_DASHES,LINE_ENDS,createLineGeometry,lineGeometry,lineHit,lineMarkup} from '../src/core/lines';
import {ElementSchema,element,newDeck,blankSlide,validateDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {insertedElement,insertionGeometry} from '../src/core/insertion';
import {buildPptx} from '../src/core/pptx-export';
import {buildHtml} from '../src/core/export';
import {hitElements} from '../src/core/hit-testing';
const page={width:1440,height:810};

test('line settings survive atomic transactions and document serialization; invalid changes leave the original intact',()=>{
  const slide=blankSlide(),deck=newDeck('Lines',[slide]);
  const e=element('line',{x:20,y:20,w:300,h:140,line:{...DEFAULT_LINE,route:'rounded',dash:'dash-dot',start:'diamond',end:'arrow',markerSize:2}});
  const added=applyOperations(deck,[{op:'add_element',slideId:slide.id,element:e}],deck.revision);
  const updated=applyOperations(added,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{line:{...e.line!,bend:.7}}}],added.revision);
  assert.equal(deck.slides[0].elements.length,0);
  assert.deepEqual(validateDeck(JSON.parse(JSON.stringify(updated))).slides[0].elements[0].line,{...e.line,bend:.7});
  assert.equal(added.slides[0].elements[0].line!.bend,.5);
  assert.throws(()=>applyOperations(updated,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{line:{...e.line!,bend:2}}}],updated.revision));
  assert.equal(updated.slides[0].elements[0].line!.bend,.7);
  assert.equal(ElementSchema.parse(element('line',{w:300,h:1})).line,undefined);
});

test('all line routes, patterns and ends render finite portable geometry in narrow, flat and tall frames',()=>{
  const portable=runInNewContext(`(${createLineGeometry.toString()})()`,{__name:(fn:Function)=>fn,createLinePaths});
  for(const route of LINE_ROUTES)for(const [w,h] of [[300,140],[300,1],[1,300],[1,1]]){
    const e=element('line',{w,h,stroke:'#123456',strokeWidth:3,line:{...DEFAULT_LINE,route:route.value,start:'diamond',end:'arrow'}});
    const markup=lineMarkup(e);assert(!/NaN|Infinity|undefined/.test(markup));assert.equal(portable.lineMarkup(e),markup);
    const g=lineGeometry(e);assert(g.points.length>=2);assert(lineHit(e,g.points[Math.floor(g.points.length/2)],.01));
    assert.equal(hitElements([e],{x:e.x+g.points[1].x,y:e.y+g.points[1].y},2).length,1);
  }
  for(const dash of LINE_DASHES)for(const end of LINE_ENDS){
    const e=element('line',{w:300,h:120,line:{...DEFAULT_LINE,dash:dash.value,start:end.value,end:end.value}});
    assert(!/NaN|Infinity|undefined/.test(lineMarkup(e)));
  }
  const elbow=element('line',{x:0,y:0,w:300,h:120,line:{...DEFAULT_LINE,route:'elbow'}});
  assert(lineHit(elbow,{x:150,y:60},2));assert(!lineHit(elbow,{x:75,y:30},2));
});

test('rich line placement preserves arrow direction in every quadrant and gives curved click placements usable height',()=>{
  for(const [dx,dy] of [[200,100],[-200,100],[200,-100],[-200,-100]]){
    const g=insertionGeometry('line',page,{x:500,y:300},{x:500+dx,y:300+dy},false,undefined,{...DEFAULT_LINE,end:'arrow'});
    assert.equal(g.flipX,dx<0);assert.equal(g.flipY,dy<0);
    const e=insertedElement('line',page,g);assert.equal(e.flipX,dx<0);assert.equal(e.flipY,dy<0);
  }
  const g=insertionGeometry('line',page,{x:1400,y:800},undefined,false,undefined,{...DEFAULT_LINE,route:'curve'});
  assert.equal(g.h,140);assert(g.x+g.w<=page.width);assert(g.y+g.h<=page.height);
  assert.equal(insertionGeometry('line',page,{x:100,y:100}).h,1);
});

test('HTML and PPTX export preserve editable routes, dash patterns and marker geometry',async()=>{
  const slide=blankSlide(),deck=newDeck('Lines',[slide]);
  deck.slides[0].elements=LINE_PRESETS.map((preset,i)=>element('line',{fontFamily:'Arial',name:preset.label,x:40,y:20+i*20,w:300,h:120,stroke:'#123456',strokeWidth:3,line:preset.style}));
  const html=await (await buildHtml(deck)).text();assert(html.includes('lineMarkup(e)'));assert(html.includes('lineGeometry'));
  const bytes=await buildPptx(deck,false,async()=>({w:1,h:1}));
  const zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.equal((xml.match(/<p:cxnSp>/g)||[]).length,LINE_PRESETS.length);
  assert.equal((xml.match(/<a:custGeom>/g)||[]).length,LINE_PRESETS.length);
  assert(xml.includes('<a:cubicBezTo>'));assert(xml.includes('<a:custDash>'));assert(xml.includes('fill="norm" stroke="0"'));
  assert(!xml.includes('NaN'));
});
