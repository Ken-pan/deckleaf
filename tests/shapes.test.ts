import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {element, blankSlide, newDeck, validateDeck, ElementSchema} from '../src/core/model';
import {insertedElement, insertionGeometry} from '../src/core/insertion';
import {SHAPE_TOOLS,shapePreset} from '../src/core/shapes';
import {shapePath,createShapeGeometry,shadowFilter} from '../src/core/shape-geometry';
import {DEFAULT_SHADOW, shadowColorPatch} from '../src/core/shape-schema';
import {hitElements,shapeContains} from '../src/core/hit-testing';
import {applyOperations} from '../src/core/operations';
import {preservePptxFidelity} from '../src/core/pptx-fidelity';
import {nativePptxUnits} from '../src/core/pptx-units';
import {selectionScalePatches} from '../src/core/selection-transform';
import {buildPptx} from '../src/core/pptx-export';

const page={width:1440,height:810};
test('every shape can be placed and constrained near page edges without adding new element types',()=>{
  for(const tool of SHAPE_TOOLS){
    for(const size of [page,{width:320,height:180}]){
      const click=insertionGeometry(tool,size,{x:size.width-1,y:size.height-1});
      const drawn=insertionGeometry(tool,size,{x:size.width*.8,y:size.height*.8},{x:0,y:0},true);
      for(const geometry of [click,drawn]){
        const e=insertedElement(tool,size,geometry);
        assert(e.w>=1&&e.h>=1&&e.x>=0&&e.y>=0&&e.x+e.w<=size.width+.001&&e.y+e.h<=size.height+.001);
        assert(['rect','ellipse','diamond','line'].includes(e.type));
        assert.doesNotThrow(()=>ElementSchema.parse(e));
      }
      if(tool!=='line')assert.equal(drawn.w,drawn.h);
    }
  }
  assert.equal(insertedElement('roundrect',page,{x:10,y:10,w:200,h:100}).radius,24);
  assert.equal(insertedElement('triangle',page,{x:10,y:10,w:200,h:100}).shape,'triangle');
});

test('rounded paths are finite and stay inside narrow and large frames, including concave shapes',()=>{
  for(const tool of SHAPE_TOOLS.filter(t=>!['ellipse','line'].includes(t))){
    for(const [w,h] of [[200,100],[1,1],[1,20000],[20000,1]]){
      const e=element(shapePreset(tool).type,{...shapePreset(tool),w,h,radius:500});
      const path=shapePath(e);assert(path.startsWith('M ')&&path.endsWith(' Z')&&path.includes('C '));assert(!/NaN|Infinity/.test(path));
      const coordinates=path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      coordinates.forEach((n,i)=>assert(n>=-.001&&n<=(i%2?h:w)+.001,`${tool} coordinate ${i}: ${n}`));
    }
  }
});

test('hit testing follows the rounded or concave contour and ignores shadow-only pixels',()=>{
  const triangle=element('rect',{shape:'triangle',x:0,y:0,w:100,h:100,shadow:{...DEFAULT_SHADOW,x:100}});
  assert.equal(hitElements([triangle],{x:5,y:5}).length,0);
  assert.equal(hitElements([triangle],{x:50,y:60})[0]?.id,triangle.id);
  assert.equal(hitElements([triangle],{x:150,y:60}).length,0);
  assert.equal(hitElements([{...triangle,rotation:90}],{x:95,y:5}).length,0);
  const chevron=element('rect',{shape:'chevron',w:100,h:100});
  assert.equal(shapeContains(chevron,{x:5,y:50}),false);assert.equal(shapeContains(chevron,{x:75,y:50}),true);
  const diamond=element('diamond',{w:100,h:100,radius:20});
  assert.equal(shapeContains(diamond,{x:50,y:0}),false);assert.equal(shapeContains(diamond,{x:50,y:50}),true);
});

test('shape and shadow updates validate atomically, persist, and leave original document data intact',()=>{
  const slide=blankSlide(),deck=newDeck('Shapes',[slide]),before=JSON.stringify(deck);
  const e=insertedElement('star',deck,{x:20,y:30,w:200,h:200});
  const added=applyOperations(deck,[{op:'add_element',slideId:slide.id,element:e}],deck.revision);
  const updated=applyOperations(added,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{radius:20,fill:'#123456',stroke:'#abcdef',strokeWidth:6,shadow:DEFAULT_SHADOW}}],added.revision);
  const restored=validateDeck(JSON.parse(JSON.stringify(updated)));
  assert.equal(restored.slides[0].elements[0].shape,'star');assert.deepEqual(restored.slides[0].elements[0].shadow,DEFAULT_SHADOW);
  assert.equal(restored.slides[0].elements[0].radius,20);assert.equal(updated.revision,deck.revision+2);assert.equal(JSON.stringify(deck),before);
  const saved=JSON.stringify(updated);
  assert.throws(()=>applyOperations(updated,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{shadow:{...DEFAULT_SHADOW,blur:-1}}}],updated.revision));
  assert.equal(JSON.stringify(updated),saved);
  const off=applyOperations(updated,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{shadow:undefined}}],updated.revision);
  assert.equal(off.slides[0].elements[0].shadow,undefined);
  assert.throws(()=>ElementSchema.parse({...e,shape:'unknown'}));
  const ellipse=applyOperations(updated,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{type:'ellipse'}}],updated.revision).slides[0].elements[0];
  assert.equal(ellipse.type,'ellipse');assert.equal(ellipse.shape,undefined);assert.equal(ellipse.id,e.id);assert.deepEqual(ellipse.shadow,DEFAULT_SHADOW);
  const text=element('text');const textSlide=blankSlide();textSlide.elements=[text];const textDeck=newDeck('Protected content',[textSlide]);
  assert.throws(()=>applyOperations(textDeck,[{op:'update_element',slideId:textSlide.id,elementId:text.id,patch:{type:'rect'}}],textDeck.revision),/Only shapes/);
});

test('portable geometry factory works without application imports and normalizes shadow color inputs',()=>{
  const factory=runInNewContext(`(${createShapeGeometry.toString()})`,{__name:(fn:Function)=>fn});
  const standalone=factory();
  for(const tool of ['triangle','star','arrow','chevron'] as const){
    const e=element('rect',{shape:tool,w:160,h:120,radius:16,shadow:DEFAULT_SHADOW});
    assert.equal(standalone.shapePath(e),shapePath(e));assert.equal(standalone.shadowFilter(e),shadowFilter(e));
  }
  assert.deepEqual(shadowColorPatch('#abc'),{color:'#aabbcc'});
  assert.deepEqual(shadowColorPatch('#11223380'),{color:'#112233',opacity:128/255});
  assert.deepEqual(shadowColorPatch('transparent'),{opacity:0});
  assert.equal(shadowFilter({shadow:{...DEFAULT_SHADOW,opacity:0}}),'none');
});

test('native PowerPoint output keeps vector geometry, cubic corners and shadow effects',async()=>{
  const source=blankSlide();source.elements=['triangle','star','arrow','chevron'].map((shape,i)=>element('rect',{shape:shape as 'triangle',name:shape,x:i*250,y:100,w:200,h:160,radius:16,fill:'#123456',stroke:'#abcdef',strokeWidth:5,shadow:DEFAULT_SHADOW}));
  source.elements.push(element('diamond',{radius:20,w:120,h:120,shadow:{...DEFAULT_SHADOW,x:-3,y:-6}}));
  const deck=newDeck('Editable vectors',[source]),before=JSON.stringify(deck),pptx=new PptxGenJS(),slide=pptx.addSlide();
  for(const e of source.elements)slide.addShape(pptx.ShapeType.rect,{objectName:e.id,x:e.x/96,y:e.y/96,w:e.w/96,h:e.h/96,fill:{color:'123456'},line:{color:'ABCDEF',width:e.strokeWidth*.75}});
  const bytes=await preservePptxFidelity(await pptx.write({outputType:'uint8array'}) as Uint8Array,deck);
  const zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.equal((xml.match(/<a:custGeom>/g)||[]).length,5);assert.equal((xml.match(/<a:outerShdw /g)||[]).length,5);
  assert(xml.includes('<a:cubicBezTo>'));assert(xml.includes('<a:alpha val="18000"/>'));assert(xml.includes('w="200000" h="160000"'));
  assert(!Object.keys(zip.files).some(p=>p.startsWith('ppt/media/')&&!zip.files[p].dir));assert.equal(JSON.stringify(deck),before);
});

test('native page unit conversion scales shadow distances together with corner radius',()=>{
  const s=blankSlide();s.elements=[element('rect',{radius:20,shadow:DEFAULT_SHADOW})];
  const d=newDeck('Native units',[s]);d.provenance={provider:'Test',pageSize:{width:720,height:405,canvasWidth:1440,canvasHeight:810}};
  const before=JSON.stringify(d),result=nativePptxUnits(d),e=result.slides[0].elements[0];
  assert(Math.abs(e.radius-20*2/3)<1e-8);assert(Math.abs(e.shadow!.blur-8*2/3)<1e-8);assert(Math.abs(e.shadow!.y-6*2/3)<1e-8);assert.equal(JSON.stringify(d),before);
});

test('selection scaling keeps shape effects proportional and within editable limits',()=>{
  const e=element('rect',{shape:'star',x:0,y:0,w:100,h:100,radius:12,shadow:{...DEFAULT_SHADOW,x:-20,y:30}});
  const patch=selectionScalePatches([e],{x:0,y:0,w:100,h:100},{x:0,y:0,w:200,h:200}).get(e.id)!;
  assert.equal(patch.radius,24);assert.equal(patch.shadow?.blur,16);assert.equal(patch.shadow?.x,-40);assert.equal(patch.shadow?.y,60);assert.equal(e.radius,12);
  const huge=selectionScalePatches([e],{x:0,y:0,w:100,h:100},{x:0,y:0,w:20000,h:20000}).get(e.id)!;
  assert.equal(huge.shadow?.blur,200);assert.equal(huge.shadow?.x,-500);assert.equal(huge.shadow?.y,500);
});

test('full PowerPoint export does not mutate custom shape colors, bindings or effects',async()=>{
  const s=blankSlide();s.elements=[element('rect',{shape:'star',radius:24,fill:'#123456',stroke:'#abcdef',strokeWidth:6,shadow:DEFAULT_SHADOW,design:{overrides:[]}})];
  const d=newDeck('Read-only shape export',[s]),before=JSON.stringify(d);
  await buildPptx(d);
  assert.equal(JSON.stringify(d),before);
});
