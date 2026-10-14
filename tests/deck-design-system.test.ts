import { test } from 'node:test';
import {pptxColors} from './helpers/pptx-theme';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { newDeck, blankSlide, element, validateDeck } from '../src/core/model';
import { applyOperations, ProposalSchema } from '../src/core/operations';
import {diffProposal} from '../src/core/proposal-copy';
import { templateDeck, createLayout, embedTemplateArtwork } from '../src/core/templates';
import { applyDeckDesignSystem, bindNativeSlide, DESIGN_PRESETS, styledElement, contrastRatio } from '../src/core/deck-design-system';
import { DEFAULT_DESIGN_SYSTEM, DesignSystemSchema } from '../src/core/design-system-schema';
import { insertedElement } from '../src/core/insertion';
import { buildPptx } from '../src/core/export';
import {ancestorIds} from '../src/core/container-tree';

const studio = () => structuredClone(DESIGN_PRESETS[1]);
test('template decks ship with linked typography and semantic colors',()=>{
  for(const id of ['portfolio','review','proposal']){
    const deck=templateDeck(id);assert.ok(deck.designSystem);assert.ok(deck.slides.every(s=>s.backgroundStyle));
    assert.ok(deck.slides.flatMap(s=>s.elements).filter(e=>e.type==='text').every(e=>e.design?.text));
    const preview=applyDeckDesignSystem(deck,deck.designSystem!);assert.deepEqual(preview,deck);
  }
});
test('one deck style transaction updates all linked slides without changing source revision or content',()=>{
  const deck=templateDeck('portfolio'),before=structuredClone(deck);
  const preview=applyDeckDesignSystem(deck,studio());assert.deepEqual(deck,before);assert.equal(preview.revision,deck.revision);
  const after=applyOperations(deck,[{op:'set_design_system',system:studio()}]);assert.equal(after.revision,deck.revision+1);
  for(const [i,s] of after.slides.entries()){
    assert.equal(s.background,studio().colors[s.backgroundStyle!]);assert.equal(s.notes,deck.slides[i].notes);
    for(const [j,e] of s.elements.entries()){
      assert.equal(e.text,deck.slides[i].elements[j].text);
      const inFlow=[e.id,...ancestorIds(s,e.id)].some(id=>s.autoLayouts?.some(layout=>layout.order.includes(id)));
      // Persistent flows reflow when the chosen font changes; free objects stay put.
      if(!inFlow){assert.ok(Math.abs(e.x-deck.slides[i].elements[j].x)<.001);assert.ok(Math.abs(e.y-deck.slides[i].elements[j].y)<.001);}
      if(e.design?.fill)assert.equal(e.fill,studio().colors[e.design.fill]);
    }
  }
  assert.deepEqual(deck,before);
});
test('local type and color overrides survive theme changes; movement keeps the links',()=>{
  const deck=templateDeck('portfolio'),slide=deck.slides[0];
  // Position overrides belong to a free object; a persistent flow intentionally
  // controls its children's position, independently of their style bindings.
  const e=element('text',{text:'Independent body',x:84,y:500,w:544,h:108,...deck.designSystem!.typography.body,fill:deck.designSystem!.colors.ink,design:{text:'body',fill:'ink',overrides:[]}});slide.elements.push(e);
  const moved=applyOperations(deck,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{x:100}}]);
  assert.deepEqual(moved.slides[0].elements.find(v=>v.id===e.id)!.design,e.design);
  const overridden=applyOperations(moved,[{op:'update_element',slideId:slide.id,elementId:e.id,patch:{fontSize:41,fill:'#ff00ff'}}]);
  const system=studio();system.typography.body.fontFamily='Lora';system.typography.body.fontSize=36;
  const after=applyOperations(overridden,[{op:'set_design_system',system}]),changed=after.slides[0].elements.find(v=>v.id===e.id)!;
  assert.equal(changed.fontSize,41);assert.equal(changed.fill,'#ff00ff');assert.equal(changed.fontFamily,'Lora');assert.equal(changed.x,100);
});
test('locked layers, source renders, provenance, imported styles and images survive native-style adoption',()=>{
  const deck=templateDeck('portfolio');deck.provenance={provider:'Figma',filename:'original.fig'};
  const locked=deck.slides[0].elements[0];locked.locked=true;
  const imported=blankSlide('Imported');imported.background='#abcdef';imported.source={provider:'Figma',render:'data:image/png;base64,aA==',fidelity:'converted',warnings:[]};
  imported.elements=[element('text',{fontFamily:'Manrope',fill:DEFAULT_DESIGN_SYSTEM.colors.ink,text:'Imported'}),element('image',{src:'data:image/png;base64,aA=='})];deck.slides.push(imported);
  const after=applyOperations(deck,[{op:'set_design_system',system:studio(),adopt:true}],deck.revision,'ai');
  assert.deepEqual(after.slides.at(-1),imported);assert.deepEqual(after.slides[0].elements.find(e=>e.id===locked.id),locked);assert.deepEqual(after.provenance,deck.provenance);
});
test('legacy decks can link matching native styles without changing custom fonts or colors',()=>{
  const deck=templateDeck('portfolio');delete deck.designSystem;for(const s of deck.slides){delete s.backgroundStyle;for(const e of s.elements)delete e.design;}
  const custom=element('text',{fontFamily:'Arial',fill:'#ff00ff',text:'Keep this'});deck.slides[0].elements.push(custom);
  const after=applyDeckDesignSystem(deck,studio(),true);assert.ok(after.slides[0].backgroundStyle);assert.ok(after.slides[0].elements.find(e=>e.type==='text')!.design);assert.deepEqual(after.slides[0].elements.at(-1),custom);
});
test('legacy collections recover their native palette and template surfaces link across dark themes',()=>{
  for(const id of ['review','proposal']){
    const deck=templateDeck(id),roles=new Map(deck.slides.flatMap(s=>s.elements).filter(e=>e.type==='rect').map(e=>[e.id,{role:e.design?.fill,fill:e.fill}]));delete deck.designSystem;for(const s of deck.slides){delete s.backgroundStyle;for(const e of s.elements)delete e.design;}
    const next=applyDeckDesignSystem(deck,DESIGN_PRESETS[3],true);
    assert.ok(next.slides.every(s=>s.backgroundStyle));
    for(const e of next.slides.flatMap(s=>s.elements).filter(e=>e.type==='rect'))assert.equal(e.fill,roles.get(e.id)!.role?DESIGN_PRESETS[3].colors[roles.get(e.id)!.role!]:roles.get(e.id)!.fill);
  }
});
test('provenance-only imports do not acquire links during native-style adoption',()=>{
  const deck=newDeck('Broadser import',[{...blankSlide(),elements:[element('text',{text:'Imported'})]}]);deck.provenance={provider:'Broadser'};
  const before=structuredClone(deck.slides),next=applyDeckDesignSystem(deck,studio(),true);assert.deepEqual(next.slides,before);
});
test('rich text keeps emphasis, custom run fonts, and inline colors while linked values change',()=>{
  const e=element('text',{fontSize:32,fill:DEFAULT_DESIGN_SYSTEM.colors.ink,design:{text:'body',fill:'ink'},paragraphs:[{runs:[{text:'One',fontFamily:'Manrope',fontSize:32,color:DEFAULT_DESIGN_SYSTEM.colors.ink},{text:'Two',bold:true,fontFamily:'Georgia',fontSize:20,color:'#ff0000'}],align:'left',spaceBefore:0,spaceAfter:0,indent:0,firstLineIndent:0,lineSpacing:40}]});
  const system=studio();system.typography.body.fontFamily='Lora';system.typography.body.fontSize=40;
  const changed=styledElement(e,system,{width:1440,height:810}),runs=changed.paragraphs![0].runs;
  assert.equal(runs[0].fontFamily,'Lora');assert.equal(runs[0].color,system.colors.ink);assert.equal(runs[0].fontSize,40);
  assert.equal(runs[1].fontFamily,'Georgia');assert.equal(runs[1].fontSize,25);assert.equal(runs[1].color,'#ff0000');assert.equal(runs[1].bold,true);assert.equal(changed.paragraphs![0].lineSpacing,50);
});
test('new text, tables, shapes and layout slides inherit the document system and page scale',()=>{
  const deck=applyDeckDesignSystem(templateDeck('portfolio'),studio());deck.width=720;deck.height=405;
  const e=insertedElement('text',deck,{x:20,y:20,w:150,h:30},'New body');assert.equal(e.fill,studio().colors.ink);assert.equal(e.fontSize,16);assert.equal(e.fontFamily,'Manrope');
  assert.equal(insertedElement('rect',deck,{x:10,y:10,w:100,h:100}).fill,studio().colors.surface);
  const table=insertedElement('table',deck,{x:10,y:10,w:300,h:100});assert.equal(table.fontSize,12);assert.ok(table.design?.text);
  const full=applyDeckDesignSystem(templateDeck('portfolio'),studio()),newSlide=createLayout('cover');
  const after=applyOperations(full,[{op:'add_slide',slide:newSlide}]);assert.equal(after.slides.at(-1)!.background,studio().colors.background);assert.equal(after.slides.at(-1)!.elements.find(e=>e.design?.text==='title')!.fontFamily,'Manrope');
});
test('patterns replace their own background layer and never accumulate or cover unlinked slides',()=>{
  const deck=templateDeck('portfolio'),system=studio();system.pattern.kind='dots';
  const custom=blankSlide();custom.background='#ff00ff';deck.slides.push(custom);
  const dots=applyDeckDesignSystem(deck,system),grid=applyDeckDesignSystem(dots,{...system,pattern:{...system.pattern,kind:'grid'}});
  for(const s of grid.slides.slice(0,-1)){assert.equal(s.elements.filter(e=>e.designPattern).length,1);assert.equal(s.elements[0].designPattern,true);assert.equal(s.elements[0].locked,true);assert.match(atob(s.elements[0].src!.split(',')[1]),/<path/);}
  assert.deepEqual(grid.slides.at(-1),custom);
  const plain=applyDeckDesignSystem(grid,{...system,pattern:{...system.pattern,kind:'none'}});assert.equal(plain.slides.flatMap(s=>s.elements).filter(e=>e.designPattern).length,0);
});
test('custom slide backgrounds detach that background and remove its inherited pattern',()=>{
  const system=studio();system.pattern.kind='grid';const deck=applyDeckDesignSystem(templateDeck('portfolio'),system),s=deck.slides[0];
  const edited=applyOperations(deck,[{op:'update_slide',slideId:s.id,patch:{background:'#ff00ff'}}]);assert.equal(edited.slides[0].backgroundStyle,undefined);assert.ok(!edited.slides[0].elements.some(e=>e.designPattern));
  assert.equal(applyDeckDesignSystem(edited,DEFAULT_DESIGN_SYSTEM).slides[0].background,'#ff00ff');
});
test('invalid or stale style transactions roll back atomically and never mutate defaults',()=>{
  const deck=templateDeck('portfolio'),before=structuredClone(deck),defaults=structuredClone(DEFAULT_DESIGN_SYSTEM);
  assert.throws(()=>applyOperations(deck,[{op:'set_design_system',system:studio()},{op:'delete_element',slideId:deck.slides[0].id,elementId:'missing'}]));
  assert.throws(()=>applyOperations(deck,[{op:'set_design_system',system:studio()}],deck.revision+1,'ai'));
  assert.throws(()=>DesignSystemSchema.parse({...studio(),colors:{...studio().colors,ink:'url(secret)'}}));
  assert.deepEqual(deck,before);assert.deepEqual(DEFAULT_DESIGN_SYSTEM,defaults);
});
test('style links, overrides and pattern layers survive JSON storage and AI proposal review',()=>{
  const system=studio();system.pattern.kind='dots';const deck=applyDeckDesignSystem(templateDeck('portfolio'),system);
  assert.deepEqual(validateDeck(JSON.parse(JSON.stringify(deck))),validateDeck(deck));
  const p=ProposalSchema.parse({baseRevision:deck.revision,summary:'Update deck styles',operations:[{op:'set_design_system',system:DEFAULT_DESIGN_SYSTEM}]});
  assert.equal(diffProposal(deck,p)[0].target,'Document styles');assert.match(diffProposal(deck,p)[0].after,/Editorial/);
  assert.ok(contrastRatio('#000000','#ffffff')===21);assert.ok(contrastRatio('#ffffff','#ffffff')===1);
});
test('PPTX includes the chosen background pattern and resolves its theme fonts/colors',async()=>{
  const deck=templateDeck('portfolio');deck.slides=deck.slides.slice(0,1);const system=studio();system.pattern.kind='grid';const styled=applyDeckDesignSystem(deck,system);
  const zip=await JSZip.loadAsync(await buildPptx(await embedTemplateArtwork(styled,async src=>new Uint8Array(await (await import('node:fs/promises')).readFile(`public${src}`)),async(id,color)=>{const data=await (await import('../server/resources')).loadResource(id,color);return {src:`data:${data.type};base64,${data.bytes.toString('base64')}`,resource:data.resource};}),false,async()=>({w:1440,h:810})));
  const xml=await zip.file('ppt/slides/slide1.xml')!.async('string'),theme=await zip.file('ppt/theme/theme1.xml')!.async('string');
  const colors=pptxColors(xml,theme);assert.ok(colors.has('eef1f5'));assert.ok(colors.has('263649'));
  assert.match(theme,/a:latin typeface="Manrope"/);assert.match(xml,/typeface="(?:Manrope|\+m[nj]-lt)"/);assert.match(xml,/pattern-/);
  const media=Object.values(zip.files).filter(f=>f.name.endsWith('.svg'));assert.ok(media.length>0);assert.match(await media[0].async('string'),/<pattern/);
});
