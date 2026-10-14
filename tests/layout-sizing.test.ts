import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck,validateDeck,type GroupLayout} from '../src/core/model';
import {applyOperations,moveElements} from '../src/core/operations';
import {diffProposal} from '../src/core/proposal-copy';
import {inferGroupFlow} from '../src/core/group-commands';
import {layoutItemOperations,layoutOverflow} from '../src/core/group-commands';
import {resolveGroupLayouts} from '../src/core/object-layout';
import {resolveDeckTextSizingAsync,resolveSlideTextSizing,type TextSizeMeasure} from '../src/core/text-layout';
import {aiJsonSchema,omitNull} from '../server/ai-schema';
function fixture() {
  const slide=blankSlide();slide.elements=[element('rect',{id:'a',group:'flow',x:0,y:0,w:100,h:40}),element('rect',{id:'b',group:'flow',x:110,y:0,w:100,h:50}),element('rect',{id:'c',group:'flow',x:220,y:0,w:100,h:30})];
  slide.autoLayouts=[{id:'flow',name:'Flow',direction:'horizontal',gap:10,padding:{top:0,right:0,bottom:0,left:0},align:'start',justify:'start',columns:2,x:0,y:0,w:320,h:50,widthMode:'fixed',heightMode:'hug',order:['a','b','c']}];
  return newDeck('Sizing',[slide]);
}
function configure(deck:ReturnType<typeof fixture>,patch:Partial<GroupLayout>) {return applyOperations(deck,[{op:'set_group_layout',slideId:deck.slides[0].id,layout:{...deck.slides[0].autoLayouts![0],...patch}}]);}
test('default inference identifies centered columns and repeated two-column grids',()=>{
  const column=[element('rect',{id:'a',x:10,y:0,w:100,h:40}),element('rect',{id:'b',x:30,y:60,w:60,h:40})];assert.equal(inferGroupFlow(column).direction,'vertical');assert.equal(inferGroupFlow(column).align,'center');assert.equal(inferGroupFlow(column).gap,20);
  const grid=[element('rect',{id:'a',x:0,y:0,w:100,h:50}),element('rect',{id:'b',x:120,y:0,w:100,h:50}),element('rect',{id:'c',x:0,y:80,w:100,h:50}),element('rect',{id:'d',x:120,y:80,w:100,h:50})];const inferred=inferGroupFlow(grid);assert.equal(inferred.direction,'grid');assert.equal(inferred.columns,2);assert.equal(inferred.gap,20);assert.equal(inferred.lineGap,30);assert.deepEqual(inferred.order,['a','b','c','d']);
});
test('wrap uses the fixed inner width and row gap, then unwraps when width grows',()=>{
  const deck=configure(fixture(),{wrap:true,w:210,lineGap:20});assert.deepEqual(deck.slides[0].elements.map(e=>[e.x,e.y]),[[0,0],[110,0],[0,70]]);assert.equal(deck.slides[0].autoLayouts![0].h,100);
  const wider=configure(deck,{w:320});assert.deepEqual(wider.slides[0].elements.map(e=>e.y),[0,0,0]);assert.equal(wider.slides[0].autoLayouts![0].h,50);assert.equal(resolveGroupLayouts(wider.slides[0]),wider.slides[0]);
});
test('Fill shares available space, respects min/max, and fixes a Hug parent without an axis cycle',()=>{
  let deck=configure(fixture(),{widthMode:'hug'}),s=deck.slides[0];deck=applyOperations(deck,layoutItemOperations(s,['a','b'],{widthMode:'fill'}));assert.equal(deck.slides[0].autoLayouts![0].widthMode,'fixed');assert.deepEqual(deck.slides[0].elements.map(e=>e.w),[100,100,100]);
  deck=configure(deck,{w:300});assert.deepEqual(deck.slides[0].elements.map(e=>e.w),[90,90,100]);
  deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{maxWidth:60}));assert.deepEqual(deck.slides[0].elements.map(e=>e.w),[60,120,100]);
  deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{minWidth:110,maxWidth:20000}));assert.deepEqual(deck.slides[0].elements.map(e=>e.w),[110,70,100]);
  assert.deepEqual(validateDeck(JSON.parse(JSON.stringify(deck))),deck);
});
test('text Fill width remeasures content height before placing following column members and saving',async()=>{
  let deck=fixture();deck.slides[0].elements[0]=element('text',{...deck.slides[0].elements[0],type:'text',text:'Long content',textSizing:'auto-width'});
  deck=configure(deck,{direction:'vertical',w:240,heightMode:'hug'});
  const measure:TextSizeMeasure=e=>({w:e.textSizing==='auto-width'?100:e.w,h:e.w<200?100:40});
  deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{widthMode:'fill'}),deck.revision,'manual',measure);assert.equal(deck.slides[0].elements[0].w,240);assert.equal(deck.slides[0].elements[1].y,50);
  const narrower=applyOperations(deck,[{op:'set_group_layout',slideId:deck.slides[0].id,layout:{...deck.slides[0].autoLayouts![0],w:120}}],deck.revision,'manual',measure);assert.equal(narrower.slides[0].elements[0].h,100);assert.equal(narrower.slides[0].elements[1].y,110);
  assert.equal(resolveSlideTextSizing(narrower.slides[0],narrower,measure).elements[1].y,110);assert.equal((await resolveDeckTextSizingAsync(narrower,{measure})).slides[0].elements[1].y,110);
});
test('Wrap with Fill uses stable preferred widths and constrained row height without overlapping rows',()=>{
  let deck=configure(fixture(),{wrap:true,w:210,lineGap:15});deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{widthMode:'fill'}));assert.deepEqual(deck.slides[0].elements.map(e=>[e.x,e.y]),[[0,0],[110,0],[0,65]]);assert.equal(resolveGroupLayouts(deck.slides[0]),deck.slides[0]);
  deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{heightMode:'fill',minHeight:100}));assert.equal(deck.slides[0].elements[0].h,100);assert.equal(deck.slides[0].elements[2].y,115);assert(layoutOverflow(deck.slides[0],deck.slides[0].autoLayouts![0]).height>0);
});
test('grid equal tracks fill the inner width, while content tracks retain authored behavior',()=>{
  let deck=configure(fixture(),{direction:'grid',w:420,gap:20,lineGap:30});assert.deepEqual(deck.slides[0].elements.map(e=>e.x),[0,120,0]);
  deck=configure(deck,{gridSizing:'equal'});assert.deepEqual(deck.slides[0].elements.map(e=>e.x),[0,220,0]);deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{widthMode:'fill'}));assert.equal(deck.slides[0].elements[0].w,200);assert.equal(deck.slides[0].elements[2].y,80);
});
test('grid content tracks remain available with Fill and equal tracks respect member minimum sizes',()=>{
  let deck=configure(fixture(),{direction:'grid',w:420,gap:20});deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{widthMode:'fill'}));assert.notEqual(deck.slides[0].autoLayouts![0].gridSizing,'equal');assert.equal(deck.slides[0].elements[0].w,100);
  deck=configure(deck,{gridSizing:'equal',w:180});assert.equal(deck.slides[0].elements[1].x,120);assert(layoutOverflow(deck.slides[0],deck.slides[0].autoLayouts![0]).width>0);
  deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{minWidth:150}));assert.equal(deck.slides[0].elements[1].x,170);assert.equal(deck.slides[0].elements[0].w,150);
});
test('Spread derives nonnegative spacing without imposing the stored manual gap when space is tight',()=>{
  const deck=configure(fixture(),{w:280,justify:'space-between',gap:80});assert.deepEqual(deck.slides[0].elements.map(e=>e.x),[0,100,200]);assert.equal(layoutOverflow(deck.slides[0],deck.slides[0].autoLayouts![0]).width,20);
  const single=fixture();single.slides[0].elements=single.slides[0].elements.slice(0,1);single.slides[0].autoLayouts![0].order=['a'];const result=configure(single,{justify:'space-between',w:400});assert.equal(result.slides[0].elements[0].x,0);
});
test('manual dimensions switch only the edited Fill axis to Fixed; ungrouping and removing rules clear member sizing',()=>{
  let deck=configure(fixture(),{heightMode:'fixed',h:80});deck=applyOperations(deck,layoutItemOperations(deck.slides[0],['a'],{widthMode:'fill',heightMode:'fill'}));deck=applyOperations(deck,[{op:'update_element',slideId:deck.slides[0].id,elementId:'a',patch:{w:120}}]);assert.equal(deck.slides[0].elements[0].layoutItem!.widthMode,'fixed');assert.equal(deck.slides[0].elements[0].layoutItem!.heightMode,'fill');assert.equal(deck.slides[0].elements[0].w,120);
  const removed=applyOperations(deck,[{op:'remove_group_layout',slideId:deck.slides[0].id,groupId:'flow'}]);assert(removed.slides[0].elements.every(e=>!e.layoutItem));assert.deepEqual(removed.slides[0].elements.map(e=>[e.x,e.y,e.w,e.h]),deck.slides[0].elements.map(e=>[e.x,e.y,e.w,e.h]));
  const detached=applyOperations(deck,[{op:'update_element',slideId:deck.slides[0].id,elementId:'a',patch:{group:undefined}}]);assert(!detached.slides[0].elements[0].layoutItem);
});
test('min/max errors, rotated Fill, and indirect locked resize reject atomically',()=>{
  let deck=fixture();const s=deck.slides[0],before=JSON.stringify(deck);assert.throws(()=>applyOperations(deck,layoutItemOperations(s,['a'],{widthMode:'fill',minWidth:200,maxWidth:100})),/Minimum width/);assert.equal(JSON.stringify(deck),before);
  const rotated=applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:'a',patch:{rotation:30}}]);assert.throws(()=>layoutItemOperations(rotated.slides[0],['a'],{widthMode:'fill'}),/rotation/);
  deck=applyOperations(deck,layoutItemOperations(s,['a'],{widthMode:'fill'}));deck=applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:'a',patch:{locked:true}}]);const locked=JSON.stringify(deck);assert.throws(()=>applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:'b',patch:{w:80}}]),/locked/);assert.equal(JSON.stringify(deck),locked);
});
test('wrapped member drag crosses rows and retains stacking and hidden member slots',()=>{
  let deck=configure(fixture(),{wrap:true,w:210});deck=applyOperations(deck,moveElements(deck,deck.slides[0].id,['a'],150,90));assert.deepEqual(deck.slides[0].autoLayouts![0].order,['b','c','a']);assert.deepEqual(deck.slides[0].elements.map(e=>e.id),['a','b','c']);
});
test('AI reviews describe sizing and wrap; structured outputs require nullable optional layout fields',()=>{
  const deck=fixture(),slideId=deck.slides[0].id,layout={...deck.slides[0].autoLayouts![0],wrap:true,lineGap:20};const review=diffProposal(deck,{baseRevision:0,summary:'Wrap',operations:[{op:'set_group_layout',slideId,layout}]});assert.match(review[0].after,/Wrap to new rows/);assert.match(review[0].after,/Row gap: 20 px/);
  const schema=JSON.stringify(aiJsonSchema);assert(schema.includes('layoutItem'));assert(schema.includes('lineGap'));assert(schema.includes('gridSizing'));assert.deepEqual(omitNull({layout:{wrap:null,lineGap:null,gridSizing:null}}),{layout:{}});
});
