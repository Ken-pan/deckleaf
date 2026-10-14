import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,validateDeck,type Deck,type GroupLayout} from '../src/core/model';
import {applyOperations,moveElements} from '../src/core/operations';
import {createGroupLayout,groupElements} from '../src/core/group-commands';
import {resolveGroupLayouts} from '../src/core/object-layout';
import {descendants,directMembers,treeSelection} from '../src/core/container-tree';
const rule=(id:string,order:string[],attrs:Partial<GroupLayout>={}):GroupLayout=>({id,name:id,direction:'vertical',gap:10,padding:{top:5,right:5,bottom:5,left:5},align:'start',justify:'start',columns:2,x:100,y:100,w:300,h:200,widthMode:'hug',heightMode:'hug',order,...attrs});
function nested():Deck {
  const slide=blankSlide();slide.id='s';slide.elements=[element('rect',{id:'a',group:'row',x:100,y:100,w:80,h:40}),element('rect',{id:'b',group:'row',x:200,y:100,w:60,h:50}),element('rect',{id:'c',group:'outer',x:100,y:200,w:200,h:30})];
  slide.groups=[{id:'outer',name:'Outer'},{id:'row',name:'Row',parent:'outer'}];slide.autoLayouts=[rule('outer',['row','c']),rule('row',['a','b'],{direction:'horizontal'})];
  return applyOperations(newDeck('Nested',[slide]),[{op:'rename_deck',title:'Nested'},{op:'set_group_layout',slideId:'s',layout:slide.autoLayouts[0]}]);
}
test('nested layout measures children before parent placement, independently of rule storage order',()=>{
  const d=nested(),s=d.slides[0];assert.deepEqual(directMembers(s,'outer').map(e=>e.id),['c','row']);
  assert.deepEqual(s.autoLayouts!.map(l=>[l.id,l.w,l.h]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),[['outer',210,110],['row',160,60]]);
  assert.deepEqual(s.elements.map(e=>[e.x,e.y]),[[110,110],[200,110],[105,175]]);
  assert.equal(resolveGroupLayouts(s),s);assert.deepEqual(treeSelection(s,'a'),['a','b','c']);assert.deepEqual(treeSelection(s,'a',true),['a']);
  const changed=applyOperations(d,[{op:'update_element',slideId:'s',elementId:'a',patch:{h:100}}]);assert.equal(changed.slides[0].elements[2].y,225);assert.equal(changed.slides[0].autoLayouts!.find(l=>l.id==='outer')!.h,160);
});
test('three layers retain layout rules when grouping and lift only one level when ungrouping',()=>{
  const d=nested(),s=d.slides[0],ops=groupElements(s,['a','b'],false,'row',true),next=applyOperations(d,ops),wrapper=next.slides[0].groups!.find(g=>g.id!=='row'&&g.id!=='outer')!;
  assert.equal(wrapper.parent,'outer');assert.equal(next.slides[0].groups!.find(g=>g.id==='row')!.parent,wrapper.id);assert.equal(next.slides[0].autoLayouts!.find(l=>l.id==='row')!.direction,'horizontal');
  const ungroup=applyOperations(next,groupElements(next.slides[0],['a','b'],true,wrapper.id));assert.equal(ungroup.slides[0].groups!.find(g=>g.id==='row')!.parent,'outer');assert.equal(ungroup.slides[0].elements[0].group,'row');assert.equal(ungroup.slides[0].autoLayouts!.length,2);
});
test('a selected complete child container becomes a sibling item without flattening its contents',()=>{
  const d=nested(),ops=createGroupLayout(d.slides[0],['a','b','c'],'outer');assert.equal(ops.length,0);
  const plain=applyOperations(d,[{op:'remove_group_layout',slideId:'s',groupId:'outer'}]);const next=applyOperations(plain,createGroupLayout(plain.slides[0],['a','b','c'],'outer'));
  assert(next.slides[0].autoLayouts!.find(l=>l.id==='outer')!.order.includes('row'));assert.equal(next.slides[0].elements[0].group,'row');
});
test('parent Fill propagates width through a nested container before text Hug height is measured',()=>{
  const d=nested(),s=d.slides[0];s.elements[0]=element('text',{...s.elements[0],type:'text',text:'Long content',textSizing:'auto-height',layoutItem:{widthMode:'fill',heightMode:'fixed'}});s.groups![1].layoutItem={widthMode:'fill',heightMode:'fixed'};s.autoLayouts=s.autoLayouts!.map(l=>l.id==='row'?{...l,direction:'vertical'}:{...l,widthMode:'fixed',w:400});
  const measure=(e:any)=>({w:e.w,h:e.w<200?120:40});const result=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:s.autoLayouts!.find(l=>l.id==='outer')!}],d.revision,'manual',measure),slide=result.slides[0];
  assert.equal(slide.autoLayouts!.find(l=>l.id==='row')!.w,390);assert.equal(slide.elements[0].w,380);assert.equal(slide.elements[0].h,40);assert.equal(slide.elements[2].y,225);
  const stable=resolveGroupLayouts(slide,false,e=>({...e,...measure(e)}));assert.deepEqual(stable,slide);
});
test('moving nested containers reorders in the parent, whole-root movement translates every descendant',()=>{
  const d=nested(),moved=applyOperations(d,moveElements(d,'s',['a','b','c'],20,30,'outer'));assert.equal(moved.slides[0].autoLayouts!.find(l=>l.id==='outer')!.x,120);assert.equal(moved.slides[0].autoLayouts!.find(l=>l.id==='row')!.x,125);assert.equal(moved.slides[0].elements[0].y,140);
  const reordered=applyOperations(d,moveElements(d,'s',['a','b'],0,200,'row'));assert.deepEqual(reordered.slides[0].autoLayouts!.find(l=>l.id==='outer')!.order,['c','row']);assert.deepEqual(reordered.slides[0].elements.map(e=>e.id),['a','b','c']);
});
test('cycles, duplicate group IDs and indirect locked descendants reject atomically',()=>{
  const d=nested(),frozen=JSON.stringify(d);assert.throws(()=>applyOperations(d,[{op:'rename_deck',title:'Bad'},{op:'set_group',slideId:'s',group:{id:'outer',name:'Outer',parent:'row'}}]),/ancestors/);assert.equal(JSON.stringify(d),frozen);
  const broken=structuredClone(d);broken.slides[0].groups!.push({...broken.slides[0].groups![0]});assert.throws(()=>validateDeck(broken),/Duplicate group/);
  const locked=applyOperations(d,[{op:'update_element',slideId:'s',elementId:'c',patch:{locked:true}}]);assert.throws(()=>applyOperations(locked,[{op:'update_element',slideId:'s',elementId:'a',patch:{h:200}}]),/locked/);assert.throws(()=>groupElements(locked.slides[0],['a','b','c'],true,'outer'),/Unlock/);
});
test('hidden descendants remain in membership and removing the last leaf cleans up all empty ancestors',()=>{
  const d=nested(),hidden=applyOperations(d,[{op:'update_element',slideId:'s',elementId:'a',patch:{hidden:true}},{op:'update_element',slideId:'s',elementId:'b',patch:{hidden:true}}]);assert.equal(hidden.slides[0].elements[2].y,105);assert.deepEqual(hidden.slides[0].autoLayouts!.find(l=>l.id==='outer')!.order,['row','c']);
  const removed=applyOperations(d,d.slides[0].elements.map(e=>({op:'delete_element' as const,slideId:'s',elementId:e.id})));assert(!removed.slides[0].groups);assert(!removed.slides[0].autoLayouts);assert.equal(descendants(removed.slides[0],'outer').length,0);
});
test('grouping inside a parent preserves the replaced sibling slot and reparenting never flattens descendants',()=>{
  const d=nested(),s=d.slides[0],grouped=applyOperations(d,groupElements(s,['a','b'],false,'row',true)),wrapper=grouped.slides[0].groups!.find(g=>!['outer','row'].includes(g.id))!;
  assert.deepEqual(grouped.slides[0].autoLayouts!.find(l=>l.id==='outer')!.order,[wrapper.id,'c']);
  const moved=applyOperations(grouped,[{op:'set_group',slideId:'s',group:{...grouped.slides[0].groups!.find(g=>g.id==='row')!,parent:undefined}}]);
  assert.equal(moved.slides[0].elements[0].group,'row');assert.equal(moved.slides[0].elements[1].group,'row');assert(!moved.slides[0].groups!.some(g=>g.id===wrapper.id));assert.equal(moved.slides[0].autoLayouts!.find(l=>l.id==='row')!.direction,'horizontal');
});
test('Hug and Fill converge across four nested levels and malformed saved cycles fail before layout',()=>{
  const d=nested();let next=d;
  for(let level=0;level<2;level++){const s=next.slides[0],root=s.groups!.find(g=>!g.parent)!;next=applyOperations(next,groupElements(s,s.elements.map(e=>e.id),false,root.id,true));const parent=next.slides[0].groups!.find(g=>!g.parent)!;next=applyOperations(next,createGroupLayout(next.slides[0],next.slides[0].elements.map(e=>e.id),parent.id));}
  assert.equal(next.slides[0].groups!.length,4);assert.equal(next.slides[0].autoLayouts!.length,4);assert.equal(resolveGroupLayouts(next.slides[0]),next.slides[0]);
  const bad=structuredClone(next);bad.slides[0].groups!.find(g=>!g.parent)!.parent='row';assert.throws(()=>validateDeck(bad),/ancestors/);
});
