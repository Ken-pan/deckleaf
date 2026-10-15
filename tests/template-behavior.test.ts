import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {COLLECTIONS,templateDeck,type CollectionId,type LayoutId} from '../src/core/templates';
import {validateDeck} from '../src/core/model';
import {resolveDeckTextSizing,type TextSizeMeasure} from '../src/core/text-layout';
import {applyOperations} from '../src/core/operations';
import {clickOrders,autoEntranceOrders} from '../src/core/motion';
import {matchSmartLayers} from '../src/core/smart-motion';
import {createNextMotionState} from '../src/core/motion-authoring';
import {manualLayoutSizing} from '../src/core/object-layout';
import {columnBounds} from '../src/core/page-layout';

import {authoredTemplateDeck,authoredPageIndex as at} from './helpers/authored-template';
const measure:TextSizeMeasure=e=>({w:e.w,h:e.text.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length*e.fontSize*.56/e.w)),0)*e.fontSize*e.lineHeight});
test('every authored page carries native flows, page guides and intentional playback',()=>{
  for(const c of COLLECTIONS){const d=validateDeck(authoredTemplateDeck(c.id));for(const s of d.slides){
    assert.ok(s.autoLayouts?.length,`${c.id}/${s.title} needs a native content flow`);assert.ok(s.layout);assert.ok(s.transition);assert.ok(s.elements.some(e=>e.animation?.trigger==='auto'));
    for(const image of s.elements.filter(e=>e.resource?.id.startsWith('blue-black:'))){const mount=s.elements.find(e=>e.group===image.group&&e.name==='Illustration mount');assert.ok(mount);assert.deepEqual(mount.animation,image.animation);}
  }}
});
test('editing and narrowing a template flow rewraps content without rewriting artwork or other pages',()=>{
  const deck=resolveDeckTextSizing(authoredTemplateDeck('portfolio'),measure),before=JSON.stringify(deck),s=deck.slides[at('portfolio','evidence')],flow=s.autoLayouts!.find(l=>l.name==='Project showcase introduction')!;
  const description=s.elements.find(e=>e.id===flow.order[1])!,headline=s.elements.find(e=>e.id===flow.order[0])!;
  const next=applyOperations(deck,[{op:'set_group_layout',slideId:s.id,layout:{...flow,w:320}},{op:'update_element',slideId:s.id,elementId:headline.id,patch:{text:'The finished\nwork.'}}],deck.revision,'manual',measure);
  const changed=next.slides[at('portfolio','evidence')],body=changed.elements.find(e=>e.id===description.id)!,title=changed.elements.find(e=>e.id===headline.id)!;
  assert.equal(next.revision,deck.revision+1);assert.ok(title.h>headline.h);assert.ok(body.y>description.y);assert.ok(body.y>=title.y+title.h+12-.01);assert.equal(body.w,320);
  assert.ok(body.y+body.h<deck.height);
  assert.deepEqual(changed.elements.filter(e=>e.type==='image'),s.elements.filter(e=>e.type==='image'));assert.deepEqual(next.slides.filter(v=>v.id!==s.id),deck.slides.filter(v=>v.id!==s.id));assert.equal(JSON.stringify(deck),before);validateDeck(next);
});
test('smart boundaries match only purposeful interface and material continuity',()=>{
  for(const c of COLLECTIONS){const d=authoredTemplateDeck(c.id);for(let i=1;i<d.slides.length;i++)if(d.slides[i].transition?.effect==='smart'){
    const plan=matchSmartLayers(d.slides[i-1],d.slides[i]);assert.equal(plan.issues.length,0);assert.ok(plan.pairs.length,`${c.id}/${i} must have a real shared object`);assert.ok(plan.pairs.every(p=>p.basis==='key'));assert.ok(plan.pairs.some(p=>p.changed.length));
  }}
});
test('grouped points reveal complete stages and automatic offsets serialize independently',()=>{
  const d=authoredTemplateDeck('portfolio'),s=d.slides[at('portfolio','process')];assert.deepEqual(clickOrders(s),[0,1,2]);
  assert.ok(s.elements.filter(e=>e.type==='text'&&e.y>=736).every(e=>!e.animation),'Page numbering stays visible before every cue.');
  for(const image of s.elements.filter(e=>e.type==='image')){const mount=s.elements.find(e=>e.group===image.group&&e.name==='Illustration mount')!;assert.deepEqual(mount.animation,image.animation);assert.equal(image.animation!.trigger,'click');}
  const auto=runInNewContext(`(${autoEntranceOrders.toString()})`,{__name:(fn:Function)=>fn});
  const cover=authoredTemplateDeck('review').slides[0];assert.deepEqual([...auto(cover)],autoEntranceOrders(cover));assert.deepEqual(autoEntranceOrders(cover),[0,1]);
});
test('next motion state retains template nested flows with new object and container identities',()=>{
  const d=resolveDeckTextSizing(authoredTemplateDeck('portfolio'),measure),s=d.slides[at('portfolio','process')],before=JSON.stringify(d),candidate=createNextMotionState(d,s),next=applyOperations(d,candidate.operations,d.revision,'manual',measure),copy=next.slides[at('portfolio','process')+1];
  assert.equal(JSON.stringify(d),before);assert.equal(next.revision,d.revision+1);assert.equal(copy.autoLayouts!.length,s.autoLayouts!.length);assert.equal(copy.groups!.length,s.groups!.length);
  const old=new Set([...s.elements.map(e=>e.id),...s.groups!.map(g=>g.id)]);assert.ok(copy.elements.every(e=>!old.has(e.id)&&!old.has(e.group??'')));assert.ok(copy.autoLayouts!.every(l=>!old.has(l.id)&&l.order.every(id=>!old.has(id))));
  assert.ok(matchSmartLayers(next.slides[at('portfolio','process')],copy).pairs.length);validateDeck(next);
});
test('page grids actually anchor authored reading regions',()=>{
  for(const c of COLLECTIONS){const d=authoredTemplateDeck(c.id);assert.ok(new Set(d.slides.map(s=>JSON.stringify(s.layout))).size>=4);}
  const d=authoredTemplateDeck('portfolio'),s=d.slides[at('portfolio','before-after')],columns=columnBounds(d,s),boxes=s.elements.filter(e=>e.name==='Original sample interface'||e.name==='Updated sample interface').sort((a,b)=>a.x-b.x);
  assert.equal(boxes.length,2);for(const [i,box] of boxes.entries()){const first=columns[i*6],last=columns[i*6+5];assert.ok(Math.abs(box.x-first.x)<.01);assert.ok(Math.abs(box.x+box.w-last.x-last.w)<.01);}
  const quote=authoredTemplateDeck('proposal'),page=quote.slides[at('proposal','quote')];assert.equal(page.autoLayouts!.find(l=>l.name==='Research rationale')!.x,columnBounds(quote,page)[4].x);
});
test('long copy fits complete text and short copy restores the preferred hierarchy',()=>{
  const d=resolveDeckTextSizing(authoredTemplateDeck('report'),measure),s=d.slides[0],flow=s.autoLayouts!.find(l=>l.name==='Report introduction')!,title=s.elements.find(e=>e.id===flow.order[0])!,body=s.elements.find(e=>e.id===flow.order[1])!;
  const copy='Quarterly performance\nand priorities.',description='A review of this quarter’s progress, the supporting evidence, and priorities for the next period.';
  const next=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:title.id,patch:{text:copy}},{op:'update_element',slideId:s.id,elementId:body.id,patch:{text:description}}],d.revision,'manual',measure);
  const texts=next.slides[0].elements.filter(e=>flow.order.includes(e.id));assert.deepEqual(texts.slice(0,2).map(e=>e.text),[copy,description]);assert.ok(texts.at(-1)!.y+texts.at(-1)!.h<=flow.y+flow.textFitHeight!+.1);assert.ok(texts[0].fontSize<title.layoutItem!.basisFontSize!);
  const restored=applyOperations(next,[{op:'update_element',slideId:s.id,elementId:title.id,patch:{text:'Report.'}},{op:'update_element',slideId:s.id,elementId:body.id,patch:{text:'Q4 2026'}}],next.revision,'manual',measure);
  assert.equal(restored.slides[0].elements.find(e=>e.id===title.id)!.fontSize,title.layoutItem!.basisFontSize);
  assert.deepEqual(next.slides[0].elements.filter(e=>e.type==='image'),s.elements.filter(e=>e.type==='image'));
  assert.equal(manualLayoutSizing(title,{fontSize:80}).layoutItem!.basisFontSize,80);
});
test('excessive copy remains complete at the readable limit rather than being clipped',()=>{
  const d=authoredTemplateDeck('portfolio'),s=d.slides[at('portfolio','evidence')],title=s.elements.find(e=>e.name==='The work,')!,copy='A substantial explanation of the evidence. '.repeat(50);
  const next=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:title.id,patch:{text:copy}}],d.revision,'manual',measure),changed=next.slides[at('portfolio','evidence')].elements.find(e=>e.id===title.id)!;
  assert.equal(changed.text,copy);assert.equal(changed.fontSize,36);assert.ok(changed.h>s.autoLayouts!.find(l=>l.order.includes(title.id))!.textFitHeight!);assert.equal(changed.maxLines,undefined);
});
test('the report carries one current-result anchor from overview through detail and comparison',()=>{
  const d=authoredTemplateDeck('report');
  for(const i of [at('report','table'),at('report','before-after')]){const plan=matchSmartLayers(d.slides[i-1],d.slides[i]);assert.equal(d.slides[i].transition!.effect,'smart');assert.equal(plan.pairs.length,1);assert.equal(plan.pairs[0].from.text,'68%');assert.equal(plan.pairs[0].to.text,'68%');assert.ok(plan.pairs[0].changed.length);}
  const detail=d.slides[at('report','table')].elements.find(e=>e.name==='Current result')!;
  assert.ok(detail.y<220,'The detail anchor stays above the comparison rows.');
  assert.ok(d.slides[at('report','table')].elements.filter(e=>e.type==='text'&&e.x<328&&e.y>=250&&e.y<700).every(e=>e.animation?.withTransition===false),'Result context waits for the moving value.');
  const comparison=d.slides[at('report','before-after')].elements.filter(e=>e.type==='text'&&e.y>=298&&e.y<700&&!e.motionKey?.includes('current-result'));
  assert.ok(comparison.every(e=>e.animation?.trigger==='auto'&&e.animation.withTransition===false),'Comparison values enter after the anchor lands.');
  const edited=applyOperations(d,[{op:'update_element',slideId:d.slides[at('report','table')].id,elementId:detail.id,patch:{text:'72%'}}]);
  assert.equal(edited.slides[at('report','table')].elements.find(e=>e.id===detail.id)!.motionKey,detail.motionKey);
});
test('editorial media reveals and dense evidence fades follow the authored hierarchy',()=>{
  for(const id of ['portfolio','proposal'] as const){const d=authoredTemplateDeck(id);assert.ok(d.slides.some(s=>s.elements.some(e=>e.resource?.kind==='photo'&&e.animation?.effect==='reveal')));}
  const studio=authoredTemplateDeck('review').slides[at('review','metrics')].elements.find(e=>e.type==='chart')!;assert.equal(studio.chart!.type,'bar');assert.equal(studio.chart!.showValues,true);assert.equal(studio.animation!.effect,'fade');
  const signal=authoredTemplateDeck('pitch').slides[at('pitch','metrics')].elements.find(e=>e.type==='chart')!;assert.equal(signal.chart!.type,'area');assert.equal(signal.animation!.effect,'reveal');
  const report=authoredTemplateDeck('report').slides[at('report','table')].elements.find(e=>e.type==='table')!;assert.equal(report.animation!.effect,'fade');
});

test('curated starters only use smart transitions with an actual moving shared object',()=>{
 for(const c of COLLECTIONS){const d=templateDeck(c.id);assert.equal(d.slides.length,24);for(let i=0;i<d.slides.length;i++)if(d.slides[i].transition?.effect==='smart'){assert.ok(i>0);const plan=matchSmartLayers(d.slides[i-1],d.slides[i]);assert.equal(plan.issues.length,0);assert.ok(plan.pairs.some(p=>p.basis==='key'&&p.changed.length));}}
});
