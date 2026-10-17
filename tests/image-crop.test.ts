import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck,validateDeck} from '../src/core/model';
import {initialCropImage,panCropImage,resizeCropImage,cropRatioFrame,resizeCropFrame,cropImagePatch} from '../src/core/image-crop';
import {imageLayout} from '../src/core/image-style';
import {applyOperations} from '../src/core/operations';
const size={w:1200,h:800};
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('entering Crop preserves Fill and Fit picture pixels without committing',()=>{
  for(const fit of ['cover','contain','crop'] as const){
    const e=element('image',{x:30,y:40,w:400,h:400,fit,imagePosition:{x:.2,y:.7},...(fit==='crop'?{crop:{left:.1,right:.2,top:.1,bottom:.1},imageSize:size,imageZoom:1.2}:{})});
    const before=JSON.stringify(e),image=initialCropImage(e,size),patch=cropImagePatch(e,size,{x:0,y:0,w:e.w,h:e.h},image),after=imageLayout({...e,...patch},size);
    close(after.x,image.x);close(after.y,image.y);close(after.w,image.w);close(after.h,image.h);assert.equal(JSON.stringify(e),before);
  }
});
test('dragging crop edges trims the frame while retaining image scale and source pixels',()=>{
  const e=element('image',{x:100,y:80,w:600,h:400,fit:'cover'}),image=initialCropImage(e,size),frame=resizeCropFrame({x:0,y:0,w:e.w,h:e.h},image,'nw',90,60);
  const patch=cropImagePatch(e,size,frame,image),after=imageLayout({...e,...patch},size);
  close(patch.x!,190);close(patch.y!,140);close(patch.w!,510);close(patch.h!,340);close(after.w,image.w);close(after.h,image.h);close(after.x,image.x-frame.x);close(after.y,image.y-frame.y);
});
test('symmetric and ratio crop handles can extend outside the source image',()=>{
  const frame={x:100,y:100,w:600,h:400},image={x:0,y:0,w:800,h:600};
  const symmetric=resizeCropFrame(frame,image,'e',40,0,undefined,true);close(symmetric.x,60);close(symmetric.w,680);
  for(const ratio of [1,16/9,9/16,4/3]){
    const next=resizeCropFrame(frame,image,'se',300,200,ratio);close(next.w/next.h,ratio);assert(next.x+next.w>image.w||next.y+next.h>image.h);
    const preset=cropRatioFrame(frame,image,ratio);close(preset.w/preset.h,ratio);
  }
});
test('pan freely moves both oversized and smaller images beyond every crop edge',()=>{
  const frame={x:0,y:0,w:400,h:400};
  const big=panCropImage({x:-100,y:-100,w:800,h:600},frame,10000,-10000);assert.deepEqual(big,{x:9900,y:-10100,w:800,h:600});
  const small=panCropImage({x:100,y:100,w:200,h:200},frame,1000,-1000);assert.deepEqual(small,{x:1100,y:-900,w:200,h:200});
});
test('Crop mode persists through one guarded operation and retains source bytes',()=>{
  const e=element('image',{src:'data:image/png;base64,AA==',x:100,y:100,w:600,h:400,fit:'cover'}),slide=blankSlide();slide.elements=[e];const deck=newDeck('Crop',[slide]);
  const image=initialCropImage(e,size),patch=cropImagePatch(e,size,{x:60,y:40,w:480,h:320},image),next=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch}],0,'manual');
  const saved=validateDeck(JSON.parse(JSON.stringify(next))).slides[0].elements[0];assert.equal(saved.fit,'crop');assert.equal(saved.src,e.src);assert.equal(deck.revision,0);assert.equal(next.revision,1);assert.equal(e.crop,undefined);
});
test('rotated and flipped crop frames preserve their physical center',()=>{
  const e=element('image',{x:100,y:100,w:600,h:400,fit:'cover',rotation:90,flipX:true}),image=initialCropImage(e,size),patch=cropImagePatch(e,size,{x:100,y:0,w:500,h:400},image);
  close(patch.x!,150);close(patch.y!,50);close(patch.w!,500);close(patch.h!,400);
});

test('off-frame positions and blank margins survive save and reopen without clamping',()=>{
  const e=element('image',{src:'data:image/png;base64,AA==',x:100,y:80,w:600,h:400,fit:'cover'}),frame={x:0,y:0,w:e.w,h:e.h};
  for(const image of [{x:180,y:90,w:600,h:400},{x:800,y:-900,w:600,h:400},{x:-900,y:800,w:600,h:400},{x:120,y:100,w:300,h:200}]){
    const patch=cropImagePatch(e,size,frame,image),saved={...e,...patch},slide=blankSlide();slide.elements=[saved];
    const restored=validateDeck(JSON.parse(JSON.stringify(newDeck('Outside crop',[slide])))).slides[0].elements[0],actual=imageLayout(restored,size);
    close(actual.x,image.x);close(actual.y,image.y);close(actual.w,image.w);close(actual.h,image.h);assert.equal(restored.src,e.src);
    assert(actual.visible.w>=0&&actual.visible.h>=0);
    if(image.x>=frame.w||image.y>=frame.h)assert(actual.visible.w===0||actual.visible.h===0);
  }
});
test('original image corner handles scale proportionally with the opposite corner fixed',()=>{
  const image={x:100,y:80,w:600,h:400};
  const larger=resizeCropImage(image,'se',120,0);close(larger.x,100);close(larger.y,80);close(larger.w,720);close(larger.h,480);
  const smaller=resizeCropImage(image,'nw',120,80);close(smaller.x+smaller.w,700);close(smaller.y+smaller.h,480);close(smaller.w/smaller.h,1.5);
});
