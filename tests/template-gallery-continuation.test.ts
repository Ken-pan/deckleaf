import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTemplatePages,COLLECTIONS} from '../src/core/templates';
import {newDeck} from '../src/core/model';
import {resolveDeckTextSizing,type TextSizeMeasure} from '../src/core/text-layout';
import {inlineTextLines} from '../src/core/inline-text-width';

const measure:TextSizeMeasure=e=>({w:e.w,h:inlineTextLines(e.text,e.fontSize,e.fontFamily,e.w)*e.fontSize*e.lineHeight});
test('long gallery captions continue at readable size, retain every character and keep each study artwork',()=>{
  const items:[string,string][]=[['Study 1','Compare the visual proportions, material, contrast, hierarchy and evidence before committing to the next design direction. '.repeat(7)],['Study 2','检查版式的视觉层级、图片比例和证据，再确定下一步的设计方向。'.repeat(20)],['Study 3','A caption with a deliberate\nparagraph break. '+ 'VeryLongUnbrokenReference'.repeat(30)]];
  for(const c of COLLECTIONS){
    const original=JSON.stringify(items),pages=createTemplatePages('gallery',1,c.id,{items}),deck=resolveDeckTextSizing(newDeck('Gallery',pages),measure);
    assert.ok(pages.length>items.length);
    for(const [label,body] of items){
      const studies=deck.slides.filter(s=>s.elements.some(e=>e.text===label));
      const actual=studies.map(s=>{const l=s.autoLayouts!.find(l=>l.name==='Visual caption 1')!;return s.elements.find(e=>e.id===l.order[1])!.text;}).join('');
      assert.equal(actual,body);
      if(c.id!=='pitch')assert.equal(new Set(studies.flatMap(s=>s.elements.filter(e=>e.type==='image').map(e=>e.src))).size,1);
    }
    if(c.id!=='pitch')assert.equal(new Set(deck.slides.flatMap(s=>s.elements.filter(e=>e.type==='image').map(e=>e.src))).size,3);
    for(const s of deck.slides)for(const l of s.autoLayouts!.filter(l=>l.name==='Visual caption 1'))for(const e of s.elements.filter(e=>l.order.includes(e.id))){assert.ok(e.fontSize>=24);assert.ok(e.y+e.h<704,`${c.id}: ${e.y+e.h}`);}
    assert.equal(JSON.stringify(items),original);
  }
});
test('short gallery captions retain the normal three-image layout',()=>{
  for(const c of COLLECTIONS){const pages=createTemplatePages('gallery',1,c.id,{items:[['Light','A calm direction.'],['Form','Clear proportions.'],['Space','Room to breathe.']]});assert.equal(pages.length,1);assert.equal(pages[0].autoLayouts!.filter(l=>l.name.startsWith('Visual caption ')).length,3);}
});
