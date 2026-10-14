import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {buildPptx} from '../src/core/export';
import {importPptx} from '../src/importers/pptx';
import {importGoogle} from '../src/importers/google';
import {fontInventory} from '../src/core/fidelity';
import {element, blankSlide, newDeck} from '../src/core/model';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('actual PPTX writer retains notes, rich text and independent crops while sharing identical image bytes',async()=>{
  const s=blankSlide();s.notes='Source note\nSecond line';
  const t=element('text',{text:'Heading with space \n Body',x:80,y:60,w:800,h:160,fontFamily:'Arial',fontSize:32,paragraphs:[{runs:[{text:'Heading ',fontSize:48,bold:true},{text:'with space ',fontSize:48,bold:true}],align:'left',spaceBefore:0,spaceAfter:10,indent:0,firstLineIndent:0},{runs:[{text:' Body',fontFamily:'Georgia',fontSize:26,italic:true}],align:'right',spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]});
  const a=element('image',{src:png,fit:'contain',x:80,y:300,w:250,h:200,crop:{left:.1,right:.2,top:0,bottom:0}}),b=element('image',{src:png,fit:'fill',x:500,y:300,w:250,h:200,crop:{left:0,right:0,top:.1,bottom:.2},flipX:true});
  const table=element('table',{x:800,y:300,w:400,h:200,cells:[['Header','Value'],['Row','12']]});s.elements=[t,a,b,table];
  const bytes=await buildPptx(newDeck('Round trip',[s]));const zip=await JSZip.loadAsync(bytes);
  assert.equal(Object.keys(zip.files).filter(p=>/^ppt\/media\/.*\.png$/.test(p)).length,1);
  const d=await importPptx(bytes,'roundtrip.pptx'),out=d.slides[0];
  assert.equal(out.notes,s.notes);assert.equal(out.elements.find(e=>e.name===t.id)?.text,t.text);
  assert.equal(out.elements.find(e=>e.name===t.id)?.paragraphs?.[1].runs[0].fontFamily,'Georgia');
  assert.deepEqual(out.elements.find(e=>e.name===a.id)?.crop,a.crop);assert.deepEqual(out.elements.find(e=>e.name===b.id)?.crop,b.crop);
  assert.equal(out.elements.find(e=>e.name===a.id)?.x,a.x);assert.equal(out.elements.find(e=>e.name===a.id)?.w,a.w);
  assert.equal(out.elements.find(e=>e.name===b.id)?.flipX,true);
  assert.deepEqual(out.elements.find(e=>e.name===table.id)?.cells,table.cells);
});

test('standalone text boxes do not inherit shape otherStyle; local default paragraph styles still override',async()=>{
  const p=new PptxGenJS();p.layout='LAYOUT_WIDE';const s=p.addSlide();
  s.addText('Text box',{x:1,y:1,w:4,h:1});s.addText('Shape text',{x:1,y:3,w:4,h:1});
  const zip=await JSZip.loadAsync(await p.write({outputType:'uint8array'}) as Uint8Array);
  const slidePath='ppt/slides/slide1.xml';let slide=await zip.file(slidePath)!.async('string');
  slide=slide.replace(/<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/g,'<a:pPr/>');
  let count=0;slide=slide.replace(/<p:cNvSpPr[^>]*\/>/g,()=>++count===1?'<p:cNvSpPr txBox="1"/>':'<p:cNvSpPr/>');
  zip.file(slidePath,slide);
  const masterPath='ppt/slideMasters/slideMaster1.xml';let master=await zip.file(masterPath)!.async('string');
  master=master.replace(/<p:otherStyle>[\s\S]*?<\/p:otherStyle>/,'<p:otherStyle><a:lvl1pPr algn="r"/></p:otherStyle>');zip.file(masterPath,master);
  let deck=await importPptx(await zip.generateAsync({type:'uint8array'}),'keynote-textboxes.pptx');
  assert.equal(deck.slides[0].elements.find(e=>e.text==='Text box')?.align,'left');
  assert.equal(deck.slides[0].elements.find(e=>e.text==='Shape text')?.align,'right');
  zip.file(slidePath,slide.replace('<a:lstStyle/>','<a:lstStyle><a:defPPr algn="ctr"/></a:lstStyle>'));
  deck=await importPptx(await zip.generateAsync({type:'uint8array'}),'local-default.pptx');
  assert.equal(deck.slides[0].elements.find(e=>e.text==='Text box')?.align,'center');
});
test('numbering is a native sequence even when Keynote repeats startAt, and native connectors retain line identity',async()=>{
  const s=blankSlide();const t=element('text',{text:'First\nSecond\nThird',paragraphs:['First','Second','Third'].map((text,i)=>({runs:[{text,fontSize:30}],align:'left',spaceBefore:0,spaceAfter:8,indent:36,firstLineIndent:-18,bullet:`${i+1}.`}))});
  const line=element('line',{x:100,y:500,w:800,h:1,stroke:'#777777',strokeWidth:2});s.elements=[t,line];
  const bytes=await buildPptx(newDeck('Numbered',[s])),zip=await JSZip.loadAsync(bytes),path='ppt/slides/slide1.xml';let xml=await zip.file(path)!.async('string');
  assert.equal((xml.match(/<a:buAutoNum/g)||[]).length,3);assert(!xml.includes('<a:buChar char="1."'));
  xml=xml.replace(/(<a:buAutoNum[^>]*startAt=")\d+/g,'$11');
  xml=xml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g,raw=>raw.includes(`name="${line.id}"`)?raw.replaceAll('p:sp>','p:cxnSp>').replaceAll('p:nvSpPr','p:nvCxnSpPr').replaceAll('p:cNvSpPr','p:cNvCxnSpPr').replace(/<a:prstGeom[\s\S]*?<\/a:prstGeom>/,''):raw);
  zip.file(path,xml);const imported=await importPptx(await zip.generateAsync({type:'uint8array'}),'keynote-numbering.pptx');
  assert.deepEqual(imported.slides[0].elements.find(e=>e.type==='text')?.paragraphs?.map(p=>p.bullet),['1.','2.','3.']);
  assert.equal(imported.slides[0].elements.find(e=>e.name===line.id)?.type,'line');
  assert(Math.abs(imported.slides[0].elements.find(e=>e.name===line.id)!.y-line.y)<.001);
});
test('flowchart decision and terminator stay separate from editable labels, including exported corner geometry',async()=>{
 const shape=(objectId:string,shapeType:string)=>({objectId,size:{width:{magnitude:200,unit:'PT'},height:{magnitude:80,unit:'PT'}},shape:{shapeType,shapeProperties:{shapeBackgroundFill:{solidFill:{color:{rgbColor:{green:.5}}}}}}});
 const d=importGoogle({presentation:{pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},slides:[{objectId:'s',pageElements:[shape('decision','FLOW_CHART_DECISION'),shape('terminator','FLOW_CHART_TERMINATOR'),{objectId:'label',size:{width:{magnitude:200,unit:'PT'},height:{magnitude:80,unit:'PT'}},shape:{shapeType:'TEXT_BOX',text:{textElements:[{textRun:{content:'Independent label'}}]}}}]}]}});
 assert.deepEqual(d.slides[0].elements.map(e=>e.type),['diamond','rect','text']);assert.equal(d.slides[0].elements[1].radius,80);assert(!d.slides[0].elements.some(e=>e.sourceRegion));
 const out=await importPptx(await buildPptx(d),'diagram.pptx');assert.equal(out.slides[0].elements[0].type,'diamond');assert.equal(out.slides[0].elements[1].radius,80);assert.equal(out.slides[0].elements[2].text,'Independent label');
});
test('Google video keeps the native poster region instead of a blank editable page',()=>{
 const d=importGoogle({presentation:{pageSize:{width:{magnitude:720,unit:'PT'},height:{magnitude:405,unit:'PT'}},slides:[{objectId:'s',pageElements:[{objectId:'video',size:{width:{magnitude:300,unit:'PT'},height:{magnitude:200,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:50,translateY:30,unit:'PT'},video:{id:'public-video',source:'YOUTUBE'}}]}]}});
 const e=d.slides[0].elements[0];assert.equal(e.type,'image');assert.deepEqual(e.sourceRegion,{left:50/720,top:30/405,right:1-350/720,bottom:1-230/405});assert(d.slides[0].source?.warnings.some(w=>/play|播放/i.test(w)));
});
test('empty native paragraph runs do not report phantom missing fonts, while visible runs still do',()=>{
 const s=blankSlide();s.elements=[element('text',{fontFamily:'Arial',text:'Visible',paragraphs:[{runs:[{text:'Visible',fontFamily:'Inter'},{text:'',fontFamily:'Calibri'},{text:' ',fontFamily:'Georgia'}],align:'left',spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0}]})];
 assert.deepEqual(fontInventory(newDeck('Font audit',[s])).map(f=>f.family),['Arial','Inter','Georgia']);
});
