import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {createSnapScene,snapMove,snapResize} from '../src/core/snapping';
import {resizeFromCorner,selectionBounds,resizeHandlePoint} from '../src/core/interactions';
import {resizeSelectionFrame} from '../src/core/selection-transform';
import {nextIncrement} from '../src/core/numeric-increment';
const shape=(id:string,x:number,y=300,w=100,h=80,extra={})=>element('rect',{id,x,y,w,h,...extra});
function scene(elements:ReturnType<typeof shape>[],ids=['move']){const slide=blankSlide();slide.elements=elements;slide.layout={margins:{top:60,right:120,bottom:60,left:80},columns:1,gutter:24};const deck=newDeck('Snap',[slide],1000,700);return createSnapScene(deck,slide,ids)!;}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
test('margins and page centres snap the visible moving bounds',()=>{
 const s=scene([shape('move',100)]);near(snapMove(s,-17,0,{grid:false,scale:1}).dx,-20);
 near(snapMove(s,347,0,{grid:false,scale:1}).dx,350);
 assert.equal(snapMove(s,-17,0,{grid:false,scale:1}).guides[0].kind,'margin');
});
test('group snapping uses the entire selection, independent of which member was grabbed',()=>{
 const s=scene([shape('g1',100,500,40,40,{group:'g'}),shape('g2',220,500,40,40,{group:'g'})],['g1','g2']);
 const result=snapMove(s,316,0,{grid:false,scale:1});near(s.moving.x+s.moving.w/2+result.dx,500);
});
test('screen-pixel thresholds remain constant through zoom and touch has a larger capture range',()=>{
 const s=scene([shape('move',100)]);
 near(snapMove(s,-15,0,{grid:false,scale:.5}).dx,-20);near(snapMove(s,-15,0,{grid:false,scale:2}).dx,-15);
 near(snapMove(s,-2,0,{grid:false,scale:.5,pointerType:'touch'}).dx,-20);near(snapMove(s,-2,0,{grid:false,scale:.5,pointerType:'mouse'}).dx,-2);
});
test('hysteresis holds an acquired reference and releases without jitter to a nearer object',()=>{
 const s=scene([shape('move',100),shape('other',90,500)]);
 const first=snapMove(s,-16,0,{grid:false,scale:1}),held=snapMove(s,-12,0,{grid:false,scale:1,previous:first.guides});near(held.dx,-20);
 const released=snapMove(s,-9.5,0,{grid:false,scale:1,previous:held.guides});near(released.dx,-10);assert.equal(released.guides.find(g=>g.axis==='x')!.kind,'object');
});
test('Shift constrains the other axis before snapping and bypass removes every guide',()=>{
 const s=scene([shape('move',170,303),shape('other',500,300)]);
 const result=snapMove(s,60,4,{grid:false,scale:1,constraint:'x'});assert.equal(result.dy,0);assert.ok(result.guides.every(g=>g.axis==='x'));
 assert.deepEqual(snapMove(s,60,4,{grid:false,scale:1,constraint:'x',enabled:false}),{dx:60,dy:0,guides:[]});
});
test('hidden and transparent objects do not attract; visible locked references remain usable',()=>{
 const s=scene([shape('move',100),shape('hidden',90,300,100,80,{hidden:true}),shape('transparent',90,300,100,80,{opacity:0}),shape('locked',300,300,100,80,{locked:true})]);
 assert.deepEqual(s.references.flatMap(r=>r.ids),['locked']);const result=snapMove(s,98,0,{grid:false,scale:1});near(result.dx,100);assert.ok(result.guides.some(g=>g.ids.includes('locked')));
});
test('selected locked members are excluded from movement and cannot become self-snap references',()=>{
 const s=scene([shape('move',100),shape('locked',700,300,100,80,{locked:true})],['move','locked']);assert.equal(s.moving.x,100);assert.equal(s.references.length,0);
});
test('rotated reference geometry aligns against the actual transformed visible edge',()=>{
 const target=shape('target',400,300,120,40,{rotation:45}),s=scene([shape('move',320),target]),b=selectionBounds([target])!;
 const result=snapMove(s,b.x-420+3,0,{grid:false,scale:1});near(420+result.dx,b.x);
});
test('column edges and centres use the configured margin and gutter geometry',()=>{
 const slide=blankSlide();slide.elements=[shape('move',100)];slide.layout={margins:{top:60,right:120,bottom:60,left:80},columns:4,gutter:20};const page={width:1000,height:700};
 const s=createSnapScene(page,slide,['move'])!,second=80+205;const result=snapMove(s,second-100+3,0,{grid:false,scale:1});near(100+result.dx,second);assert.equal(result.guides.find(g=>g.axis==='x')!.kind,'column');
});
test('equal spacing snaps between neighbours and annotates both actual equal gaps',()=>{
 const result=snapMove(scene([shape('left',100),shape('right',500),shape('move',303)]),0,0,{grid:false,scale:1});near(result.dx,-3);
 const g=result.guides.find(g=>g.kind==='spacing')!;assert.equal(g.label,'Equal spacing 100px');assert.deepEqual(g.segments,[{from:200,to:300},{from:400,to:500}]);
});
test('equal spacing repeats an existing gap after a pair, on either axis',()=>{
 const x=snapMove(scene([shape('left',100),shape('right',300),shape('move',497)]),0,0,{grid:false,scale:1});near(x.dx,3);
 const y=snapMove(scene([shape('first',100,100,80,80),shape('second',100,300,80,80),shape('move',100,497,80,80)]),0,0,{grid:false,scale:1});near(y.dy,3);assert.equal(y.guides.find(g=>g.kind==='spacing')!.label,'Equal spacing 120px');
});
test('corner resizing uses guides while preserving its opposite corner and aspect ratio',()=>{
 const e=shape('move',100,100,100,80),s=scene([e,shape('other',300,300)]);
 const r=snapResize(s,e,97,75,'se',true,{grid:false,scale:1}),b=resizeFromCorner(e,r.dx,r.dy,'se',true);near(b.x,100);near(b.y,100);near(b.w,200);near(b.h,160);assert.ok(r.guides.length);
 const flipped={...e,flipX:true},f=snapResize(s,flipped,97,0,'nw',false,{grid:false,scale:1}),fb=resizeFromCorner(flipped,f.dx,f.dy,'nw');near(fb.x,100);near(fb.w,200);
});
test('side snapping changes only its normal axis and preserves the opposite edge through ratio locks and flips',()=>{
 const e=shape('move',100,100,100,80),s=scene([e,shape('other',300,300)]);
 for(const extra of [{},{flipX:true}]){
  const box={...e,...extra},edge=extra.flipX?'w':'e';
  for(const proportional of [false,true]){
   const r=snapResize(s,box,97,91,edge,proportional,{grid:false,scale:1}),b=resizeFromCorner(box,r.dx,r.dy,edge,proportional);
   near(b.x,100);near(b.w,200);near(b.y+b.h/2,140);near(b.h,proportional?160:80);near(r.dy,0);
   assert.ok(r.guides.some(g=>g.axis==='x'));assert.ok(r.guides.every(g=>g.axis==='x'));
  }
 }
 const r=snapResize(s,e,99,117,'s',false,{grid:false,scale:1}),b=resizeFromCorner(e,r.dx,r.dy,'s');
 near(b.x,100);near(b.w,100);near(b.y,100);near(b.h,200);assert.ok(r.guides.every(g=>g.axis==='y'));
});
test('rotated resizing and minimum-size clamping never produce false alignment guides',()=>{
 const e=shape('move',100,100,100,80),s=scene([e,shape('other',118,300,10,80)]);
 assert.deepEqual(snapResize(s,{...e,rotation:15},97,0,'se',false,{grid:false,scale:1}),{dx:97,dy:0,guides:[]});
 const r=snapResize(s,e,-200,0,'se',false,{grid:false,scale:1});assert.ok(!r.guides.some(g=>g.axis==='x'));assert.equal(resizeFromCorner(e,r.dx,r.dy,'se').w,20);
});
test('4 px fallback refines only the moving axes and never rewrites the gesture baseline',()=>{
 const s=scene([shape('move',173,213,101,81)]),before=structuredClone(s);
 const r=snapMove(s,8.3,0,{scale:1});near(s.moving.x+r.dx,180);near(r.dy,0);
 assert.equal(r.guides.find(g=>g.axis==='x')?.label,'X 180 px');assert.deepEqual(s,before);
 const free=snapMove(s,8.3,5.2,{scale:1,grid:false});near(free.dx,8.3);near(free.dy,5.2);
 assert.deepEqual(snapMove(s,8.3,5.2,{scale:1,enabled:false}),{dx:8.3,dy:5.2,guides:[]});
});
test('object edges and existing equal gaps take priority over nearer 4 px values',()=>{
 const edge=snapMove(scene([shape('move',173,213),shape('target',191,410)]),19,0,{scale:1});near(173+edge.dx,191);assert.equal(edge.guides.find(g=>g.axis==='x')?.kind,'object');
 const gaps=snapMove(scene([shape('left',103),shape('right',509),shape('move',300)]),9,0,{scale:1});near(300+gaps.dx,306);
 assert.equal(gaps.guides.find(g=>g.axis==='x')?.label,'Equal spacing 103px');
});
test('centres align with centres and edges align with edges, without unrelated centre-to-edge attraction',()=>{
 const s=scene([shape('move',218,213),shape('other',173,443,101,81)]),r=snapMove(s,10,0,{scale:1});near(218+r.dx,228);assert.equal(r.guides.find(g=>g.axis==='x')?.kind,'grid');
 const page=snapMove(scene([shape('move',400,213)]),98,0,{scale:1});near(400+page.dx,500);assert.equal(page.guides.find(g=>g.axis==='x')?.kind,'grid');
});
test('neighbour gaps snap to 4 px values even when the neighbour starts off grid',()=>{
 const s=scene([shape('left',103,213),shape('move',218,213)]);
 const r=snapMove(s,10,0,{scale:1}),g=r.guides.find(g=>g.kind==='gap')!;
 near(218+r.dx,227);assert.equal(g.label,'Gap 24 px');assert.deepEqual(g.segments,[{from:203,to:227}]);
 const before=snapMove(scene([shape('right',303,213),shape('move',178,213)]),-10,0,{scale:1});near(178+before.dx,167);assert.equal(before.guides.find(g=>g.kind==='gap')?.label,'Gap 36 px');
 const vertical=snapMove(scene([shape('top',213,103,80,80),shape('move',213,198,80,80)]),0,10,{scale:1});near(198+vertical.dy,207);assert.equal(vertical.guides.find(g=>g.kind==='gap')?.label,'Gap 24 px');
});
test('only the nearest visible row neighbour attracts a gap; hidden and overlapping objects do not',()=>{
 const s=scene([shape('far',103,213),shape('nearest',209,213,20,80,{locked:true}),shape('hidden',247,213,20,80,{hidden:true}),shape('move',244,213)]);
 const r=snapMove(s,10,0,{scale:1});assert.ok(r.guides.find(g=>g.kind==='gap')?.ids.includes('nearest'));
 const overlap=snapMove(scene([shape('overlap',200,213),shape('move',244,213)]),10,0,{scale:1});assert.ok(!overlap.guides.some(g=>g.kind==='gap'));
});
test('dense grid hysteresis is capped and does not hold several cells at low zoom',()=>{
 const s=scene([shape('move',173,213)]),first=snapMove(s,7.1,0,{scale:.25});near(173+first.dx,180);
 const held=snapMove(s,9.5,0,{scale:.25,previous:first.guides});near(173+held.dx,180);
 const released=snapMove(s,10.1,0,{scale:.25,previous:held.guides});near(173+released.dx,184);
 const zoomed=snapMove(s,8.8,0,{scale:4});near(zoomed.dx,8.8);assert.ok(!zoomed.guides.some(g=>g.axis==='x'));
});
test('gap feedback holds a value through small pointer fluctuations and releases to the next increment',()=>{
 const s=scene([shape('left',103,213),shape('move',218,213)]),first=snapMove(s,10,0,{scale:1});
 const held=snapMove(s,11.5,0,{scale:1,previous:first.guides});near(218+held.dx,227);
 const released=snapMove(s,12.5,0,{scale:1,previous:held.guides});near(218+released.dx,231);assert.equal(released.guides.find(g=>g.kind==='gap')?.label,'Gap 28 px');
});
test('small 4 px and 8 px gaps remain reachable within enlarged touch and zoomed-out edge tolerance',()=>{
 const s=scene([shape('left',103,213),shape('move',218,213),shape('other',173,443,101,81)]);
 for(const [dx,gap,x] of [[-10,4,207],[-6,8,211],[10,24,227],[30,44,247]]){
  const r=snapMove(s,dx,0,{scale:.35,pointerType:'touch'});near(218+r.dx,x);assert.equal(r.guides.find(g=>g.axis==='x')?.label,`Gap ${gap} px`);
 }
 const close=snapMove(s,-14,0,{scale:.35,pointerType:'touch'});near(218+close.dx,203);assert.equal(close.guides.find(g=>g.axis==='x')?.kind,'object');
});
test('4 px resizing targets dimensions rather than page coordinates, including flipped corners',()=>{
 const e=shape('move',173,213,101,81),s=scene([e]);
 for(const [corner,extra,dx,dy] of [['se',{},10,10],['nw',{},-10,-10],['nw',{flipX:true,flipY:true},10,10]] as const){
  const moving={...e,...extra},r=snapResize(s,moving,dx,dy,corner,false,{scale:1}),b=resizeFromCorner(moving,r.dx,r.dy,corner);
  near(b.w,112);near(b.h,92);assert.equal(r.guides.find(g=>g.axis==='x')?.label,'W 112 px');assert.equal(r.guides.find(g=>g.axis==='y')?.label,'H 92 px');
  const sx=(corner.endsWith('e')?1:-1)*(moving.flipX?-1:1),sy=(corner.startsWith('s')?1:-1)*(moving.flipY?-1:1);
  near(b.x+(sx===-1?b.w:0),e.x+(sx===-1?e.w:0));near(b.y+(sy===-1?b.h:0),e.y+(sy===-1?e.h:0));
 }
});
test('proportional resize preserves ratio, minimum size and stationary dimensions',()=>{
 const e=shape('move',173,213,101,81),s=scene([e]),r=snapResize(s,e,10,2,'se',true,{scale:1}),b=resizeFromCorner(e,r.dx,r.dy,'se',true);
 near(b.w,112);near(b.w/b.h,e.w/e.h);assert.equal(r.guides.filter(g=>g.kind==='grid').length,1);
 const straight=snapResize(s,e,10,0,'se',false,{scale:1}),sb=resizeFromCorner(e,straight.dx,straight.dy,'se');near(sb.h,81);
 const min=snapResize(s,e,-300,0,'se',false,{scale:1}),mb=resizeFromCorner(e,min.dx,min.dy,'se');near(mb.w,20);assert.ok(!min.guides.some(g=>g.axis==='x'&&g.value!==mb.x+mb.w));
});
test('Shift-constrained touch movement keeps 4 px feedback on its active axis',()=>{
 const s=scene([shape('move',173,213)]),r=snapMove(s,10,6,{scale:.5,pointerType:'touch',constraint:'x'});near(173+r.dx,184);near(r.dy,0);assert.ok(r.guides.every(g=>g.axis==='x'));
});
test('numeric stepping reaches the next 4 px multiple in either direction without rejecting custom values',()=>{
 for(const [v,up,down] of [[23,24,20],[24,28,20],[23.5,24,20],[-23,-20,-24],[-24,-20,-28],[0,4,-4]]){near(nextIncrement(v,1),up);near(nextIncrement(v,-1),down);}
});
test('a nearby row supplies its exact gap to either side of the current neighbour',()=>{
 const reference=[shape('a',103,100),shape('b',234.5,100)];
 for(const [neighborX,movingX,desired] of [[500,668,671.5],[600,471,468.5]]){
  const s=scene([...reference,shape('neighbor',neighborX,300,140),shape('move',movingX)]),before=structuredClone(s);
  const result=snapMove(s,0,0,{scale:1}),guide=result.guides.find(g=>g.axis==='x')!;
  near(movingX+result.dx,desired);assert.equal(guide.label,'Match spacing 31.5px');
  assert.deepEqual([...guide.ids].sort(),['a','b','neighbor']);
  assert.equal(guide.segments?.length,2);assert.equal(guide.segments?.[0].reference,true);
  for(const segment of guide.segments!)near(segment.to-segment.from,31.5);
  assert.notEqual(guide.value,guide.segments?.[0].at);assert.deepEqual(s,before);
 }
});
test('nearby column gaps can be reused vertically without moving their source',()=>{
 const s=scene([shape('a',100,103,80,100),shape('b',100,234.5,80,100),shape('neighbor',300,500,80,140),shape('move',300,668,80,100)]);
 const r=snapMove(s,0,0,{scale:1}),g=r.guides.find(g=>g.axis==='y')!;
 near(668+r.dy,671.5);assert.equal(g.label,'Match spacing 31.5px');assert.equal(g.segments?.[0].reference,true);
});
test('matching spacing holds through fluctuations and releases at the screen-pixel boundary',()=>{
 const s=scene([shape('a',103,100),shape('b',234.5,100),shape('neighbor',500,300,140),shape('move',668)]);
 const first=snapMove(s,0,0,{scale:1,grid:false});near(668+first.dx,671.5);
 const held=snapMove(s,11,0,{scale:1,grid:false,previous:first.guides});near(668+held.dx,671.5);
 const released=snapMove(s,13,0,{scale:1,grid:false,previous:held.guides});near(released.dx,13);assert.ok(!released.guides.some(g=>g.axis==='x'));
 assert.deepEqual(snapMove(s,11,0,{scale:1,enabled:false,previous:held.guides}),{dx:11,dy:0,guides:[]});
});
test('gap matching uses screen tolerance, supports touch and honours spacing and grid preferences independently',()=>{
 const s=scene([shape('a',103,100),shape('b',234.5,100),shape('neighbor',500,300,140),shape('move',662)]);
 near(snapMove(s,0,0,{scale:1,grid:false}).dx,0);
 for(const options of [{scale:1,pointerType:'touch'},{scale:.5},{scale:1,constraint:'x' as const}]){
  const r=snapMove(s,options.constraint?5:0,options.constraint?20:0,{grid:false,...options});near(662+r.dx,671.5);if(options.constraint)near(r.dy,0);
 }
 assert.ok(!snapMove(s,5,0,{scale:1,spacing:false,grid:false}).guides.some(g=>g.kind==='spacing'));
});
test('spacing ignores enclosing backgrounds and finds neighbours despite interleaved rows',()=>{
 const s=scene([shape('background',0,0,1000,700),shape('a',100,300,100,200),shape('interleaved',250,450,30,40),shape('b',300),shape('move',497)]);
 const r=snapMove(s,0,0,{scale:1,grid:false}),g=r.guides.find(g=>g.axis==='x')!;
 near(r.dx,3);assert.equal(g.kind,'spacing');assert.equal(g.label,'Equal spacing 100px');assert.ok(!g.ids.includes('background'));assert.ok(!g.ids.includes('interleaved'));
});
test('only unobstructed reference and destination gaps attract; tiny row overlaps and distant rows do not',()=>{
 for(const reference of [
  [shape('a',103,100),shape('b',303,100),shape('block',233,100,20)],
  [shape('a',103,100),shape('b',303,179)],
  [shape('a',103,-300),shape('b',303,-300)],
 ]){
  const r=snapMove(scene([...reference,shape('neighbor',300),shape('move',497)]),0,0,{scale:1,grid:false});near(r.dx,0);assert.ok(!r.guides.some(g=>g.axis==='x'&&g.kind==='spacing'));
 }
 const r=snapMove(scene([shape('a',103,100),shape('b',234.5,100),shape('neighbor',500,300,140),shape('block',660,300,6),shape('move',668)]),0,0,{scale:1,grid:false});assert.ok(!r.guides.some(g=>g.axis==='x'&&g.kind==='spacing'));assert.ok(668+r.dx>=666);
});
test('hidden sources do not offer gaps and grouped neighbours use their visible outer edges',()=>{
 const hidden=snapMove(scene([shape('a',103,100),shape('b',234.5,100,100,80,{hidden:true}),shape('neighbor',500,300,140),shape('move',668)]),0,0,{scale:1,grid:false});near(hidden.dx,0);
 const grouped=scene([shape('a',103,100),shape('b',234.5,100),shape('g1',500,300,60,80,{group:'g'}),shape('g2',580,300,60,80,{group:'g'}),shape('move',668)]);
 const r=snapMove(grouped,0,0,{scale:1,grid:false});near(668+r.dx,671.5);assert.ok(r.guides.some(g=>g.ids.includes('g1')&&g.ids.includes('g2')));
});
test('paired distance guides follow the final position when both axes snap in the same frame',()=>{
 const s=scene([shape('a',103,100),shape('b',234.5,100),shape('neighbor',500,300,140,40),shape('move',668,306)]);
 const r=snapMove(s,0,-3,{scale:1,grid:false});near(668+r.dx,671.5);near(306+r.dy,300);
 const g=r.guides.find(g=>g.axis==='x')!;near(g.value,392);near(g.segments![0].at!,192);
});

test('nested unselected groups provide one outer reference and partial selections never snap to themselves',()=>{
 const slide=blankSlide();slide.groups=[{id:'root',name:'Reference'},{id:'child',name:'Nested',parent:'root'},{id:'moving',name:'Moving'}];
 slide.elements=[shape('a',350,250,60,80,{group:'child'}),shape('b',450,250,80,80,{group:'root'}),shape('move',100,300,100,80,{group:'moving'}),shape('sibling',230,300,40,80,{group:'moving'})];
 const s=createSnapScene({width:1000,height:700},slide,['move'],['move'],'@leaves')!;
 const ref=s.references.find(r=>r.ids.includes('a'))!;assert.deepEqual(ref.ids,['a','b']);assert.equal(ref.box.w,180);assert.equal(s.moving.w,100);
 assert.ok(s.references.some(r=>r.ids.length===1&&r.ids[0]==='sibling'));assert.ok(s.references.every(r=>!r.ids.includes('move')));
});
test('multi-selection moves as one visible frame while retaining its internal gaps',()=>{
 const s=scene([shape('a',120,140,140,96),shape('b',284,140,140,96),shape('neighbor',120,380,220,120),shape('m1',400,380,100,120),shape('m2',530,380,60,120)],['m1','m2']);
 const r=snapMove(s,-32,0,{scale:1,grid:false});near(s.moving.x+r.dx,364);assert.equal(s.moving.w,190);
 assert.ok(r.guides.some(g=>g.kind==='spacing'));assert.ok(r.guides.every(g=>!g.ids.some(id=>['m1','m2'].includes(id))));
 const positions=[400+r.dx,530+r.dx];near(positions[1]-positions[0]-100,30);
});
test('resize matches both neighbouring dimensions and reports two real measurements per dimension',()=>{
 const e=shape('move',100,100),s=scene([e,shape('ref',350,200,180,120)]),before=structuredClone(s);
 const r=snapResize(s,e,77,37,'se',false,{scale:1,grid:false}),b=resizeFromCorner(e,r.dx,r.dy,'se');
 near(b.w,180);near(b.h,120);near(b.x,100);near(b.y,100);assert.deepEqual(s,before);
 for(const [axis,value] of [['x',180],['y',120]] as const){const g=r.guides.find(g=>g.axis===axis)!;assert.equal(g.kind,'size');assert.equal(g.value,value);assert.equal(g.measures?.length,2);assert.equal(g.measures?.[0].reference,true);assert.equal(g.measures?.[1].reference,false);for(const m of g.measures!)near(Math.hypot(m.to.x-m.from.x,m.to.y-m.from.y),value);}
});
test('proportional corner and side resize may be driven by a nearby height while retaining their anchors',()=>{
 const e=shape('move',100,100),s=scene([e,shape('ref',400,240,220,120)]);
 for(const [corner,dx,dy] of [['se',48,35],['e',47,999]] as const){
  const r=snapResize(s,e,dx,dy,corner,true,{scale:1,grid:false}),b=resizeFromCorner(e,r.dx,r.dy,corner,true);near(b.w,150);near(b.h,120);near(b.x,100);near(corner==='e'?b.y+b.h/2:b.y,corner==='e'?140:100);assert.ok(r.guides.some(g=>g.kind==='size'&&g.axis==='y'));
 }
});
test('compatible proportional width and height matches share one scale rather than distorting the object',()=>{
 const e=shape('move',100,100),s=scene([e,shape('ref',350,240,150,120)]),r=snapResize(s,e,48,35,'se',true,{scale:1,grid:false}),b=resizeFromCorner(e,r.dx,r.dy,'se',true);
 near(b.w,150);near(b.h,120);near(b.w/b.h,e.w/e.h);assert.equal(r.guides.filter(g=>g.kind==='size').length,2);
});
test('flipped and rotated resizing matches local dimensions without moving the opposite corner',()=>{
 for(const extra of [{flipX:true,flipY:true},{rotation:30},{rotation:135,flipX:true}]){
  const e=shape('move',100,100,100,80,extra),a=e.rotation*Math.PI/180,c=Math.cos(a),sine=Math.sin(a),fx=e.flipX?-1:1,fy=e.flipY?-1:1;
  const dx=c*fx*77-sine*fy*37,dy=sine*fx*77+c*fy*37;
  const r=snapResize(scene([e,shape('ref',350,240,180,120,{rotation:-20})]),e,dx,dy,'se',false,{scale:1,grid:false}),b=resizeFromCorner(e,r.dx,r.dy,'se');near(b.w,180);near(b.h,120);
  const from=resizeHandlePoint(e,'nw'),to=resizeHandlePoint({...e,...b},'nw');near(from.x,to.x);near(from.y,to.y);
  assert.ok(r.guides.some(g=>g.kind==='size'));for(const g of r.guides.filter(g=>g.kind==='size'))for(const m of g.measures!)near(Math.hypot(m.to.x-m.from.x,m.to.y-m.from.y),g.value);
 }
});
test('same-size hysteresis holds and releases in screen pixels and remains bypassable',()=>{
 const e=shape('move',100,100),s=scene([e,shape('ref',350,200,181.5,120)]),first=snapResize(s,e,79,0,'e',false,{scale:1,grid:false});near(resizeFromCorner(e,first.dx,first.dy,'e').w,181.5);
 const held=snapResize(s,e,89,0,'e',false,{scale:1,grid:false,previous:first.guides});near(resizeFromCorner(e,held.dx,held.dy,'e').w,181.5);
 const released=snapResize(s,e,92,0,'e',false,{scale:1,grid:false,previous:held.guides});near(released.dx,92);assert.ok(!released.guides.some(g=>g.kind==='size'));
 assert.deepEqual(snapResize(s,e,79,0,'e',false,{scale:1,enabled:false,previous:held.guides}),{dx:79,dy:0,guides:[]});
 near(snapResize(s,e,76.5,0,'e',false,{scale:2,grid:false}).dx,76.5);near(snapResize(s,e,76.5,0,'e',false,{scale:.5,grid:false}).dx,81.5);
 near(snapResize(s,e,71.5,0,'e',false,{scale:1,pointerType:'touch',grid:false}).dx,81.5);
});
test('single-axis resize does not change a stationary dimension to match a neighbour',()=>{
 const e=shape('move',100,100),s=scene([e,shape('ref',350,200,180,84)]),r=snapResize(s,e,77,0,'e',false,{scale:1,grid:false}),b=resizeFromCorner(e,r.dx,r.dy,'e');near(b.w,180);near(b.h,80);assert.ok(r.guides.every(g=>g.axis==='x'));
});
test('hidden, transparent and distant objects cannot attract size matches',()=>{
 const e=shape('move',100,100);
 for(const ref of [shape('ref',350,200,180,120,{hidden:true}),shape('ref',350,200,180,120,{opacity:0}),shape('ref',850,580,180,120)]){
  const r=snapResize(scene([e,ref]),e,77,37,'se',false,{scale:1,grid:false});assert.ok(!r.guides.some(g=>g.kind==='size'));
 }
});
test('size snapping respects the exact group member limits used by the transaction preview',()=>{
 const e=shape('move',100,100),members=[element('text',{id:'text',w:100,h:80,fontSize:400})],s=scene([e,shape('ref',350,240,128,120)]);
 const resize=(dx:number,dy:number)=>resizeSelectionFrame(e,members,dx,dy,'e',false);
 const r=snapResize(s,e,28,0,'e',false,{scale:1,grid:false,resize});near(resize(r.dx,r.dy).w,125);assert.ok(!r.guides.some(g=>g.kind==='size'));
});

test('multiple padded layout frames snap by their combined exterior rather than the first child',()=>{
 const s=blankSlide();s.layout={margins:{top:60,right:120,bottom:60,left:80},columns:1,gutter:24};
 s.elements=[shape('a',420,320,60,40,{group:'one'}),shape('b',620,320,60,40,{group:'two'})];
 const layout=(id:string,x:number)=>({id,name:id,x,y:300,w:150,h:100,direction:'horizontal' as const,columns:1,gap:24,padding:{top:20,right:20,bottom:20,left:20},align:'start' as const,justify:'start' as const,widthMode:'fixed' as const,heightMode:'fixed' as const,order:[id==='one'?'a':'b']});s.autoLayouts=[layout('one',400),layout('two',600)];
 const scene=createSnapScene({width:1000,height:700},s,['a','b'])!;assert.deepEqual(scene.moving,{x:400,y:300,w:350,h:100});assert.equal(scene.references.length,0);
 const r=snapMove(scene,-317,0,{scale:1,grid:false});near(scene.moving.x+r.dx,80);near(420+r.dx,100);
});
test('matching a padded reference group uses its container width rather than a child width',()=>{
 const e=shape('move',100,300),s=blankSlide();s.elements=[e,shape('child',440,320,60,40,{group:'reference'})];s.autoLayouts=[{id:'reference',name:'Reference',x:420,y:300,w:220,h:100,direction:'horizontal',columns:1,gap:24,padding:{top:20,right:20,bottom:20,left:20},align:'start',justify:'start',widthMode:'fixed',heightMode:'fixed',order:['child']}];
 const r=snapResize(createSnapScene({width:1000,height:700},s,['move'],['move'],'move')!,e,117,0,'e',false,{scale:1,grid:false});near(resizeFromCorner(e,r.dx,r.dy,'e').w,220);assert.ok(r.guides.some(g=>g.kind==='size'&&g.value===220));
});
