import {authoredTemplateDeck} from './helpers/authored-template';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIONS,LAYOUTS,templateDeck,templateLibraryDeck,createLayout,createTemplatePages,deckTemplateCollection,type CollectionId,type LayoutId} from '../src/core/templates';
import {PROFESSIONAL_LAYOUTS} from '../src/core/template-professional-blueprints';
import {TEMPLATE_PAGES} from '../src/core/template-blueprints';
import {clickOrders} from '../src/core/motion';
import {applyOperations} from '../src/core/operations';
import {resolveDeckTextSizing,type TextSizeMeasure} from '../src/core/text-layout';

test('six complete stories retain the original pages and added professional tasks without duplicates',()=>{
  assert.equal(COLLECTIONS.length,6);assert.equal(LAYOUTS.length,24+PROFESSIONAL_LAYOUTS.length);
  for(const c of COLLECTIONS){const starter=templateDeck(c.id);assert.equal(starter.slides.length,24);assert.equal(new Set(c.story).size,24);const d=templateLibraryDeck(c.id);assert.equal(d.slides.length,LAYOUTS.length);assert.equal(new Set(c.layouts).size,LAYOUTS.length);assert.ok(d.slides.every(s=>s.title===undefined));
    assert.deepEqual(new Set(c.layouts),new Set(LAYOUTS.map(l=>l.id)));
    for(const [i,s] of d.slides.entries()){assert.ok(TEMPLATE_PAGES[c.id][c.layouts[i]].purpose.length>20);const children=s.autoLayouts!.flatMap(l=>l.order);assert.equal(new Set(children).size,children.length,`${c.id}/${s.title}: each child belongs to one content flow`);}
  }
});
test('older eight and nine-page stories still recover their layout intent after a custom rebrand',()=>{
  const stories:Partial<Record<CollectionId,LayoutId[]>>={portfolio:['cover','facts','statement','split','before-after','process','evidence','close'],review:['cover','facts','split','process','before-after','metrics','roadmap','close'],proposal:['cover','statement','facts','split','quote','process','evidence','close'],pitch:['cover','statement','split','metrics','before-after','process','roadmap','facts','close'],report:['cover','facts','metrics','table','before-after','quote','roadmap','close']};
  for(const c of COLLECTIONS.filter(c=>c.id!=='minimal')){const d=authoredTemplateDeck(c.id);d.slides.forEach((s,i)=>s.title=TEMPLATE_PAGES[c.id][c.legacyLayouts![i]].name);d.slides=stories[c.id]!.map(id=>d.slides[c.legacyLayouts!.indexOf(id)]);delete d.templateCollection;d.designSystem!.name='Custom brand';const before=JSON.stringify(d);assert.equal(deckTemplateCollection(d),c.id);assert.equal(JSON.stringify(d),before);}
});
test('new staged insights, solutions and milestones keep complete points together',()=>{
  for(const c of COLLECTIONS){const d=authoredTemplateDeck(c.id);for(const id of ['insights','solution','timeline'] as const){const s=d.slides[c.legacyLayouts!.indexOf(id)],orders=id==='timeline'?[0,1,2,3]:[0,1,2];assert.deepEqual(clickOrders(s),orders);
    for(const order of orders){const items=s.elements.filter(e=>e.animation?.trigger==='click'&&e.animation.order===order);assert.ok(items.filter(e=>e.type==='text').length>=2);assert.ok(items.every(e=>e.y>=110&&e.y<736));}
  }}
});
test('explicit professional variants retain custom steps and continue overflow without replacing story defaults',()=>{
  const items:[string,string][]=Array.from({length:8},(_,i)=>[`Release step ${i+1}`,`Record the outcome of step ${i+1}.`]);
  const variant=createLayout('process',1,'portfolio',{heading:'Release plan',density:'reading',items:items.slice(0,4)});
  assert.ok(variant.elements.some(e=>e.text==='Release plan'));
  assert.equal(variant.template?.density,'reading');assert.deepEqual(clickOrders(variant),[0,1,2,3]);
  for(const [label,description] of items.slice(0,4))for(const copy of [label,description])assert.ok(variant.elements.some(e=>e.text===copy));
  const pages=createTemplatePages('process',1,'portfolio',{heading:'Release plan',items});
  assert.equal(pages.length,2);assert.equal(new Set(pages.map(s=>s.id)).size,2);
  for(const [label,description] of items)for(const copy of [label,description])assert.equal(pages.flatMap(s=>s.elements).filter(e=>e.text===copy).length,1);
  const authored=createLayout('process');
  assert.ok(authored.elements.find(e=>e.text==='Define')!.y<authored.elements.find(e=>e.text==='Explore')!.y);
});
test('new content flows retain all edited text, undo inputs, and unrelated pages',()=>{
  const measure:TextSizeMeasure=e=>({w:e.w,h:e.text.split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil([...l].length*e.fontSize*.56/e.w)),0)*e.fontSize*e.lineHeight});
  const c=COLLECTIONS.find(c=>c.id==='minimal')!,d=resolveDeckTextSizing(authoredTemplateDeck(c.id),measure),s=d.slides[c.legacyLayouts!.indexOf('insights')],flow=s.autoLayouts!.find(l=>l.name==='Insight 1')!,id=flow.order.at(-1)!,before=JSON.stringify(d);
  const copy='A focused observation that explains the decision and what the team should learn next.';
  const next=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:id,patch:{text:copy}}],d.revision,'manual',measure),updated=next.slides.find(v=>v.id===s.id)!;
  assert.equal(updated.elements.find(e=>e.id===id)!.text,copy);assert.equal(next.revision,d.revision+1);assert.equal(JSON.stringify(d),before);assert.deepEqual(next.slides.filter(v=>v.id!==s.id),d.slides.filter(v=>v.id!==s.id));
  const texts=updated.elements.filter(e=>flow.order.includes(e.id));assert.ok(Math.max(...texts.map(e=>e.y+e.h))<=flow.y+flow.textFitHeight!+.1);assert.ok(texts.every(e=>e.fontSize>=20&&e.maxLines===undefined));
});
