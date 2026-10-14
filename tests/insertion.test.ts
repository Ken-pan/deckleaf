import {test} from 'node:test';
import {DEFAULT_DESIGN_SYSTEM} from '../src/core/design-system-schema';
import assert from 'node:assert/strict';
import {insertionGeometry, imageInsertionGeometry, insertedElement, insertionSizeLabel, fitTextInsertion, repeatedPlacementClick, placementHistoryMatch, type PrimitiveInsertTool} from '../src/core/insertion';
import {blankSlide, newDeck, element} from '../src/core/model';
import {applyOperations} from '../src/core/operations';

const page={width:1440,height:810};
test('new text starts at the caret and fits its measured content without changing existing geometry',()=>{
  const caret=insertionGeometry('text',page,{x:1395,y:790});
  assert.equal(caret.x,1395);assert.equal(caret.w,1);
  const before=JSON.stringify(caret);
  const fitted=fitTextInsertion(page,caret,{w:568.6,h:40});
  assert.equal(fitted.x,871.4);assert.equal(fitted.y,770);assert.equal(fitted.w,568.6);assert.equal(fitted.textSizing,'auto-width');
  const growing=fitTextInsertion(page,caret,{w:800,h:120});
  assert.equal(growing.x,640);assert.equal(growing.y,690);
  const wide=fitTextInsertion(page,caret,{w:2000,h:160});
  assert.equal(wide.x,0);assert.equal(wide.w,1440);assert.equal(wide.textSizing,'auto-height');
  const paragraph=fitTextInsertion(page,{x:1200,y:740,w:240,h:70,textSizing:'auto-height'},{w:240,h:160});
  assert.equal(paragraph.w,240);assert.equal(paragraph.y,650);assert.equal(paragraph.textSizing,'auto-height');
  assert.equal(JSON.stringify(caret),before);
});
test('rapid clicks at one position cannot silently consume a queued asset; distinct placements remain available',()=>{
  const first={client:{x:200,y:300},time:100,slideId:'slide-a',revision:5};
  assert.equal(repeatedPlacementClick(first,{...first,time:180}),true);
  assert.equal(repeatedPlacementClick(first,{...first,client:{x:204,y:302},time:250}),true);
  assert.equal(repeatedPlacementClick(first,{...first,time:500}),false);
  assert.equal(repeatedPlacementClick(first,{...first,client:{x:210,y:300},time:180}),false);
  assert.equal(repeatedPlacementClick(first,{...first,slideId:'slide-b',time:180}),false);
  assert.equal(repeatedPlacementClick(first,{...first,time:90}),false);
  assert.equal(repeatedPlacementClick(first,{...first,revision:6,time:180}),false);
  assert.equal(repeatedPlacementClick(null,first),false);
});
test('click placement uses the requested point, fits near edges, and scales to small slides',()=>{
  assert.deepEqual(insertionGeometry('rect',page,{x:200,y:140}),{x:200,y:140,w:300,h:200});
  for(const type of ['text','rect','ellipse','line','table','chart'] as PrimitiveInsertTool[]){
    for(const size of [page,{width:320,height:180}]){
      const b=insertionGeometry(type,size,{x:size.width-1,y:size.height-1});
      assert.ok(b.x>=0&&b.y>=0&&b.w>=1&&b.h>=1&&b.x+b.w<=size.width&&b.y+b.h<=size.height);
      assert.doesNotThrow(()=>insertedElement(type,size,b));
    }
  }
});
test('default primitive sizes and type scale with the page rather than the displayed canvas',()=>{
  const expected={rect:[300,200],ellipse:[160,160],line:[320,1],table:[720,240],chart:[600,320]};
  for(const [type,[w,h]] of Object.entries(expected)){
    const full=insertionGeometry(type as PrimitiveInsertTool,page,{x:96,y:96});
    const half=insertionGeometry(type as PrimitiveInsertTool,{width:720,height:405},{x:48,y:48});
    assert.equal(full.w,w);assert.equal(full.h,h);assert.equal(half.w,w/2);assert.equal(half.h,Math.max(1,h/2));
  }
  const text=insertedElement('text',page,insertionGeometry('text',page,{x:100,y:100}));
  assert.equal(text.fontSize,32);
  assert.equal(insertionSizeLabel('text',page),'Auto width · 32 px type');
  assert.equal(insertionSizeLabel('image',page,{w:64,h:64}),'64 × 64 px');
  assert.equal(insertionSizeLabel('line',page),'320 px long · 3 px stroke');
  const smallPage={width:720,height:405};
  const line=insertedElement('line',smallPage,insertionGeometry('line',smallPage,{x:48,y:48}));
  assert.equal(line.strokeWidth,1.5);assert.equal(insertionSizeLabel('line',smallPage),'160 px long · 1.5 px stroke');
});
test('drag placement supports every direction and clamps outside release coordinates',()=>{
  assert.deepEqual(insertionGeometry('rect',page,{x:500,y:400},{x:200,y:100}),{x:200,y:100,w:300,h:300});
  assert.deepEqual(insertionGeometry('rect',page,{x:500,y:400},{x:1800,y:1000}),{x:500,y:400,w:940,h:410});
  const square=insertionGeometry('ellipse',page,{x:1200,y:500},{x:1430,y:800},true);
  assert.equal(square.w,square.h);assert.ok(square.x+square.w<=page.width);
  const thinText=insertionGeometry('text',page,{x:500,y:400},{x:800,y:400});assert.equal(thinText.w,300);assert.equal(thinText.h,50);
});
test('lines keep their diagonal direction, including vertical/horizontal and Shift constraints',()=>{
  const up=insertionGeometry('line',page,{x:200,y:300},{x:500,y:100});assert.equal(up.flipY,true);
  const down=insertionGeometry('line',page,{x:500,y:300},{x:200,y:100});assert.equal(down.flipY,false);
  const horizontal=insertionGeometry('line',page,{x:100,y:100},{x:400,y:101},true);assert.equal(horizontal.h,1);
  const vertical=insertionGeometry('line',page,{x:100,y:100},{x:101,y:400},true);assert.equal(vertical.w,1);
  const diagonal=insertionGeometry('line',page,{x:1300,y:700},{x:1800,y:950},true);assert.ok(diagonal.x+diagonal.w<=1440&&diagonal.y+diagonal.h<=810);assert.ok(Math.abs(diagonal.w-diagonal.h)<1e-8);
});
test('previews leave the document untouched and final text inserts as one atomic operation',()=>{
  const slide=blankSlide(),deck=newDeck('Insertion',[slide]),before=JSON.stringify(deck);
  for(let x=100;x<500;x+=20)insertionGeometry('text',deck,{x,y:100});
  assert.equal(JSON.stringify(deck),before);
  const text=insertedElement('text',deck,insertionGeometry('text',deck,{x:250,y:150}),'The intended text');
  const next=applyOperations(deck,[{op:'add_element',slideId:slide.id,element:text}],deck.revision);
  assert.equal(next.revision,deck.revision+1);assert.equal(next.slides[0].elements.length,1);assert.equal(next.slides[0].elements[0].text,'The intended text');assert.equal(JSON.stringify(deck),before);
  assert.throws(()=>applyOperations(next,[{op:'add_element',slideId:slide.id,element:text}],deck.revision));
});
test('asset placement preserves image proportions in all drag directions and fits along page edges',()=>{
  for(const size of [{w:600,h:400},{w:80,h:80},{w:200,h:500}]){
    for(const [start,end] of [[{x:200,y:150},{x:450,y:250}],[{x:900,y:600},{x:600,y:400}],[{x:1300,y:700},{x:2000,y:1000}],[{x:2,y:2},{x:-200,y:-200}]] as const){
      const b=imageInsertionGeometry(page,size,start,end);
      assert.ok(b.x>=0&&b.y>=0&&b.w>=1&&b.h>=1&&b.x+b.w<=page.width+1e-8&&b.y+b.h<=page.height+1e-8);
      assert.ok(Math.abs(b.w/b.h-size.w/size.h)<1e-8);
    }
    const click=imageInsertionGeometry(page,size,{x:1430,y:800});
    assert.ok(click.x+click.w<=1440&&click.y+click.h<=810);
    assert.equal(click.w,size.w);assert.equal(click.h,size.h);
  }
  assert.throws(()=>imageInsertionGeometry(page,{w:0,h:400},{x:1,y:1}));
});

 test('click text follows content; drawn text keeps the authored wrapping width',()=>{
  const click=insertedElement('text',page,insertionGeometry('text',page,{x:200,y:140}),'Title');
  const drawn=insertedElement('text',page,insertionGeometry('text',page,{x:200,y:140},{x:500,y:320}),'Body');
  assert.equal(click.textSizing,'auto-width');assert.equal(drawn.textSizing,'auto-height');assert.equal(drawn.w,300);
});

test('pending placement history follows only its own single image addition',()=>{
 const slide=blankSlide(),deck=newDeck('History',[slide]);
 const image=element('image',{src:'data:image/png;base64,AA=='});
 const placed=applyOperations(deck,[{op:'add_element',slideId:slide.id,element:image}],deck.revision);
 assert.equal(placementHistoryMatch(placed,deck,slide.id,image.id,'undo'),true);
 assert.equal(placementHistoryMatch(deck,placed,slide.id,image.id,'redo'),true);
 assert.equal(placementHistoryMatch(placed,deck,slide.id,'other-image','undo'),false);
 assert.equal(placementHistoryMatch(placed,{...deck,id:'other-deck'},slide.id,image.id,'undo'),false);
 assert.equal(placementHistoryMatch(placed,deck,'missing-slide',image.id,'undo'),false);
 assert.equal(placementHistoryMatch(placed,undefined,slide.id,image.id,'undo'),false);
 const moved=applyOperations(placed,[{op:'update_element',slideId:slide.id,elementId:image.id,patch:{x:100}}],placed.revision);
 assert.equal(placementHistoryMatch(moved,placed,slide.id,image.id,'undo'),false);
});


test('new text, lines and tables inherit readable deck roles on contrast slides',()=>{
  const deck=newDeck('Contrast',[blankSlide()]);deck.designSystem=DEFAULT_DESIGN_SYSTEM;
  const dark={backgroundStyle:'dark' as const},main={backgroundStyle:'background' as const};
  for(const type of ['text','table','line'] as const){
    const geometry=insertionGeometry(type,deck,{x:100,y:100});
    const contrast=insertedElement(type,deck,geometry,'Readable',dark),normal=insertedElement(type,deck,geometry,'Readable',main);
    if(type==='line'){assert.equal(contrast.stroke,DEFAULT_DESIGN_SYSTEM.colors.onDark);assert.equal(contrast.design?.stroke,'onDark');assert.equal(normal.stroke,DEFAULT_DESIGN_SYSTEM.colors.ink);}
    else {assert.equal(contrast.fill,DEFAULT_DESIGN_SYSTEM.colors.onDark);assert.equal(contrast.design?.fill,'onDark');assert.equal(normal.fill,DEFAULT_DESIGN_SYSTEM.colors.ink);}
    assert.equal(contrast.fontFamily,DEFAULT_DESIGN_SYSTEM.typography.body.fontFamily);
    const next=applyOperations(deck,[{op:'add_element',slideId:deck.slides[0].id,element:contrast}]);
    assert.equal(next.slides[0].elements[0].design?.[type==='line'?'stroke':'fill'],'onDark');
  }
});
