import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {PNG} from 'pngjs';
import {graphicLibrary, graphicItem} from '../server/deck-graphics';
import {searchResources,loadResource} from '../server/resources';
import {newDeck,blankSlide,element} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {resourceBackgroundOperations,resourceElement,isGraphicBackground,resourceCredits} from '../src/core/resources';
import {shelfEntry,readShelf,shelfItem} from '../src/core/resource-shelf';

test('all graphics render visible transparent vectors, recolor, and retain source/license notices',async()=>{
  const records=await graphicLibrary();assert.equal(records.length,60);assert.equal(new Set(records.map(i=>i.id)).size,60);
  const counts=Object.fromEntries(['pattern','texture','accent'].map(c=>[c,records.filter(i=>i.category===c).length]));assert.deepEqual(counts,{pattern:30,texture:6,accent:24});
  for(const record of records){
    const item=graphicItem(record),original=await readFile('public/resources/deck-graphics-v1/'+record.file);
    assert.equal(createHash('sha256').update(original).digest('hex'),record.sha256);
    const data=await loadResource(item.id,'#794ed6');assert.equal(data.type,'image/svg+xml');assert.equal(data.resource.color,'#794ed6');assert(data.resource.licenseNotice?.includes(record.creator!));
    assert.equal(data.resource.sourceUrl,record.sourceUrl);assert.equal(data.resource.attributionRequired,record.provider==='Hero Patterns');
    assert(!data.bytes.toString().includes('#26362c'));assert(data.bytes.toString().includes('#794ed6'));
    const image=PNG.sync.read(new Resvg(data.bytes,{fitTo:{mode:'width',value:320}}).render().asPng());
    let visible=0,clear=0,opaque=0;for(let i=3;i<image.data.length;i+=4){if(image.data[i])visible++;else clear++;if(image.data[i]===255)opaque++;}
    assert(visible>30,`${item.id} is blank`);assert(clear>30,`${item.id} lacks transparent space`);
    if(isGraphicBackground(item.id))assert.equal(opaque,0,`${item.id} should remain subtle behind slide content`);
    if(record.provider==='Hero Patterns'){
      const source=JSON.parse(await readFile('public/resources/deck-graphics-v1/manifest.json','utf8')).items.find((r:any)=>r.id===record.id);
      assert.equal(createHash('sha256').update(await readFile('public/resources/deck-graphics-v1/'+source.originalFile)).digest('hex'),source.originalSha256);
      assert.equal(record.license,'CC BY 4.0');assert(record.licenseNotice?.includes('Adapted by '));assert(data.resource.licenseNotice?.includes(record.licenseNotice!));
    }
  }
  await assert.rejects(()=>loadResource('deck-graphics:../../private','#123456'));
});

test('graphics filter, search, and favorite restoration work without remote services',async()=>{
  const first=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics'}));
  const second=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',page:'2'}));
  assert.equal(first.total,60);assert.equal(first.items.length,48);assert.equal(second.items.length,12);assert(!first.items.some(a=>second.items.some(b=>a.id===b.id)));
  for(const category of ['pattern','texture','accent']){
    const result=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',category}));assert(result.items.length);assert(result.items.every(i=>i.category===category));
  }
  const dots=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',q:'网点'}));assert(dots.items.length>=5);assert(dots.items.some(i=>i.id==='deck-graphics:halftone-fade'));
  const restored=shelfItem(readShelf(JSON.stringify([shelfEntry(first.items[0],'#794ed6')]))[0]);assert.equal(restored.color,'#794ed6');assert(restored.colorable);assert.equal(restored.id,first.items[0].id);
});

test('fill slide is one revision behind existing objects and preserves authored content',async()=>{
  const data=await loadResource('deck-graphics:hero-topography','#123456');
  const slide=blankSlide();slide.elements.push(element('text',{text:'Keep this idea',x:20,y:30,w:310,h:80}),element('rect',{locked:true,x:88,y:99,w:140,h:150}));
  for(const [width,height] of [[1600,900],[900,1600]]){
    const deck=newDeck('Background',[slide],width,height),original=JSON.stringify(deck);
    const image=resourceElement('data:image/svg+xml;base64,'+data.bytes.toString('base64'),data.resource,1600,900,deck);
    const operations=resourceBackgroundOperations(deck,slide.id,image),next=applyOperations(deck,operations,deck.revision);
    const background=next.slides[0].elements[0];assert.equal(next.revision,deck.revision+1);assert.equal(background.id,image.id);
    assert.deepEqual([background.x,background.y,background.w,background.h,background.fit,background.locked],[0,0,width,height,'fill',true]);
    assert.deepEqual(next.slides[0].elements.slice(1),deck.slides[0].elements);assert.equal(JSON.stringify(deck),original);
    assert(resourceCredits(next).includes('Steve Schoger'));assert(resourceCredits(next).includes(data.resource.licenseNotice!));
    assert.throws(()=>applyOperations(next,operations,deck.revision));
    assert.throws(()=>resourceBackgroundOperations(deck,'missing',image));
    assert.throws(()=>resourceBackgroundOperations(deck,slide.id,{...image,resource:{...data.resource,id:'deck-graphics:accent-sparkle'}}));
  }
});
