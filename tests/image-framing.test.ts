import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import {element,blankSlide,newDeck,validateDeck,ElementSchema} from '../src/core/model';
import {imageStyle,imageLayout,createImageRendering} from '../src/core/image-style';
import {nativeImageFrame} from '../src/core/image-framing';
import {resourceReplacementPatch} from '../src/core/resource-replacement';
import {applyOperations} from '../src/core/operations';
import {buildPptx} from '../src/core/pptx-export';
const size={w:1200,h:600};
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('Fill anchors and Crop zoom select the expected source region without stretching',()=>{
  const base=element('image',{x:0,y:0,w:300,h:300,fit:'cover'});
  for(const x of [0,.5,1]){
    const e={...base,imagePosition:{x,y:.5}},layout=imageLayout(e,size),native=nativeImageFrame(e,size);
    close(layout.w,600);close(layout.h,300);close(layout.x,-300*x);
    close(native.crop!.left,.5*x);close(native.crop!.right,.5*(1-x));
    close(native.w,300);close(native.h,300);
  }
  const zoomed=nativeImageFrame({...base,fit:'crop',imageZoom:2},size);
  close(zoomed.crop!.left,.375);close(zoomed.crop!.top,.25);close(zoomed.crop!.right,.375);close(zoomed.crop!.bottom,.25);
});

test('Fill ignores stale zoom and keeps only its position',()=>{
  const e=element('image',{w:300,h:300,fit:'cover',imagePosition:{x:1,y:.5}});
  assert.deepEqual(imageLayout({...e,imageZoom:3},size),imageLayout(e,size));
  assert.equal(imageStyle({...e,imageZoom:3}),imageStyle(e));
});

test('Fit stays centered and Stretch fills the frame despite stale Fill controls',()=>{
  for(const fit of ['contain','fill'] as const){
    const clean=element('image',{x:100,y:50,w:300,h:300,fit});
    const stale={...clean,imagePosition:{x:1,y:0},imageZoom:3};
    assert.deepEqual(imageLayout(stale,size),imageLayout(clean,size));
    assert.equal(imageStyle(stale),imageStyle(clean));
    assert.deepEqual(nativeImageFrame(stale,size),nativeImageFrame(clean,size));
    const measured={...stale,imageSize:size};
    assert.equal(imageStyle(measured),imageStyle({...clean,imageSize:size}));
  }
  const e=element('image',{x:100,y:50,w:300,h:300,fit:'contain',imagePosition:{x:.5,y:0}});
  const native=nativeImageFrame(e,size);close(native.x,100);close(native.y,125);close(native.w,300);close(native.h,150);
  const flipped=nativeImageFrame({...e,flipY:true},size);close(flipped.y,125);
  const rotated=nativeImageFrame({...e,rotation:90},size);close(rotated.x,100);close(rotated.y,125);
});

test('edited source crops fit the selected region and legacy crops keep their stretched appearance',()=>{
  const crop={left:.25,right:.25,top:0,bottom:0};
  const old=element('image',{w:400,h:200,fit:'contain',crop});
  close(imageLayout(old,size).w,800);close(imageLayout(old,size).h,200);
  const modern={...old,imageSize:size};const layout=imageLayout(modern,size);
  close(layout.w,400);close(layout.h,200);close(layout.visible.x,100);close(layout.visible.w,200);
  assert.match(imageStyle(modern),/clip-path:inset\(0% 25% 0% 25%\)/);
  const fill=nativeImageFrame({...modern,fit:'cover'},size);
  close(fill.crop!.left,.25);close(fill.crop!.right,.25);close(fill.crop!.top,.25);close(fill.crop!.bottom,.25);
});

test('framing validates atomically, round trips, preserves source bytes, and resets on replacement',()=>{
  const e=element('image',{src:'data:image/png;base64,AA=='}),s=blankSlide();s.elements=[e];const deck=newDeck('Framing',[s]);
  const patch={imagePosition:{x:.2,y:.8},imageZoom:2,imageSize:size,crop:{left:.1,right:.1,top:.2,bottom:.2}};
  const next=applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:e.id,patch}],0,'manual');
  const saved=validateDeck(JSON.parse(JSON.stringify(next))).slides[0].elements[0];assert.deepEqual(saved.imagePosition,patch.imagePosition);assert.equal(saved.imageZoom,2);assert.equal(saved.src,e.src);assert.equal(e.imageZoom,undefined);
  for(const invalid of [{imageZoom:0},{imageZoom:21},{imagePosition:{x:1.1,y:.5}},{imageSize:{w:0,h:1}}])assert.equal(ElementSchema.safeParse({...e,...invalid}).success,false);
  assert.throws(()=>applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:e.id,patch:{imageZoom:2}},{op:'update_element',slideId:s.id,elementId:e.id,patch:{imagePosition:{x:2,y:0}}}],0,'manual'));assert.equal(deck.revision,0);
  const replacement={...saved,...resourceReplacementPatch({src:e.src,name:'Replacement'})};assert.equal(replacement.imagePosition,undefined);assert.equal(replacement.imageZoom,undefined);assert.equal(replacement.imageSize,undefined);assert.equal(replacement.crop,undefined);
});

test('portable HTML uses the same framing math without application imports',()=>{
  const factory=runInNewContext(`(${createImageRendering.toString()})`,{__name:(fn:Function)=>fn});
  const styles=factory((s:string)=>s),e=element('image',{w:300,h:300,fit:'cover',imagePosition:{x:1,y:0},imageZoom:1.7,imageSize:size,crop:{left:.1,right:.2,top:0,bottom:0}});
  assert.equal(styles.imageStyle(e),imageStyle(e));
});

test('PPTX writes native source crops for positioned and zoomed pictures',async()=>{
  const s=blankSlide();s.elements=[element('image',{id:'framed',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXvYAAAAASUVORK5CYII=',x:100,y:50,w:300,h:300,fit:'crop',imagePosition:{x:1,y:.5},imageZoom:2,imageSize:size})];
  const deck=newDeck('Native framing',[s]),before=JSON.stringify(deck),zip=await JSZip.loadAsync(await buildPptx(deck)),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(xml,/<a:srcRect l="75000" r="0" t="25000" b="25000"\/>/);assert.equal(JSON.stringify(deck),before);
});

test('PPTX omits a completely off-frame picture instead of filling the blank crop',async()=>{
  const {cropImagePatch}=await import('../src/core/image-crop');
  const e=element('image',{id:'outside',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXvYAAAAASUVORK5CYII=',w:300,h:300,fit:'cover'}),s=blankSlide();
  s.elements=[{...e,...cropImagePatch(e,size,{x:0,y:0,w:300,h:300},{x:800,y:900,w:600,h:300})}];
  const zip=await JSZip.loadAsync(await buildPptx(newDeck('Blank crop',[s]))),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert(!xml.includes('<p:pic>'));
});
