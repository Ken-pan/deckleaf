import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck} from '../src/core/model';
import {createLayoutCandidate,layoutCandidates,layoutProposal,DEFAULT_LAYOUT_OPTIONS} from '../src/core/auto-layout';
import {applyOperations} from '../src/core/operations';

function document() {
  const s=blankSlide('Evidence'),title=element('text',{name:'Title',text:'A clear point of view',fontFamily:'Bodoni Moda',fontSize:72,x:90,y:140,w:1200,h:110});
  const body=element('text',{name:'正文',text:'Make room for the evidence while keeping the complete story.',fontSize:30,x:100,y:310,w:540,h:130,runs:[{text:'Make room for the evidence ',bold:true,color:'#334455'},{text:'while keeping the complete story.',italic:true,baseline:'normal'}]});
  const image=element('image',{src:'data:image/png;base64,aA==',x:740,y:300,w:570,h:330,fit:'cover',crop:{left:.1,top:0,right:.1,bottom:0}});
  s.elements=[title,body,image];s.notes='Original narration';s.source={provider:'QA',fidelity:'converted',warnings:[],label:'Source'};
  return newDeck('Design controls',[s]);
}
test('modern and editorial directions are explicit choices; source direction preserves authored fonts',()=>{
  const d=document(),s=d.slides[0],before=JSON.stringify(d);
  const source=createLayoutCandidate(d,s.id,'split');assert.equal(source.slide.elements[0].fontFamily,'Bodoni Moda');
  const modern=createLayoutCandidate(d,s.id,'split',{...DEFAULT_LAYOUT_OPTIONS,style:'modern'});
  assert.equal(modern.slide.elements[0].fontFamily,'Manrope');assert.equal(modern.slide.elements[0].fontWeight,600);assert.equal(modern.slide.elements[0].lineHeight,1.08);
  const editorial=createLayoutCandidate(d,s.id,'split',{...DEFAULT_LAYOUT_OPTIONS,style:'editorial'});
  assert.equal(editorial.slide.elements[0].fontFamily,'Bodoni Moda');assert.equal(editorial.slide.elements[0].fontWeight,400);
  for(const c of[modern,editorial]){
    const after=applyOperations(d,layoutProposal(d,[c])!.operations);
    assert.equal(after.slides[0].notes,s.notes);assert.deepEqual(after.slides[0].source,s.source);
    after.slides[0].elements.forEach((e,i)=>{for(const k of['id','type','text','src','fit','crop','fill','group']as const)assert.deepEqual(e[k],s.elements[i][k]);});
    assert.deepEqual(after.slides[0].elements[1].runs?.map(({fontFamily,...rest})=>rest),s.elements[1].runs);
  }
  assert.equal(JSON.stringify(d),before);
});
test('design direction respects locked whole groups, hidden objects and fixed source captions',()=>{
  const d=document(),s=d.slides[0];s.elements[1].group='manual';s.elements[2].group='manual';s.elements[2].locked=true;
  const caption=element('text',{text:'Source caption',fontSize:16,fontFamily:'Custom',x:96,y:750,w:400,h:25});s.elements.push(caption);
  for(const c of layoutCandidates(d,s.id,{...DEFAULT_LAYOUT_OPTIONS,style:'modern'})){
    assert.deepEqual(c.slide.elements.slice(1),s.elements.slice(1));
    assert(!c.operations.some(op=>op.op==='update_element'&&[s.elements[1].id,s.elements[2].id,caption.id].includes(op.elementId)));
  }
});
test('text measurement sees the opted-in typeface before fitting or recommending a layout',()=>{
  const d=document(),seen=new Set<string>();
  const measure=Object.assign((_text:string,e:{fontFamily:string},size:number)=>{seen.add(e.fontFamily);return size*20;},{height:(e:{fontFamily:string},size:number)=>{seen.add(e.fontFamily);return size*1.5;}});
  const c=createLayoutCandidate(d,d.slides[0].id,'split',{...DEFAULT_LAYOUT_OPTIONS,style:'modern'},measure);
  assert.equal(c.issues.length,0);assert.deepEqual([...seen],['Manrope']);
});
test('image and text emphasis change allocation without rewriting evidence or narrowing the user choice',()=>{
  const d=document(),s=d.slides[0];
  const text=createLayoutCandidate(d,s.id,'split',{...DEFAULT_LAYOUT_OPTIONS,emphasis:'text'});
  const image=createLayoutCandidate(d,s.id,'split',{...DEFAULT_LAYOUT_OPTIONS,emphasis:'image'});
  assert(text.slide.elements[1].w>image.slide.elements[1].w);assert(text.slide.elements[2].w<image.slide.elements[2].w);
  assert.equal(image.id,'split');assert.equal(image.slide.elements[1].text,s.elements[1].text);assert.deepEqual(image.slide.elements[2].crop,s.elements[2].crop);
});
test('turning off both type normalization and fitting preserves a large authored title',()=>{
  const d=document(),s=d.slides[0];s.elements=[{...s.elements[0],text:'Original',fontSize:98}];
  const c=createLayoutCandidate(d,s.id,'focus',{...DEFAULT_LAYOUT_OPTIONS,consistentType:false,fitText:false});
  assert.equal(c.slide.elements[0].fontSize,98);assert.equal(c.slide.elements[0].fontFamily,s.elements[0].fontFamily);
});
