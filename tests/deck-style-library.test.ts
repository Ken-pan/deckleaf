import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_PRESETS, contrastRatio } from '../src/core/deck-design-system';
import { mergeStylePreset, isPresetSelected, saveDeckStyle, readDeckStyleLibrary, removeDeckStyle, DECK_STYLE_LIBRARY_KEY, improveStyleContrast } from '../src/core/deck-style-library';
import { templateDeck } from '../src/core/templates';
import { applyOperations } from '../src/core/operations';

function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
test('color and font presets change only their selected portion and preserve named brands',()=>{
  const current=structuredClone(DESIGN_PRESETS[0]);current.name='Acme';current.pattern.kind='dots';current.typography.body.fontSize=38;current.typography.body.lineHeight=1.6;current.typography.body.letterSpacing=.5;
  const colors=mergeStylePreset(current,DESIGN_PRESETS[1],'colors');assert.deepEqual(colors.colors,DESIGN_PRESETS[1].colors);assert.deepEqual(colors.typography,current.typography);assert.deepEqual(colors.pattern,current.pattern);assert.equal(colors.name,'Acme');
  const fonts=mergeStylePreset(current,DESIGN_PRESETS[1],'fonts');assert.equal(fonts.typography.title.fontFamily,'Manrope');assert.equal(fonts.typography.title.fontWeight,600);assert.equal(fonts.typography.body.fontSize,38);assert.equal(fonts.typography.body.lineHeight,1.6);assert.equal(fonts.typography.body.letterSpacing,.5);assert.deepEqual(fonts.colors,current.colors);assert.equal(fonts.name,'Acme');assert.equal(current.pattern.kind,'dots');
});
test('preset selection follows actual values and does not mistake a renamed or modified style',()=>{
  const current=structuredClone(DESIGN_PRESETS[0]);current.name='My editorial';assert.equal(isPresetSelected(current,DESIGN_PRESETS[0],'all'),true);
  current.colors.accent='#ff0000';assert.equal(isPresetSelected(current,DESIGN_PRESETS[0],'all'),false);assert.equal(isPresetSelected(current,DESIGN_PRESETS[0],'fonts'),true);assert.equal(isPresetSelected(current,DESIGN_PRESETS[0],'colors'),false);
});
test('saved styles persist across documents, update the same name, and remove only their own record',()=>{
  const s=storage(),one=structuredClone(DESIGN_PRESETS[0]);one.name='Acme';let saved=saveDeckStyle(s,[],one);const id=saved[0].id;
  assert.deepEqual(readDeckStyleLibrary(s),saved);one.colors.accent='#123456';saved=saveDeckStyle(s,saved,one);assert.equal(saved.length,1);assert.equal(saved[0].id,id);assert.equal(readDeckStyleLibrary(s)[0].system.colors.accent,'#123456');
  saved=saveDeckStyle(s,saved,DESIGN_PRESETS[1]);saved=removeDeckStyle(s,saved,id);assert.equal(saved.length,1);assert.equal(saved[0].system.name,'Studio');
});
test('invalid or inaccessible libraries preserve stored data and saving invalid styles is rejected',()=>{
  const s=storage();s.setItem(DECK_STYLE_LIBRARY_KEY,'bad json');assert.deepEqual(readDeckStyleLibrary(s),[]);assert.equal(s.getItem(DECK_STYLE_LIBRARY_KEY),'bad json');
  assert.throws(()=>saveDeckStyle(s,[],{...DESIGN_PRESETS[0],name:''}));assert.equal(s.getItem(DECK_STYLE_LIBRARY_KEY),'bad json');
  assert.deepEqual(readDeckStyleLibrary({getItem(){throw Error('blocked');},setItem(){}}),[]);
});
test('contrast repair preserves passing roles and brand colors, including borderline integer RGB values',()=>{
  for(const background of ['#ffffff','#000000','#748495','#ffeeaa','#122638']){
    const original=structuredClone(DESIGN_PRESETS[0]);original.name='Acme';original.colors.background=background;original.colors.ink=background;original.colors.muted=background;original.colors.dark='#ffffff';original.colors.onDark='#eeeeee';
    const next=improveStyleContrast(original);assert.ok(contrastRatio(next.colors.ink,background)>=4.5);assert.ok(contrastRatio(next.colors.muted,background)>=4.5);assert.ok(contrastRatio(next.colors.onDark,next.colors.dark)>=4.5);assert.equal(next.colors.accent,original.colors.accent);assert.equal(next.colors.surface,original.colors.surface);assert.equal(next.name,'Acme');assert.equal(original.colors.ink,background);
  }
  const original=DESIGN_PRESETS[1];assert.deepEqual(improveStyleContrast(original).colors,original.colors);
});
test('unchanged manual properties retain semantic links; actual local changes still override',()=>{
  const deck=templateDeck('portfolio'),slide=deck.slides[0],e=slide.elements.find(e=>e.design?.text==='body')!;
  const same=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{fontSize:e.fontSize,fontFamily:e.fontFamily,fill:e.fill}}]).slides[0].elements.find(v=>v.id===e.id)!;
  assert.equal(same.design?.fill,e.design?.fill);assert.deepEqual(same.design?.overrides??[],e.design?.overrides??[]);
  const casing=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{fill:e.fill.toUpperCase()}}]).slides[0].elements.find(v=>v.id===e.id)!;assert.equal(casing.design?.fill,e.design?.fill);
  const changed=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{fontSize:42,fill:'#ff0000'}}]).slides[0].elements.find(v=>v.id===e.id)!;
  assert.ok(changed.design?.overrides?.includes('fontSize'));assert.equal(changed.design?.fill,undefined);
});
