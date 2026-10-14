import { test } from 'node:test';
import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { importPptx } from '../src/importers/pptx';
import { importGoogle } from '../src/importers/google';
import {importFigma} from '../src/importers/figma';
import {textFlowStyle} from '../src/core/typography';
import { element, blankSlide, newDeck } from '../src/core/model';
import { preservePptxFidelity } from '../src/core/pptx-fidelity';
import { applyOperations } from '../src/core/operations';

test('native PPTX round trip retains paragraph styles, hard breaks, asymmetric insets, flips and image crop', async()=>{
  const s=blankSlide(), text=element('text',{fontFamily:'Arial',fontSize:32,text:'First\nsoft\nSecond',x:100,y:120,w:600,h:260,rotation:12,padding:{left:12,right:38,top:10,bottom:23},verticalAlign:'middle',paragraphs:[{runs:[{text:'First\nsoft',fontFamily:'Arial',fontSize:32,bold:true,color:'#123456'}],align:'center',lineSpacing:44,spaceBefore:8,spaceAfter:19,indent:12,firstLineIndent:-6},{runs:[{text:'Second',fontFamily:'Times New Roman',fontSize:22,italic:true}],align:'right',spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]});
  const image=element('image',{src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',x:750,y:180,w:350,h:200,crop:{left:.12,right:.24,top:.05,bottom:.1},flipX:true});s.elements=[text,image];const deck=newDeck('Fidelity',[s]);
  const p=new PptxGenJS();p.defineLayout({name:'Fixture',width:15,height:8.4375});p.layout='Fixture';const page=p.addSlide();page.addText('placeholder',{x:text.x/96,y:text.y/96,w:text.w/96,h:text.h/96,objectName:text.id,rotate:text.rotation});page.addImage({data:image.src!,x:image.x/96,y:image.y/96,w:image.w/96,h:image.h/96,objectName:image.id});
  const bytes=await preservePptxFidelity(await p.write({outputType:'uint8array'}) as Uint8Array,deck), result=await importPptx(bytes,'fidelity.pptx');
  const t=result.slides[0].elements.find(e=>e.type==='text')!, img=result.slides[0].elements.find(e=>e.type==='image')!;
  assert.equal(t.text,text.text);assert.equal(t.rotation,12);assert.equal(t.verticalAlign,'middle');assert.deepEqual(t.padding,text.padding);assert.equal(t.paragraphs?.[0].lineSpacing,44);assert.equal(t.paragraphs?.[1].align,'right');assert.equal(t.paragraphs?.[1].runs[0].fontFamily,'Times New Roman');assert.deepEqual(img.crop,image.crop);assert.equal(img.flipX,true);
  const xml=await (await JSZip.loadAsync(bytes)).file('ppt/slides/slide1.xml')!.async('string');assert(xml.includes('xml:space="preserve"'));
});
test('Google normalized geometry, inherited font, paragraph layout and crop remain independent of shape scaling',()=>{
  const parent={objectId:'parent',shape:{text:{textElements:[{textRun:{content:'x',style:{fontFamily:'Arial',fontSize:{magnitude:18,unit:'PT'},foregroundColor:{opaqueColor:{rgbColor:{red:.2}}}}}}]}}};
  const deck=importGoogle({presentation:{title:'API fixture',pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},layouts:[{objectId:'layout',pageElements:[parent]}],slides:[{objectId:'s',pageElements:[{objectId:'text',size:{width:{magnitude:100,unit:'PT'},height:{magnitude:30,unit:'PT'}},transform:{scaleX:2,scaleY:2,translateX:50,translateY:20,unit:'PT'},shape:{shapeType:'TEXT_BOX',placeholder:{parentObjectId:'parent'},text:{textElements:[{startIndex:0,endIndex:3,paragraphMarker:{style:{alignment:'CENTER',lineSpacing:125,spaceBelow:{magnitude:8,unit:'PT'}}}},{startIndex:0,endIndex:3,textRun:{content:'OK\n',style:{bold:true}}}]}}},{objectId:'shape',size:{width:{magnitude:1,unit:'EMU'},height:{magnitude:1,unit:'EMU'}},transform:{scaleX:1270000,scaleY:1270000},shape:{shapeType:'RECTANGLE',shapeProperties:{outline:{propertyState:'RENDERED',weight:{magnitude:1,unit:'PT'}}}}}]}]}});
  const t=deck.slides[0].elements.find(e=>e.type==='text')!;assert.equal(t.fontSize,36);assert.equal(t.w,400);assert.equal(t.fontFamily,'Arial');assert.equal(t.paragraphs?.[0].align,'center');assert.equal(t.paragraphs?.[0].spaceAfter,16);assert.equal(t.paragraphs?.[0].runs[0].fontWeight,700);assert.equal(deck.slides[0].elements.find(e=>e.type==='rect')?.strokeWidth,2);
});
test('manual or AI text changes cannot leave an old imported paragraph visible',()=>{
  const s=blankSlide();s.elements=[element('text',{text:'Old',paragraphs:[{runs:[{text:'Old'}],align:'left',spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]})];const deck=newDeck('Imported',[s]);
  const next=applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:s.elements[0].id,patch:{text:'New'}}],0,'ai');const changed=next.slides[0].elements[0];assert.equal(changed.paragraphs?.map(p=>p.runs.map(r=>r.text).join('')).join('\n')??changed.text,'New');assert.equal(changed.text,'New');assert.equal(deck.slides[0].elements[0].text,'Old');
});
test('Google theme palette uses the API RGB values directly, including inherited paper and text',()=>{
  const deck=importGoogle({presentation:{pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},masters:[{objectId:'m',pageProperties:{pageBackgroundFill:{solidFill:{color:{themeColor:'LIGHT1'}}},colorScheme:{colors:[{type:'LIGHT1',color:{red:1,green:1,blue:1}},{type:'DARK1',color:{red:.26666667,green:.26666667,blue:.26666667}}]}}}],slides:[{objectId:'s',slideProperties:{masterObjectId:'m'},pageProperties:{pageBackgroundFill:{propertyState:'INHERIT'}},pageElements:[{objectId:'t',size:{width:{magnitude:100,unit:'PT'},height:{magnitude:30,unit:'PT'}},shape:{shapeType:'TEXT_BOX',text:{textElements:[{textRun:{content:'Theme text',style:{foregroundColor:{opaqueColor:{themeColor:'DARK1'}}}}}]}}}]}]}});
  assert.equal(deck.slides[0].background,'#ffffff');assert.equal(deck.slides[0].elements[0].fill,'#444444');
});
test('PPTX resolves theme fonts and color aliases through each slide master relationship',async()=>{
  const p=new PptxGenJS();p.layout='LAYOUT_WIDE';
  for(let i=0;i<2;i++)p.addSlide().addText('Master font',{x:1,y:1,w:4,h:1,fontFace:'+mn-lt',color:'111111'});
  const zip=await JSZip.loadAsync(await p.write({outputType:'uint8array'}) as Uint8Array);
  const text=async(path:string)=>zip.file(path)!.async('string');
  const firstTheme=await text('ppt/theme/theme1.xml');
  zip.file('ppt/theme/theme2.xml',firstTheme.replace(/(<a:minorFont>\s*<a:latin typeface=")[^"]*/, '$1Georgia'));
  zip.file('ppt/slideMasters/slideMaster2.xml',await text('ppt/slideMasters/slideMaster1.xml'));
  zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels',(await text('ppt/slideMasters/_rels/slideMaster1.xml.rels')).replaceAll('theme1.xml','theme2.xml'));
  zip.file('ppt/slideLayouts/slideLayout2.xml',await text('ppt/slideLayouts/slideLayout1.xml'));
  zip.file('ppt/slideLayouts/_rels/slideLayout2.xml.rels',(await text('ppt/slideLayouts/_rels/slideLayout1.xml.rels')).replaceAll('slideMaster1.xml','slideMaster2.xml'));
  zip.file('ppt/slides/_rels/slide2.xml.rels',(await text('ppt/slides/_rels/slide2.xml.rels')).replaceAll('slideLayout1.xml','slideLayout2.xml'));
  for(let i=1;i<=2;i++)zip.file(`ppt/slides/slide${i}.xml`,(await text(`ppt/slides/slide${i}.xml`)).replace('<a:srgbClr val="111111"/>','<a:schemeClr val="tx1"/>').replace('<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>','<p:clrMapOvr><a:overrideClrMapping tx1="accent2"/></p:clrMapOvr>'));
  const imported=await importPptx(await zip.generateAsync({type:'uint8array'}),'multiple-masters.pptx');
  const fonts=imported.slides.map(s=>s.elements.find(e=>e.type==='text')!);
  assert.equal(fonts[1].fontFamily,'Georgia');assert.notEqual(fonts[0].fontFamily,fonts[1].fontFamily);
  const accent=firstTheme.match(/<a:accent2><a:srgbClr val="([A-Fa-f0-9]{6})"\/>/)![1];
  assert.equal(fonts[1].fill,`#${accent}`);
});
test('Google sparse quarter-turn transforms, native shape fallback and numbered bullets retain source semantics',()=>{
  const deck=importGoogle({presentation:{pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},slides:[{objectId:'s',pageElements:[{objectId:'arrow',size:{width:{magnitude:100,unit:'PT'},height:{magnitude:50,unit:'PT'}},transform:{shearX:-1,shearY:1,translateX:200,translateY:20,unit:'PT'},shape:{shapeType:'BENT_ARROW'}},{objectId:'body',size:{width:{magnitude:200,unit:'PT'},height:{magnitude:15,unit:'PT'}},shape:{shapeType:'TEXT_BOX',text:{textElements:[{endIndex:6,paragraphMarker:{bullet:{glyph:'2.'}}},{endIndex:5,textRun:{content:'Entry',style:{fontSize:{magnitude:12,unit:'PT'}}}},{startIndex:5,endIndex:6,textRun:{content:'\n',style:{fontSize:{magnitude:28,unit:'PT'}}}}]}}}]}]}});
  const [arrow,body]=deck.slides[0].elements;
  assert.equal(arrow.type,'image');assert.equal(arrow.w,100);assert.equal(arrow.h,200);assert.equal(arrow.x,300);assert.equal(arrow.rotation,0);assert(arrow.sourceRegion);
  assert.equal(body.paragraphs?.[0].bullet,'2.');assert.equal(body.paragraphs?.[0].runs.length,1);assert.equal(body.clipText,false);
});
test('PPTX empty text XML never becomes object text and native picture masks retain raw image bytes',async()=>{
  const p=new PptxGenJS();p.layout='LAYOUT_WIDE';const s=p.addSlide();
  s.addText('Visible',{x:1,y:1,w:4,h:.5});s.addImage({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',x:6,y:2,w:3,h:3});
  const zip=await JSZip.loadAsync(await p.write({outputType:'uint8array'}) as Uint8Array),path='ppt/slides/slide1.xml';let source=await zip.file(path)!.async('string');
  source=source.replace('</a:p>','<a:r><a:rPr/><a:t/></a:r></a:p>').replace(/(<p:pic>[\s\S]*?<a:prstGeom prst=")rect/, '$1pie');zip.file(path,source);
  const d=await importPptx(await zip.generateAsync({type:'uint8array'}),'native-mask.pptx');
  assert.equal(d.slides[0].elements.find(e=>e.type==='text')!.text,'Visible');
  const image=d.slides[0].elements.find(e=>e.type==='image')!;assert(image.sourceRegion);assert(image.src?.startsWith('data:image/png;base64,'));assert(d.slides[0].source?.warnings.some(w=>w.includes('mask')));
});
test('Figma native text truncation keeps full authored text and a finite line limit',()=>{
  const chars='Full source text remains editable after truncation';
  const deck=importFigma({slides:[{id:'1:1',name:'Source',absoluteBoundingBox:{x:0,y:0,width:1440,height:810},children:[{id:'2:1',type:'TEXT',characters:chars,absoluteBoundingBox:{x:40,y:40,width:200,height:60},style:{fontSize:20,fontFamily:'Arial',lineHeightPx:30,textTruncation:'ENDING',maxLines:2}}]}]});
  const text=deck.slides[0].elements[0];assert.equal(text.text,chars);assert.equal(text.maxLines,2);assert(textFlowStyle(text).includes('-webkit-line-clamp:2'));
});
