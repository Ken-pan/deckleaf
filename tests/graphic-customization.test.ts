import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {PNG} from 'pngjs';
import {graphicLibrary,graphicItem,graphicImage} from '../server/deck-graphics';
import {loadResource,searchResources} from '../server/resources';
import {customizeGraphic,normalizeGraphicRecipe,graphicInfo,graphicSearchScore} from '../public/resources/graphic-engine.js';
import {GraphicRecipeSchema} from '../src/core/graphic-recipe';
import {shelfEntry,shelfItem,shelfKey,readShelf,rememberResource} from '../src/core/resource-shelf';
import {resourceElement,resourceBackgroundOperations} from '../src/core/resources';
import {newDeck,blankSlide,validateDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
const pixels=(svg:string|Buffer,width=400)=>PNG.sync.read(new Resvg(svg,{fitTo:{mode:'width',value:width}}).render().asPng()).data;
const alpha=(data:Buffer)=>{let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i];return sum;};

test('graphic settings have bounded canonical values and reject unsupported controls',async()=>{
  assert.deepEqual(GraphicRecipeSchema.parse({}),normalizeGraphicRecipe());
  assert.deepEqual(GraphicRecipeSchema.parse({strength:.666666,rotation:12.222222,scale:1.333333}),normalizeGraphicRecipe({strength:.666666,rotation:12.222222,scale:1.333333}));
  for(const raw of [{strength:0},{strength:Infinity},{scale:3.1},{scale:NaN},{rotation:181},{rotation:-1},{density:2},null,[],false,0,'']){
    assert.throws(()=>GraphicRecipeSchema.parse(raw));assert.throws(()=>normalizeGraphicRecipe(raw));
    await assert.rejects(()=>loadResource('deck-graphics:fine-dots','#123456',false,raw));
    await assert.rejects(()=>graphicImage('deck-graphics:fine-dots','#123456',raw as any));
  }
  await assert.rejects(()=>loadResource('deck-graphics:halftone-corner','#123456',false,{scale:2}));
  await assert.rejects(()=>loadResource('deck-graphics:accent-curved-arrow','#123456',false,{rotation:30}));
  await assert.rejects(()=>loadResource('doodles:reading','#123456',false,{strength:.5}));
});

test('preview, download and import render the same full customized SVG; detail crop stays a preview',async()=>{
  const recipe={strength:.6,scale:1.8,rotation:35},id='deck-graphics:square-grid';
  const imported=await loadResource(id,'#794ed6',false,recipe),preview=await loadResource(id,'#794ed6',true,recipe),detail=await loadResource(id,'#794ed6',true,recipe,true);
  assert.equal(imported.bytes.toString(),preview.bytes.toString());assert.deepEqual(imported.resource.graphicRecipe,recipe);
  assert(imported.bytes.toString().includes('viewBox="0 0 1600 900"'));assert(!detail.bytes.equals(imported.bytes));
  const record=(await graphicLibrary()).find(r=>graphicItem(r).id===id)!;
  const source=await readFile('public/resources/deck-graphics-v1/'+record.file,'utf8');
  assert.deepEqual(pixels(imported.bytes),pixels(customizeGraphic(source,'#794ed6',recipe,true)));
  const standard=await loadResource(id,'#794ed6');assert(!standard.resource.graphicRecipe);assert(!standard.bytes.equals(imported.bytes));
  const again=await loadResource(id,'#794ed6',false,recipe);assert.deepEqual(again.resource.graphicRecipe,recipe);
  const image=pixels(imported.bytes);assert(alpha(image)>1000);
  // All four quadrants have visible ink after rotating/scaling the tile; the outer frame remains filled.
  for(let q=0;q<4;q++){let sum=0;for(let y=(q>>1)*112;y<((q>>1)+1)*112;y++)for(let x=(q%2)*200;x<(q%2+1)*200;x++)sum+=image[(y*400+x)*4+3];assert(sum>500,`Blank quadrant ${q}`);}
});

test('strength scales alpha once without changing ink or nested opacity relationships',async()=>{
  for(const id of ['fine-dots','paper-grain','halftone-fade','accent-curved-arrow']){
    const full=(await graphicImage('deck-graphics:'+id,'#794ed6')).svg;
    const light=(await graphicImage('deck-graphics:'+id,'#794ed6',{strength:.5,scale:1,rotation:0})).svg;
    const a=pixels(full,1600),b=pixels(light,1600),ratio=alpha(b)/alpha(a);assert(ratio>.44&&ratio<.56,`${id}: alpha ratio ${ratio}`);
    let compared=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>20&&b[i+3]>12){for(let c=0;c<3;c++)assert(Math.abs(a[i+c]-b[i+c])<22,`${id}: ink changed`);compared++;}
    assert(compared>10);
  }
});

test('families, compound Chinese search and purpose guidance give predictable local results',async()=>{
  for(const [query,expected] of [['渐变网点','deck-graphics:halftone-fade'],['弯曲箭头','deck-graphics:accent-curved-arrow'],['纸张','deck-graphics:paper-grain']]){
    const result=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',q:query}));assert(result.items.some(i=>i.id===expected),query);
  }
  const halftones=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',q:'网点'}));assert(halftones.items.some(i=>i.id==='deck-graphics:bold-dots'));
  const result=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',family:'marks'}));
  assert(result.items.some(i=>i.id==='deck-graphics:accent-wavy-underline'));assert(result.items.every(i=>graphicInfo(i).family==='marks'));
  assert.equal(result.facets!.families.reduce((sum,f)=>sum+f.count,0),60);assert.equal(result.facets!.families.find(f=>f.id==='marks')!.count,result.total);
  const textures=await searchResources(new URLSearchParams({kind:'illustration',collection:'deck-graphics',q:'texture'}));assert.equal(textures.total,7);assert(textures.items.every(i=>i.category==='texture'||i.id==='deck-graphics:hero-texture'));
  const records=(await graphicLibrary()).map(graphicItem);assert(records.every(i=>i.description&&i.useCases?.length));assert(records.some(i=>Number.isFinite(graphicSearchScore(i,'research'))));
});

test('multiple favorite variants and legacy defaults restore independently; documents keep settings through revisions',async()=>{
  const item=graphicItem((await graphicLibrary())[0]),base={...item,color:'#26362c'},variant={...item,color:'#794ed6',graphicRecipe:{strength:.6,scale:1.5,rotation:45}};
  assert.equal(shelfKey(base),shelfKey({...base,graphicRecipe:normalizeGraphicRecipe()}));assert.notEqual(shelfKey(base),shelfKey(variant));
  const shelves=readShelf(JSON.stringify([shelfEntry(base),shelfEntry(variant),shelfEntry({...base,graphicRecipe:normalizeGraphicRecipe()})]));assert.equal(shelves.length,2);
  const restored=shelfItem(shelves[1]);assert.deepEqual(restored.graphicRecipe,variant.graphicRecipe);assert.equal(restored.color,variant.color);
  const recent=rememberResource(rememberResource([],base),variant);assert.equal(recent.length,2);assert.equal(rememberResource(recent,variant).length,2);
  const data=await loadResource(variant.id,variant.color,false,variant.graphicRecipe),slide=blankSlide(),deck=newDeck('Graphics settings',[slide]);
  const image=resourceElement('data:image/svg+xml;base64,'+data.bytes.toString('base64'),data.resource,1600,900,deck);
  const next=applyOperations(deck,resourceBackgroundOperations(deck,slide.id,image),deck.revision),restoredDeck=validateDeck(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(restoredDeck.slides[0].elements[0].resource!.graphicRecipe,variant.graphicRecipe);assert.equal(deck.slides[0].elements.length,0);
});
