import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeckBlock,defaultBlockOptions,placeDeckBlock,updateDeckBlock,blockFingerprint} from '../src/core/deck-blocks';
import {applyBlockPreset,parseBlockItems,moveBlockItem,duplicateBlockItem,removeBlockItem} from '../src/core/deck-block-presets';
import {blankSlide,newDeck,element,validateDeck} from '../src/core/model';
import {applyOperations,moveElements} from '../src/core/operations';
import {applyDeckDesignSystem,contrastRatio} from '../src/core/deck-design-system';
import {COLLECTIONS,createTemplatePages,templateLibraryDeck} from '../src/core/templates';
import {TEMPLATE_BLOCKS} from '../src/core/template-block-map';
import {seedTemplateInput} from '../src/core/template-input';

test('stored block settings survive save and rebuild atomically in place without changing other objects',()=>{
  const slide=blankSlide(),other=element('text',{text:'Protected authored content',x:12,y:12,w:200,h:40});slide.elements=[other];
  let deck=newDeck('Blocks',[slide]);const options=defaultBlockOptions('agenda');options.tone='outline';options.layout='vertical';
  const placed=placeDeckBlock(createDeckBlock('agenda',options,deck),{x:250,y:160,w:760,h:520},slide.id);deck=applyOperations(deck,placed.operations);
  const reopened=validateDeck(JSON.parse(JSON.stringify(deck)));assert.equal(reopened.slides[0].groups?.[0].block?.options.tone,'outline');
  const before=JSON.stringify(reopened),changed=structuredClone(reopened.slides[0].groups![0].block!.options);changed.items[0].label='Edited meeting';changed.showDetails=false;
  const originalFrame=reopened.slides[0].elements.find(e=>e.name==='Block frame')!;
  const rebuilt=createDeckBlock('agenda',changed,reopened,reopened.slides[0],originalFrame),plan=updateDeckBlock(reopened.slides[0],placed.groupId,rebuilt),next=applyOperations(reopened,plan.operations);
  assert.equal(JSON.stringify(reopened),before);assert.equal(next.revision,reopened.revision+1);assert.deepEqual(next.slides[0].elements[0],other);assert.equal(next.slides[0].groups?.[0].id,placed.groupId);
  assert.ok(next.slides[0].elements.some(e=>e.text==='Edited meeting'));assert.ok(!next.slides[0].elements.some(e=>e.text==='Goals and introductions'));
  const frame=next.slides[0].elements.find(e=>e.name==='Block frame')!;assert.equal(frame.x,250);assert.equal(frame.y,160);assert.equal(frame.w,originalFrame.w);assert.equal(frame.h,originalFrame.h);
  const locked=applyOperations(next,[{op:'update_element',slideId:slide.id,elementId:frame.id,patch:{locked:true}}]);assert.throws(()=>updateDeckBlock(locked.slides[0],placed.groupId,rebuilt),/Unlock/);
});
test('manual object edits are detected while whole-group movement and inherited theme changes are preserved',()=>{
  const slide=blankSlide(),deck=newDeck('Block tracking',[slide]),b=createDeckBlock('architecture',defaultBlockOptions('architecture'),deck);
  const p=placeDeckBlock(b,{x:100,y:160,w:b.w,h:b.h},slide.id),saved=applyOperations(deck,p.operations),recipe=saved.slides[0].groups![0].block!;
  const moved=applyOperations(saved,moveElements(saved,slide.id,p.ids,50,30,p.groupId));assert.equal(blockFingerprint(moved.slides[0].elements),recipe.fingerprint);
  const themed=applyDeckDesignSystem(saved,COLLECTIONS.find(c=>c.id==='pitch')!.system);assert.equal(blockFingerprint(themed.slides[0].elements),recipe.fingerprint);
  const label=saved.slides[0].elements.find(e=>e.text==='Web & mobile')!;
  const edited=applyOperations(saved,[{op:'update_element',slideId:slide.id,elementId:label.id,patch:{text:'Authored client'}}]);assert.notEqual(blockFingerprint(edited.slides[0].elements),recipe.fingerprint);
});
test('scenario changes retain local presentation choices; quoted multiline paste and tree validation remain useful',()=>{
  const options=defaultBlockOptions('agenda');options.tone='outline';options.showDetails=false;
  const workshop=applyBlockPreset('agenda','workshop',options);assert.equal(workshop.items.length,5);assert.equal(workshop.tone,'outline');assert.equal(workshop.showDetails,false);
  const pasted=parseBlockItems('Welcome\t"First line\nSecond line"\t09:00\nReview\tDecide\t10:00','agenda');assert.equal(pasted[0].detail,'First line\nSecond line');
  const invalid=defaultBlockOptions('organization');invalid.items[0].parent=1;invalid.items[1].parent=0;assert.throws(()=>createDeckBlock('organization',invalid,{width:1440,height:810}),/descendants/);
  const gantt=defaultBlockOptions('gantt');gantt.periods=12;gantt.items[0].meta='9–12';const block=createDeckBlock('gantt',gantt,{width:1440,height:810});assert.ok(block.elements.some(e=>e.text==='W12'));
});
test('diagram reordering and duplication preserve relationships including implicit root parents',()=>{
  for(const kind of ['architecture','organization'] as const){
    const options=defaultBlockOptions(kind),original=structuredClone(options.items);
    const moved=moveBlockItem(kind,options.items,0,1);
    assert.deepEqual(options.items,original);assert.equal(moved[1].parent,-1);assert.equal(moved[0].parent,1);
    assert.deepEqual(moved.map(item=>item.parent),kind==='architecture'?[1,-1,0,0,0]:[1,-1,1,1]);
    const duplicate=duplicateBlockItem(kind,moved,0);assert.equal(duplicate[0].parent,2);assert.equal(duplicate[1].parent,2);assert.equal(duplicate[2].parent,-1);
    const removed=removeBlockItem(kind,duplicate,2);assert.equal(removed[0].parent,-1);assert.equal(removed[1].parent,-1);
    for(const items of [moved,duplicate,removed])assert.doesNotThrow(()=>createDeckBlock(kind,{...options,items},{width:1440,height:810}));
  }
  const options=applyBlockPreset('architecture','platform',defaultBlockOptions('architecture'));
  assert.equal(options.items[0].parent,-1);assert.equal(moveBlockItem('architecture',options.items,0,1)[1].parent,-1);
});
test('all relevant template pages offer the correct stored native component and collection typography',()=>{
  for(const c of COLLECTIONS){
    const deck=templateLibraryDeck(c.id);validateDeck(deck);
    for(const [id,kind] of Object.entries(TEMPLATE_BLOCKS)){
      const pages=createTemplatePages(id as any,1,c.id,{block:{}}),s=pages[0],group=s.groups!.find(g=>g.block)!;
      assert.equal(group.block?.kind,kind,`${c.id}/${id}`);assert.ok(s.elements.some(e=>e.group===group.id));
      for(const e of s.elements.filter(e=>e.group===group.id&&e.type==='text'))assert.equal(e.fontFamily,c.system.typography[e.design!.text!].fontFamily,`${c.id}/${id}/${e.text}`);
      if(id==='hierarchy'){const items=group.block!.options.items;assert.equal(items[4].parent,1);assert.equal(items[5].parent,2);}
      const seed=seedTemplateInput(c.id,id,s);assert.ok(seed.items.includes(group.block!.options.items[0].label));
    }
    const comparison=createTemplatePages('comparison',1,c.id)[0];assert.ok(comparison.elements.some(e=>e.type==='table'));assert.ok(!comparison.groups?.some(g=>g.block?.kind==='comparison'));
  }
});
test('templates preserve supplied dates, complete metrics and theme contrast through continuations',()=>{
  for(const c of COLLECTIONS){
    const items:[string,string][]=Array.from({length:7},(_,i)=>[`Custom metric ${i}`,`${80+i}%\nTarget ${90+i}%\nCohort ${i}`]);
    const pages=createTemplatePages('dashboard',1,c.id,{items,block:{tone:'accent'}}),text=pages.flatMap(s=>s.elements.filter(e=>e.type==='text').map(e=>e.text));
    for(const [label,body] of items){assert.equal(text.filter(v=>v===label).length,1);for(const line of body.split('\n'))assert.equal(text.filter(v=>v===line).length,1);}
    for(const page of pages){const group=page.groups!.find(g=>g.block)!;for(const e of page.elements.filter(e=>e.group===group.id&&e.type==='text'&&e.design?.fill!=='accent'))assert.ok(contrastRatio(e.fill,c.system.colors.accent)>=4.5,`${c.id} accent text contrast`);}
    const milestones=Array.from({length:7},(_,i)=>[`Release ${i}`,'Output'] as [string,string]),dates=milestones.map((_,i)=>`Date ${i}`),timeline=createTemplatePages('timeline',1,c.id,{items:milestones,dates});
    for(const date of dates)assert.equal(timeline.flatMap(s=>s.elements).filter(e=>e.text===date).length,1);
  }
});
