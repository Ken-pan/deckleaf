import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeckBlock,defaultBlockOptions,placeDeckBlock,updateDeckBlock,currentBlockOptions,DECK_BLOCKS} from '../src/core/deck-blocks';
import {blankSlide,newDeck,element,validateDeck} from '../src/core/model';
import {applyOperations,applyImmutableOperations} from '../src/core/operations';
import {groupBox} from '../src/core/container-tree';

for(const spec of DECK_BLOCKS)test(`${spec.id}: block settings retain native content, style, identity, geometry and deletions`,()=>{
  const slide=blankSlide(),initial=newDeck('Native edits',[slide]),block=createDeckBlock(spec.id,defaultBlockOptions(spec.id),initial,slide);
  const placed=placeDeckBlock(block,{x:180,y:120,w:900,h:block.h*.9},slide.id),saved=applyOperations(initial,placed.operations);
  const label=block.elements.find(e=>block.fields[e.id]?.field==='label')!,detail=block.elements.find(e=>block.fields[e.id]?.field==='detail')!;
  const native=saved.slides[0].elements.find(e=>e.name===label.name&&e.blockItem===label.blockItem)!,deleted=saved.slides[0].elements.find(e=>e.name===detail.name&&e.blockItem===detail.blockItem)!;
  const extra=element('text',{text:'Author addition',x:220,y:130,w:200,h:40,group:placed.groupId});
  const local=applyOperations(saved,[{op:'update_element',slideId:slide.id,elementId:native.id,patch:{text:'Native copy',runs:[{text:'Native copy',fontWeight:700}],italic:true,underline:true,fill:'#a12940',fontSize:17,x:native.x+8,w:native.w+12,opacity:.73,animation:{effect:'fade',duration:300,delay:0,order:2,trigger:'click',easing:'linear'}}},{op:'delete_element',slideId:slide.id,elementId:deleted.id},{op:'add_element',slideId:slide.id,element:extra}]);
  const frame=groupBox(local.slides[0],placed.groupId)!,base=createDeckBlock(spec.id,local.slides[0].groups![0].block!.options,local,local.slides[0],frame,'scaled');
  const options=currentBlockOptions(local.slides[0],placed.groupId,base);assert.equal(options.items[0].label,'Native copy');options.tone='outline';
  const nextBlock=createDeckBlock(spec.id,options,local,local.slides[0],frame,'scaled'),plan=updateDeckBlock(local.slides[0],placed.groupId,nextBlock),next=applyImmutableOperations(local,plan.operations);
  const edited=local.slides[0].elements.find(e=>e.id===native.id)!,after=next.slides[0].elements.find(e=>e.id===native.id)!;
  for(const key of ['text','runs','italic','underline','fill','fontSize','x','w','opacity','animation'] as const)assert.deepEqual(after[key],edited[key],`${spec.id} keeps ${key}`);
  assert.ok(!next.slides[0].elements.some(e=>e.id===deleted.id));assert.deepEqual(next.slides[0].elements.find(e=>e.id===extra.id),extra);
  assert.equal(next.slides[0].groups![0].block!.options.items[0].label,'Native copy');validateDeck(JSON.parse(JSON.stringify(next)));
});

test('Gantt period edits fill omitted labels without invalid sparse arrays',()=>{
  const s=blankSlide(),d=newDeck('Gantt',[s]),b=createDeckBlock('gantt',defaultBlockOptions('gantt'),d,s),p=placeDeckBlock(b,{x:100,y:100,w:b.w,h:b.h},s.id),saved=applyOperations(d,p.operations);
  const header=saved.slides[0].elements.find(e=>e.text==='W6')!,edited=applyOperations(saved,[{op:'update_element',slideId:s.id,elementId:header.id,patch:{text:'Launch'}}]);
  const frame=groupBox(edited.slides[0],p.groupId)!,base=createDeckBlock('gantt',b.group.block!.options,edited,edited.slides[0],frame,'scaled'),options=currentBlockOptions(edited.slides[0],p.groupId,base);
  assert.deepEqual(options.periodLabels,['','','','','','Launch']);assert.doesNotThrow(()=>createDeckBlock('gantt',options,edited,edited.slides[0],frame,'scaled'));
});

test('ungroup removes only the invisible Block sizing frame and keeps authored frames',()=>{
  for(const authored of [false,true]){
    const s=blankSlide(),d=newDeck('Ungroup',[s]),b=createDeckBlock('agenda',defaultBlockOptions('agenda'),d,s),p=placeDeckBlock(b,{x:100,y:100,w:b.w,h:b.h},s.id);let saved=applyOperations(d,p.operations);
    const frame=saved.slides[0].elements.find(e=>e.name==='Block frame')!;
    if(authored)saved=applyOperations(saved,[{op:'update_element',slideId:s.id,elementId:frame.id,patch:{fill:'#ffffff'}}]);
    const original=JSON.stringify(saved),next=applyImmutableOperations(saved,[{op:'remove_group',slideId:s.id,groupId:p.groupId}]);
    assert.equal(next.slides[0].elements.some(e=>e.id===frame.id),authored);assert.equal(JSON.stringify(saved),original);
    assert.ok(next.slides[0].elements.every(e=>!e.group));assert.equal(next.slides[0].elements.length,saved.slides[0].elements.length-(authored?0:1));
  }
});
