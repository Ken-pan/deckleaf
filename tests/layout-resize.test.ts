import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,type GroupLayout} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {resolveSlideTextSizing} from '../src/core/text-layout';
import {layoutHandleAxes,layoutResizeAxes,resizedLayoutFrame,resizeLayout,layoutResizePreview} from '../src/core/layout-resize';
import {scaleSelection,selectionFrame} from '../src/core/selection-transform';

const rule=(id:string,order:string[],patch:Partial<GroupLayout>={}):GroupLayout=>({id,name:id,x:100,y:100,w:400,h:180,direction:'horizontal',gap:20,padding:{top:20,right:20,bottom:20,left:20},align:'start',justify:'start',columns:2,widthMode:'fixed',heightMode:'fixed',order,...patch});
function fixture(){
  const s=blankSlide();s.id='s';s.groups=[{id:'flow',name:'Flow'}];
  s.elements=[element('rect',{id:'a',group:'flow',x:120,y:120,w:100,h:60,strokeWidth:2,radius:8}),element('text',{id:'b',group:'flow',x:240,y:120,w:140,h:60,text:'Readable text',fontSize:24,textSizing:'fixed',runs:[{text:'Readable text',fontSize:18}],padding:{top:6,right:6,bottom:6,left:6}}),element('rect',{id:'hidden',group:'flow',hidden:true,x:80,y:90,w:20,h:20}),element('rect',{id:'outside',x:800,y:500,w:100,h:50})];
  s.autoLayouts=[rule('flow',['a','b','hidden'])];return applyOperations(newDeck('Resize contract',[s]),[{op:'set_group_layout',slideId:'s',layout:s.autoLayouts[0]}]);
}
test('layout frame resizing preserves fixed content, typography, spacing, hidden members and provenance',()=>{
  const d=fixture(),s=d.slides[0],l=s.autoLayouts![0],before=JSON.stringify(d),frame={...l,w:600,h:360};
  const next=applyOperations(d,resizeLayout(s,'flow',frame,{w:true,h:true}));
  assert.equal(JSON.stringify(d),before);assert.equal(next.revision,d.revision+1);
  assert.deepEqual(next.slides[0].elements,s.elements);
  const result=next.slides[0].autoLayouts![0];assert.deepEqual([result.w,result.h,result.gap,result.padding.left],[600,360,20,20]);
  assert.deepEqual(result.order,l.order);assert.deepEqual(next.slides[0].groups,s.groups);
  assert.deepEqual(resolveSlideTextSizing(layoutResizePreview(s,'flow',frame,{w:true,h:true}),d),next.slides[0]);
});
test('Fill and wrapping reflow within a resized frame without proportional text scaling',()=>{
  let d=fixture(),s=d.slides[0];d=applyOperations(d,[{op:'update_element',slideId:'s',elementId:'a',patch:{layoutItem:{widthMode:'fill',heightMode:'fixed'}}}]);s=d.slides[0];
  const next=applyOperations(d,resizeLayout(s,'flow',{...s.autoLayouts![0],w:600},{w:true,h:false}));
  assert.equal(next.slides[0].elements[0].w,s.elements[0].w+200);assert.equal(next.slides[0].elements[1].fontSize,24);assert.equal(next.slides[0].elements[1].w,140);
  d=fixture();s=d.slides[0];d=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:{...s.autoLayouts![0],wrap:true,heightMode:'hug'}}]);s=d.slides[0];
  const wrapped=applyOperations(d,resizeLayout(s,'flow',{...s.autoLayouts![0],w:200},{w:true,h:false})).slides[0];
  assert.equal(wrapped.elements[1].y,200);assert.equal(wrapped.elements[1].fontSize,24);assert.equal(wrapped.autoLayouts![0].heightMode,'hug');assert.equal(wrapped.autoLayouts![0].h,180);
});
test('a side resize sets only the edited axis to Fixed and anchors the opposite edge',()=>{
  const d=fixture(),s=d.slides[0];s.autoLayouts![0].heightMode='hug';const l=s.autoLayouts![0];
  const frame=resizedLayoutFrame(l,-80,99,'w');assert.deepEqual([frame.x,frame.w,frame.y,frame.h],[20,480,100,180]);
  const ops=resizeLayout(s,'flow',frame,layoutHandleAxes('w'));const op=ops.find(o=>o.op==='set_group_layout')!;assert.equal(op.op,'set_group_layout');
  if(op.op==='set_group_layout'){assert.equal(op.layout.widthMode,'fixed');assert.equal(op.layout.heightMode,'hug');}
  const corner=resizedLayoutFrame(l,100,80,'se');assert.deepEqual([corner.w,corner.h],[500,260]);
  const constrained=resizedLayoutFrame(l,100,10,'se',true);assert.equal(constrained.w/constrained.h,l.w/l.h);
  assert.equal(resizedLayoutFrame(l,-10000,0,'e').w,1);
});
test('a nested Fill frame becomes Fixed on the edited axis while the parent keeps placement ownership',()=>{
  let d=fixture(),s=d.slides[0];s.groups!.push({id:'parent',name:'Parent'});s.groups![0]={...s.groups![0],parent:'parent',layoutItem:{widthMode:'fill',heightMode:'fixed'}};
  s.elements.push(element('rect',{id:'sibling',group:'parent',w:80,h:60}));s.autoLayouts!.push(rule('parent',['flow','sibling'],{x:40,y:40,w:800,h:240}));s.autoLayouts![0].heightMode='hug';
  d=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:s.autoLayouts![1]}]);s=d.slides[0];const l=s.autoLayouts!.find(l=>l.id==='flow')!,frame={...l,x:l.x-100,w:400};
  const ops=resizeLayout(s,'flow',frame,{w:true,h:false}),next=applyOperations(d,ops).slides[0],actual=next.autoLayouts!.find(l=>l.id==='flow')!;
  assert.equal(actual.w,400);assert.equal(actual.x,l.x);assert.equal(actual.heightMode,'hug');assert.equal(next.groups!.find(g=>g.id==='flow')!.layoutItem!.widthMode,'fixed');assert.equal(next.elements[1].fontSize,24);
  assert.deepEqual(resolveSlideTextSizing(layoutResizePreview(s,'flow',frame,{w:true,h:false}),d),next);
});
test('locked descendants block frame edits and adaptive grids keep ownership of child height',()=>{
  const d=fixture(),s=d.slides[0];s.elements[2].locked=true;assert.throws(()=>resizeLayout(s,'flow',{...s.autoLayouts![0],w:600},{w:true,h:false}),/Unlock/);
  s.elements[2].locked=false;s.groups!.push({id:'parent',name:'Parent'});s.groups![0].parent='parent';s.autoLayouts!.push(rule('parent',['flow'],{direction:'grid',adaptiveColumns:true}));
  assert.deepEqual(layoutResizeAxes(s,'flow'),{w:true,h:false});assert.throws(()=>resizeLayout(s,'flow',{...s.autoLayouts![0],h:400},{w:false,h:true}),/parent grid/);
});
test('ordinary group scaling still scales content and explicit table styling together',()=>{
  const d=fixture(),s=d.slides[0];delete s.autoLayouts;s.elements.push(element('table',{id:'table',group:'flow',x:120,y:230,w:200,h:100,fontSize:20,cells:[['A','B']],tableStyle:{preset:'grid',padding:12,borderWidth:1.5,headerFill:'#112233'},tableFit:{minimumFontSize:10,padding:12}}));
  const ids=s.elements.filter(e=>e.group==='flow'&&!e.hidden).map(e=>e.id),frame=selectionFrame(s,ids,'flow')!;
  const next=applyOperations(d,scaleSelection(d,'s',ids,frame,{...frame,w:frame.w*2,h:frame.h*2},'flow')).slides[0];
  assert.deepEqual([next.elements[0].w,next.elements[0].strokeWidth,next.elements[0].radius],[200,4,16]);assert.equal(next.elements[1].fontSize,48);assert.equal(next.elements[1].runs![0].fontSize,36);assert.equal(next.elements[1].padding!.left,12);
  const table=next.elements.find(e=>e.id==='table')!;assert.equal(table.tableStyle!.padding,24);assert.equal(table.tableStyle!.borderWidth,3);assert.equal(table.tableStyle!.headerFill,'#112233');assert.equal(table.tableFit!.minimumFontSize,20);assert.deepEqual(table.cells,[['A','B']]);
});
