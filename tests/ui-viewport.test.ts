import test from 'node:test';
import assert from 'node:assert/strict';
import {floatingPlacement,workspaceViewport} from '../src/ui-viewport';
import {contextMenuPlacement} from '../src/context-menu-viewport';

test('keyboard viewport shrinks and offsets the workspace without exceeding layout height',()=>{
  assert.deepEqual(workspaceViewport(844,{left:0,top:30,width:390,height:420}),{height:420,top:30});
  assert.deepEqual(workspaceViewport(568,{left:0,top:0,width:320,height:600}),{height:568,top:0});
});
test('native page pinch retains layout geometry while overlays use the visual viewport',()=>{
  const viewport={left:90,top:120,width:260,height:563};
  assert.deepEqual(workspaceViewport(844,viewport,1.5),{height:844,top:0});
  const menu=floatingPlacement({left:300,right:344,top:540,bottom:584},{width:240,height:300},viewport);
  assert(menu.left>=102&&menu.top>=132);assert(menu.left+Math.min(240,menu.maxWidth)<=338);
});

test('floating surfaces flip above a bottom dock and keep viewport clearance', () => {
  const p = floatingPlacement({left: 300, right: 344, top: 570, bottom: 614}, {width: 360, height: 480}, {left: 0, top: 0, width: 390, height: 844});
  assert.equal(p.placement, 'above'); assert.equal(p.left, 18); assert.equal(p.top, 82);
  assert.equal(p.maxWidth, 366); assert.equal(p.maxHeight, 550);
});
test('replacement picker leaves the target visible on either side and falls back on phones', () => {
  const viewport = {left:0, top:0, width:1440, height:1000};
  const anchor = {left:330, right:425, top:325, bottom:369};
  for (const target of [{left:330,right:625,top:380,bottom:600}, {left:980,right:1275,top:700,bottom:920}]) {
    const p = floatingPlacement(anchor, {width:400,height:800}, viewport, {avoid:target,bottomBoundary:930});
    assert.equal(p.placement,'beside');
    assert(p.left >= target.right + 8 || p.left + 400 <= target.left - 8);
    assert(p.top >= 12 && p.top + 800 <= 930);
  }
  const phone = floatingPlacement(anchor, {width:400,height:800}, {left:0,top:0,width:390,height:844}, {avoid:{left:24,right:340,top:240,bottom:600},minHeight:400});
  assert.notEqual(phone.placement,'beside');
  assert(phone.left>=12 && phone.left+Math.min(400,phone.maxWidth)<=378);
});
test('visual viewport offsets and keyboard height constrain both axes', () => {
  const viewport = {left: 35, top: 180, width: 320, height: 250};
  const p = floatingPlacement({left: 290, right: 334, top: 285, bottom: 329}, {width: 340, height: 420}, viewport, {minHeight: 160});
  assert.equal(p.placement, 'overlay'); assert.equal(p.left, 47); assert.equal(p.top, 192);
  assert.equal(p.maxWidth, 296); assert.equal(p.maxHeight, 226);
});
test('menus align to their end edge without exceeding short viewports', () => {
  const p = floatingPlacement({left: 280, right: 324, top: 44, bottom: 88}, {width: 232, height: 450}, {left: 0, top: 0, width: 320, height: 256}, {align: 'end'});
  assert.equal(p.left, 76); assert.equal(p.top, 96); assert.equal(p.maxHeight, 148);
});
test('offscreen anchors and resized content stay in the visible rectangle', () => {
  for (const anchor of [{left: -400, right: -356, top: -80, bottom: -36}, {left: 1200, right: 1244, top: 1400, bottom: 1444}]) {
    const p = floatingPlacement(anchor, {width: 500, height: 700}, {left: 0, top: 0, width: 320, height: 480});
    assert(p.left >= 12); assert(p.left + Math.min(500, p.maxWidth) <= 308);
    assert(p.top >= 12); assert(p.top + Math.min(700, p.maxHeight) <= 468);
  }
});
test('replacement sheets use the visible viewport below the toolbar, including keyboard offsets', () => {
  for (const viewport of [{left:0,top:0,width:390,height:844},{left:0,top:0,width:320,height:568},{left:0,top:180,width:390,height:360}]) {
    const p=floatingPlacement({left:20,right:64,top:210,bottom:254},{width:400,height:800},viewport,{overlay:true,topBoundary:68,maxHeight:800});
    assert.equal(p.placement,'overlay');
    assert(p.top>=Math.max(68,viewport.top+12));
    assert(p.top+p.maxHeight<=viewport.top+viewport.height-12);
    assert(p.left+Math.min(400,p.maxWidth)<=viewport.left+viewport.width-12);
  }
});
test('cursor menus stay near the cursor and use the full viewport when neither side fits',()=>{
  const p=contextMenuPlacement({x:565,y:369},{width:264,height:469},{left:0,top:0,width:1280,height:800});
  assert.equal(p.left,565);assert.equal(p.top,319);assert.equal(p.maxHeight,776);
  assert.equal(p.placement,'overlay');assert(p.top+469<=788);
  const edge=contextMenuPlacement({x:1250,y:780},{width:264,height:500},{left:0,top:0,width:1280,height:800});
  assert.equal(edge.placement,'above');assert.equal(edge.left,986);assert.equal(edge.top,272);
});
test('cursor menu bounds cover short screens, keyboard offsets and native magnification',()=>{
  for(const viewport of [{left:0,top:0,width:320,height:568},{left:35,top:180,width:320,height:250},{left:90,top:120,width:260,height:563}]){
    for(const point of [{x:0,y:0},{x:200,y:300},{x:1500,y:1500}]){
      const p=contextMenuPlacement(point,{width:264,height:507},viewport);
      assert(p.left>=viewport.left+12&&p.top>=viewport.top+12);
      assert(p.left+Math.min(264,p.maxWidth)<=viewport.left+viewport.width-12);
      assert(p.top+Math.min(507,p.maxHeight)<=viewport.top+viewport.height-12);
    }
  }
});
