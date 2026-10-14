import test from 'node:test';
import assert from 'node:assert/strict';
import {Resvg} from '@resvg/resvg-js';
import {PNG} from 'pngjs';
import JSZip from 'jszip';
import {newDeck, blankSlide, element} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {insertionGeometry} from '../src/core/insertion';
import {keepsAspectRatio, resizedDimensions} from '../src/core/interactions';
import {resourceElement, resourceBackgroundOperations} from '../src/core/resources';
import {isRegionFill} from '../src/core/resource-purpose';
import {regionFillSource, prepareRegionFills} from '../src/core/region-fill';
import {resourceColorOperations} from '../src/core/resource-color';
import {loadResource} from '../server/resources';
import {graphicLibrary, graphicItem} from '../server/deck-graphics';

const page = {width:1440,height:810};
async function imported(id:string, color='#26362c', recipe?:{strength:number;scale:number;rotation:number}) {
  const data = await loadResource(id,color,false,recipe);
  return {resource:data.resource,src:`data:${data.type};base64,${data.bytes.toString('base64')}`};
}
const svg = (src:string) => Buffer.from(src.slice(src.indexOf(',')+1),'base64').toString('utf8');

test('area resources follow wide, tall, reverse and page-edge drag bounds; illustrations preserve ratio', async () => {
  const data=await imported('deck-graphics:fine-dots'), image=resourceElement(data.src,data.resource,1600,900,newDeck('Area',[blankSlide()]));
  assert(isRegionFill(image));assert.equal(keepsAspectRatio(image),false);
  const cases=[{a:{x:100,y:100},b:{x:1000,y:220},box:{x:100,y:100,w:900,h:120}},{a:{x:200,y:100},b:{x:280,y:700},box:{x:200,y:100,w:80,h:600}},{a:{x:900,y:700},b:{x:100,y:200},box:{x:100,y:200,w:800,h:500}},{a:{x:1200,y:700},b:{x:1800,y:1000},box:{x:1200,y:700,w:240,h:110}}];
  for(const c of cases)assert.deepEqual(insertionGeometry('image',page,c.a,c.b,false,image),c.box);
  const square=insertionGeometry('image',page,{x:100,y:100},{x:800,y:400},true,image);assert.equal(square.w,square.h);
  assert.deepEqual(resizedDimensions(image,'w',800),{w:800});
  const art={...image,resource:{...image.resource!,id:'deck-graphics:accent-curved-arrow'},fit:'contain' as const,aspectRatioLocked:undefined};
  assert(keepsAspectRatio(art));
  const box=insertionGeometry('image',page,{x:100,y:100},{x:1000,y:220},false,art);assert(Math.abs(box.w/box.h-art.w/art.h)<1e-8);
});

test('all repeating patterns extend their coverage while retaining tile size, angle and ink',async()=>{
  for(const record of (await graphicLibrary()).filter(r=>r.category!=='accent'&&graphicItem(r).repeatable)){
    const data=await imported(graphicItem(record).id,'#7f345a',{strength:.6,scale:1.4,rotation:35});
    const original=svg(data.src), result=svg(regionFillSource(element('image',{...data,fit:'fill',w:900,h:1200}))!);
    assert.match(result,/viewBox="0 0 900 1200"/);assert.match(result,/<rect[^>]*width="100%"[^>]*height="100%"/);
    assert.equal(result.match(/<pattern\b[^>]*>/)?.[0],original.match(/<pattern\b[^>]*>/)?.[0],record.id);
    const image=PNG.sync.read(new Resvg(result,{fitTo:{mode:'width',value:90}}).render().asPng());assert.equal(image.width,90);assert.equal(image.height,120);
  }
});

test('repeating dots retain round marks and the same spacing when a filled area is resized',async()=>{
  const data=await imported('deck-graphics:fine-dots');
  const small=PNG.sync.read(new Resvg(svg(regionFillSource(element('image',{...data,fit:'fill',w:300,h:120}))!)).render().asPng());
  const wide=PNG.sync.read(new Resvg(svg(regionFillSource(element('image',{...data,fit:'fill',w:600,h:120}))!)).render().asPng());
  for(let y=0;y<120;y++)assert.deepEqual(wide.data.subarray(y*600*4,(y*600+300)*4),small.data.subarray(y*300*4,(y+1)*300*4));
  const alpha=(x:number,y:number)=>wide.data[(y*600+x)*4+3];
  assert(alpha(12,12)>0);assert.equal(alpha(12,12),alpha(36,12));assert.equal(alpha(11,12),alpha(12,11));
  assert(wide.data.subarray(300*4).some((v,i)=>i%4===3&&v>0));
});

test('textures cover any region without stretched marks; ordinary or cropped resources retain source',async()=>{
  const data=await imported('deck-graphics:paper-grain'), image=element('image',{...data,fit:'fill',w:120,h:700});
  assert.match(svg(regionFillSource(image)!),/width="120" height="700" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"/);
  assert.equal(regionFillSource({...image,fit:'contain'}),data.src);
  assert.equal(regionFillSource({...image,crop:{left:.1,right:0,top:0,bottom:0}}),data.src);
  assert.equal(regionFillSource({...image,resource:{...data.resource,id:'deck-graphics:accent-curved-arrow'}}),data.src);
  const deck=newDeck('Area',[{...blankSlide(),elements:[image]}]), before=JSON.stringify(deck), rendered=prepareRegionFills(deck);
  assert.notEqual(rendered.slides[0].elements[0].src,image.src);assert.equal(JSON.stringify(deck),before);
  const background=applyOperations(deck,resourceBackgroundOperations(deck,deck.slides[0].id,{...image,id:'new-background'}),deck.revision).slides[0].elements[0];
  assert.equal(background.fit,'fill');assert.equal(background.aspectRatioLocked,false);assert.equal(background.locked,true);
});

test('selected graphic colors preserve each source variant, frame, crop and design link in an atomic operation',async()=>{
  const a=await imported('deck-graphics:fine-dots','#26362c',{strength:.6,scale:1.5,rotation:35});
  const b=await imported('deck-graphics:fine-dots','#26362c',{strength:1,scale:1,rotation:0});
  const first=element('image',{...a,x:10,y:20,w:900,h:120,fit:'fill',aspectRatioLocked:false,rotation:12}), second=element('image',{...b,crop:{left:.1,right:0,top:0,bottom:0}});
  const locked=element('image',{...a,locked:true}), photo=element('image',{src:'data:image/png;base64,AA=='}), text=element('text');
  const slide={...blankSlide(),elements:[first,second,locked,photo,text]}, deck=newDeck('Colors',[slide]), before=JSON.stringify(deck);let loads=0;
  const ops=await resourceColorOperations(deck,slide.id,slide.elements.map(e=>e.id),'#bd365b',async(resource,color)=>{loads++;return imported(resource.id,color,resource.graphicRecipe);});
  assert.equal(loads,2);assert.equal(ops.length,2);const next=applyOperations(deck,ops,deck.revision);
  for(let i=0;i<2;i++){const old=slide.elements[i],changed=next.slides[0].elements[i];for(const key of ['id','x','y','w','h','crop','fit','rotation','aspectRatioLocked'] as const)assert.deepEqual(changed[key],old[key]);assert.deepEqual(changed.resource?.graphicRecipe,old.resource?.graphicRecipe);assert.equal(changed.resource?.originalSha256,old.resource?.originalSha256);assert.equal(changed.resource?.color,'#bd365b');assert.notEqual(changed.src,old.src);}
  assert.equal(next.slides[0].elements[2].src,locked.src);assert.equal(JSON.stringify(deck),before);
  const guarded={...deck,slides:[{...slide,elements:[{...first,resource:{...first.resource!,originalSha256:'b'.repeat(64)}}]}]};
  await assert.rejects(resourceColorOperations(guarded,slide.id,[first.id],'#123456',async()=>({...a,resource:{...a.resource,color:'#123456',originalSha256:'a'.repeat(64)}})),/source has changed/);
});

test('accent SVGs recolor after placement and custom illustration colors override the document accent',async()=>{
  const data=await imported('deck-graphics:accent-curved-arrow'), accent=element('image',{...data,fit:'contain',w:200,h:80});
  const slide={...blankSlide(),elements:[accent]}, deck=newDeck('Accent',[slide]);
  const ops=await resourceColorOperations(deck,slide.id,[accent.id],'#35664d',(resource,color)=>imported(resource.id,color));
  const changed=applyOperations(deck,ops,deck.revision).slides[0].elements[0];assert.match(svg(changed.src!),/#35664d/);assert.equal(changed.fit,'contain');
  const illustration=await imported('blue-black:scene-01-guidance','#2f5bff'), art=element('image',{...illustration,fill:'#2f5bff',design:{fill:'accent'}});
  const linkedSlide={...blankSlide(),elements:[art]}, linked=newDeck('Linked',[linkedSlide]);
  const linkedOps=await resourceColorOperations(linked,linkedSlide.id,[art.id],'#abc',(resource,color)=>imported(resource.id,color));
  const recolored=applyOperations(linked,linkedOps,linked.revision).slides[0].elements[0];assert.equal(recolored.fill,'#aabbcc');assert.equal(recolored.design?.fill,undefined);
});

test('HTML and PPTX carry the adapted region while preserving the authored source document',async()=>{
  const data=await imported('deck-graphics:fine-dots'), image=element('image',{...data,fit:'fill',aspectRatioLocked:false,w:900,h:120,fontFamily:'Arial'});
  const deck=newDeck('Area export',[{...blankSlide(),elements:[image]}]),before=JSON.stringify(deck);
  const {buildHtml}=await import('../src/core/export');const html=await (await buildHtml(deck)).text();
  const portable=JSON.parse(html.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/)![1]);assert.match(svg(portable.slides[0].elements[0].src),/viewBox="0 0 900 120"/);
  const {buildPptx}=await import('../src/core/pptx-export');const zip=await JSZip.loadAsync(await buildPptx(deck));
  const images=Object.keys(zip.files).filter(path=>/ppt\/media\/.*\.svg$/.test(path));assert(images.length>0);
  assert((await Promise.all(images.map(path=>zip.file(path)!.async('string')))).some(text=>text.includes('viewBox="0 0 900 120"')));
  assert.equal(JSON.stringify(deck),before);
});
