import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DECK_BLOCKS, createDeckBlock, defaultBlockOptions, placeDeckBlock, searchDeckBlocks} from '../src/core/deck-blocks';
import {newDeck, blankSlide, element, validateDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {insertionGeometry} from '../src/core/insertion';
import {applyDeckDesignSystem} from '../src/core/deck-design-system';
import {DEFAULT_DESIGN_SYSTEM} from '../src/core/design-system-schema';

test('every block is an additive, atomic native group across slide sizes and item counts',()=>{
  for(const spec of DECK_BLOCKS)for(const page of [{width:1440,height:810},{width:720,height:405},{width:320,height:568}])for(const count of [spec.min,spec.max]){
    const slide=blankSlide();slide.elements=[element('text',{text:'Protected content',x:12,y:12,w:100,h:50})];
    const deck=newDeck('Blocks',[slide],page.width,page.height),before=JSON.stringify(deck);
    const options=defaultBlockOptions(spec.id);options.items=Array.from({length:count},(_,i)=>({...options.items[i%options.items.length]}));
    const block=createDeckBlock(spec.id,options,deck),geometry=insertionGeometry('block',deck,{x:page.width-1,y:page.height-1},undefined,false,block);
    const placed=placeDeckBlock(block,geometry,slide.id),next=applyOperations(deck,placed.operations,deck.revision);
    validateDeck(next);assert.equal(next.revision,deck.revision+1);assert.equal(JSON.stringify(deck),before);
    assert.deepEqual(next.slides[0].elements[0],slide.elements[0]);assert.equal(next.slides[0].groups?.length,1);
    assert.ok(next.slides[0].elements.slice(1).every(e=>['text','rect','ellipse','line'].includes(e.type)&&e.group===placed.groupId));
    for(const e of next.slides[0].elements.slice(1)){assert.ok(e.x>=0&&e.y>=0&&e.x+e.w<=page.width+.01&&e.y+e.h<=page.height+.01,`${spec.id}: ${e.name} stays inside slide`);}
    const again=placeDeckBlock(block,geometry,slide.id);assert.notEqual(again.groupId,placed.groupId);assert.ok(again.ids.every(id=>!placed.ids.includes(id)));
  }
});
test('drafts are read only; inserted objects remain editable and inherit font and color changes',()=>{
  const slide=blankSlide(),deck=newDeck('Blocks',[slide]);deck.designSystem=DEFAULT_DESIGN_SYSTEM;
  const before=JSON.stringify(deck),options=defaultBlockOptions('architecture');options.items[0].label='Custom client';
  const block=createDeckBlock('architecture',options,deck);assert.equal(JSON.stringify(deck),before);
  const placed=placeDeckBlock(block,{x:20,y:50,w:1000,h:520},slide.id),next=applyOperations(deck,placed.operations);
  const label=next.slides[0].elements.find(e=>e.text==='Custom client')!;
  const edited=applyOperations(next,[{op:'update_element',slideId:slide.id,elementId:label.id,patch:{text:'Edited client'}}]);
  assert.equal(edited.slides[0].elements.find(e=>e.id===label.id)?.text,'Edited client');
  const system=structuredClone(DEFAULT_DESIGN_SYSTEM);system.colors.surface='#f0f0f0';system.typography.body.fontFamily='Inter';
  const styled=applyDeckDesignSystem(edited,system);assert.ok(styled.slides[0].elements.some(e=>e.type==='rect'&&e.fill==='#f0f0f0'));
  assert.ok(styled.slides[0].elements.some(e=>e.type==='text'&&e.fontFamily==='Inter'));assert.deepEqual(edited.slides[0].groups,styled.slides[0].groups);
});
test('placement scales proportionally in all drag directions and fits near page edges',()=>{
  const page={width:1440,height:810},block=createDeckBlock('agenda',defaultBlockOptions('agenda'),page);
  for(const end of [{x:10,y:20},{x:1400,y:20},{x:10,y:800},{x:1800,y:1000}]){
    const g=insertionGeometry('block',page,{x:720,y:400},end,false,block);
    assert.ok(Math.abs(g.w/g.h-block.w/block.h)<.001);assert.ok(g.x>=0&&g.y>=0&&g.x+g.w<=page.width&&g.y+g.h<=page.height);
  }
});
test('search supports familiar English and Chinese terms with category filtering',()=>{
  assert.equal(searchDeckBlocks('架构')[0].id,'architecture');assert.ok(searchDeckBlocks('日程规划').some(b=>b.id==='gantt'));
  assert.equal(searchDeckBlocks('timeline','Planning')[0].id,'timeline');assert.equal(searchDeckBlocks('timeline','Business').length,0);
  assert.equal(searchDeckBlocks('does not exist').length,0);
});
test('invalid content and stale revisions cannot partially add a block',()=>{
  const options=defaultBlockOptions('gantt');options.items[0].meta='6–1';assert.throws(()=>createDeckBlock('gantt',options,{width:1440,height:810}),/end period/);
  options.items[0].meta=`${options.periods+1}–${options.periods+2}`;assert.throws(()=>createDeckBlock('gantt',options,{width:1440,height:810}),/Use periods/);
  const slide=blankSlide(),deck=newDeck('Blocks',[slide]),before=JSON.stringify(deck),block=createDeckBlock('process',defaultBlockOptions('process'),deck);
  const placed=placeDeckBlock(block,{x:0,y:0,w:1000,h:520},slide.id);assert.throws(()=>applyOperations(deck,placed.operations,deck.revision+1));assert.equal(JSON.stringify(deck),before);
  assert.throws(()=>placeDeckBlock(block,{x:0,y:0,w:0,h:520},slide.id));
});
