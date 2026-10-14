import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {clipboardContent,clipboardSlides,clipboardFormats,pasteOffset,clipboardFonts} from '../src/core/clipboard';
import {readClipboardContent} from '../src/core/clipboard-codec';

function fixture(){const slide=blankSlide();slide.elements=[element('text',{id:'text',text:'Hello <world> 😀',x:100,y:80,w:200,h:40,fontFamily:'Custom'})];const deck=newDeck('Source',[slide]);return{slide,deck,content:clipboardContent(deck,slide,{members:slide.elements,groups:[],layouts:[]})};}
test('multi-slide clipboard keeps page order, flags and pooled source media and rejects malformed batches',()=>{
  const src='data:image/png;base64,'+'A'.repeat(2000),slides=Array.from({length:4},(_,i)=>({...blankSlide(),notes:`Notes ${i}`,hidden:i===2,elements:[element('image',{src})],source:{provider:'Fixture',fidelity:'source-render' as const,render:src,warnings:[]}}));
  const deck=newDeck('Multi clipboard',slides),before=structuredClone(deck),content=clipboardSlides(deck,[slides[2].id,slides[0].id,slides[2].id])!,formats=clipboardFormats(content),wire=JSON.parse(formats.json);
  assert.equal(wire.format,'deck-studio/clipboard/3');assert.equal(wire.assets.length,1);assert.deepEqual(readClipboardContent(formats.json),content);assert.deepEqual(readClipboardContent('',formats.html),content);
  assert.deepEqual(content.slides!.map(s=>s.id),[slides[0].id,slides[2].id]);assert.equal(content.slides![1].hidden,true);assert.equal(formats.text.includes('image'),true);
  assert.deepEqual(deck,before);assert(Object.isFrozen(content.slides![0]));assert.throws(()=>clipboardSlides(deck,['stale']),/no longer exists/);
  for(const malformed of [{...wire,slides:[]},{...wire,slides:[wire.slides[0],wire.slides[0]]},{...wire,references:[{slide:4,element:0,field:'src',asset:0}]}])assert.throws(()=>readClipboardContent(JSON.stringify(malformed)),/invalid/);
});
test('native clipboard carries editable data in HTML and readable text in other applications',()=>{
  const {content}=fixture(),formats=clipboardFormats(content);
  assert.equal(formats.text,'Hello <world> 😀');assert(formats.html.includes('Hello &lt;world&gt; 😀'));
  assert.deepEqual(readClipboardContent('',formats.html),content);assert.deepEqual(readClipboardContent(formats.json),content);
  assert.equal(readClipboardContent('','<b>Ordinary HTML</b>'),undefined);
  assert.throws(()=>readClipboardContent('{"format":"unknown"}'),/invalid/);
});
test('clipboard validates group cycles and layout membership before accepting content',()=>{
  const {content}=fixture();
  for(const invalid of [{...content,groups:[{id:'g',name:'G',parent:'g'}]},{...content,members:[content.members[0],content.members[0]]},{...content,kind:'slide',slide:undefined}])assert.throws(()=>readClipboardContent(JSON.stringify(invalid)),/invalid/);
});
test('a copied nested group and individual members detach unselected parents in the portable payload',()=>{
  const {slide,deck}=fixture();slide.groups=[{id:'parent',name:'Parent'},{id:'child',name:'Child',parent:'parent'}];slide.elements[0].group='child';
  const child=clipboardContent(deck,slide,{members:slide.elements,groups:[slide.groups[1]],layouts:[]});
  assert.equal(child.groups[0].parent,undefined);assert.equal(child.members[0].group,'child');assert.deepEqual(readClipboardContent(JSON.stringify(child)),child);
  const member=clipboardContent(deck,slide,{members:slide.elements,groups:[],layouts:[]});assert.equal(member.members[0].group,undefined);assert.deepEqual(readClipboardContent(JSON.stringify(member)),member);
  assert.equal(slide.groups[1].parent,'parent');assert.equal(slide.elements[0].group,'child');
});
test('imported source crops carry their own render without changing the original',()=>{
  const {slide,deck}=fixture(),crop={left:.1,top:.2,right:.3,bottom:.1};slide.source={provider:'PDF',render:'data:image/png;base64,YQ==',warnings:[],fidelity:'converted'};
  slide.elements=[element('image',{sourceRegion:crop,sourceId:'source-shape'})];
  const c=clipboardContent(deck,slide,{members:slide.elements,groups:[],layouts:[]});
  assert.equal(c.members[0].src,slide.source.render);assert.deepEqual(c.members[0].crop,crop);assert.equal(c.members[0].sourceRegion,undefined);assert.equal(c.members[0].sourceId,'source-shape');assert.deepEqual(slide.elements[0].sourceRegion,crop);
});
test('paste positions preserve relative geometry, support exact placement and stay visible near page edges',()=>{
  const {content}=fixture(),page={width:500,height:300};
  assert.deepEqual(pasteOffset(content.members,[],page,0),{x:0,y:0});
  assert.deepEqual(pasteOffset(content.members,[],page,1),{x:24,y:24});
  assert.deepEqual(pasteOffset(content.members,[],page,3,{inPlace:true}),{x:0,y:0});
  assert.deepEqual(pasteOffset(content.members,[],page,1,{point:{x:260,y:200}}),{x:160,y:120});
  assert.deepEqual(pasteOffset(content.members,[],page,40),{x:200,y:180});
});
test('carried local fonts are registered atomically and conflicting families are renamed only in the copy',()=>{
  const {content,deck}=fixture(),font={family:'Custom',name:'Custom',data:'data:font/woff2;base64,YQ==',weight:'400',style:'normal' as const};const carried={...content,fonts:[font]};deck.fonts=[{...font,data:'data:font/woff2;base64,Yg=='}];
  const result=clipboardFonts(carried,deck),op=result.operations[0];
  assert.equal(op.op,'register_local_font');if(op.op==='register_local_font'){assert.notEqual(op.font.family,'Custom');assert.equal(result.content.members[0].fontFamily,op.font.family);assert.equal(op.font.data,font.data);}
  assert.equal(deck.fonts[0].family,'Custom');assert.equal(content.members[0].fontFamily,'Custom');
  assert.equal(clipboardFonts({...content,fonts:[deck.fonts[0]]},deck).operations.length,0);
});
test('compact clipboard shares repeated media and one slide representation while remaining compatible with legacy copies',()=>{
  const {deck,slide}=fixture(),src='data:image/png;base64,'+'A'.repeat(2000);slide.elements=Array.from({length:12},(_,i)=>element('image',{id:`img-${i}`,src}));
  for(const whole of [false,true]){
    const c=clipboardContent(deck,slide,{members:slide.elements,groups:[],layouts:[]},whole),wire=clipboardFormats(c),packed=JSON.parse(wire.json),restored=readClipboardContent(wire.json)!;
    assert.equal(packed.format,'deck-studio/clipboard/2');assert.equal(packed.assets.length,1);assert(!Object.hasOwn(packed,'members'));assert(wire.json.length<JSON.stringify(c).length*.4);
    assert.deepEqual(restored.members,c.members);if(whole)assert.deepEqual(restored.slide,c.slide);
    assert.deepEqual(readClipboardContent(JSON.stringify(c)),c);
  }
});
test('owned clipboard data and cached encodings cannot be changed through caller-owned objects',()=>{
  const {content,slide}=fixture(),wire=clipboardFormats(content);assert.equal(clipboardFormats(content),wire);
  assert.throws(()=>{content.members[0].text='Changed';},TypeError);assert.equal(slide.elements[0].text,'Hello <world> 😀');
  const parsed=readClipboardContent(wire.json)!;assert.equal(readClipboardContent(wire.json),parsed);assert.equal(readClipboardContent('',wire.html),parsed);assert.equal(readClipboardContent('',wire.html),parsed);assert(Object.isFrozen(parsed.members[0]));
  const mutable={...content,members:[{...content.members[0]}]};const old=clipboardFormats(mutable);mutable.members[0].text='Fresh';const next=clipboardFormats(mutable);assert.notEqual(old.json,next.json);assert.equal(readClipboardContent(next.json)!.members[0].text,'Fresh');
});
test('compact transport rejects invalid media references before any document mutation',()=>{
  const {content}=fixture(),wire=JSON.parse(clipboardFormats(content).json);
  for(const reference of [{slide:0,element:0,field:'src',asset:0},{slide:0,element:4000,field:'src',asset:0},{slide:0,element:-1,field:'render',asset:0}])assert.throws(()=>readClipboardContent(JSON.stringify({...wire,references:[reference]})),/invalid/);
});
test('font alias reuse considers every carried weight and never overwrites an earlier pasted face',()=>{
  const {content,deck}=fixture(),font={family:'Custom',name:'Custom',data:'data:font/woff2;base64,YQ==',weight:'400',style:'normal' as const};
  const bold={...font,weight:'700',data:'data:font/woff2;base64,Yg=='};deck.fonts=[{...font,data:'data:font/woff2;base64,Yw=='},{...font,family:'Custom Copy earlier'},{...bold,family:'Custom Copy earlier',data:'data:font/woff2;base64,ZA=='}];
  const before=JSON.stringify(deck.fonts),result=clipboardFonts({...content,fonts:[font,bold]},deck),families=result.operations.flatMap(op=>op.op==='register_local_font'?[op.font.family]:[]);
  assert.equal(new Set(families).size,1);assert.notEqual(families[0],'Custom Copy earlier');assert.equal(JSON.stringify(deck.fonts),before);assert.equal(result.content.members[0].fontFamily,families[0]);
});
