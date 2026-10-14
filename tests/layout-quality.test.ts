import{test}from'node:test';import assert from'node:assert/strict';
import{element,blankSlide,newDeck,type SlideElement}from'../src/core/model';
import{curatedLayouts,createLayoutCandidate,DEFAULT_LAYOUT_OPTIONS,layoutProposal}from'../src/core/auto-layout';
import{assessLayout,layoutRegressions,tableHeight}from'../src/core/layout-quality';
const measure=Object.assign((text:string,e:SlideElement,size:number)=>text.length*size*.5,{aspect:()=>1.5});
function document(es:SlideElement[]){const s=blankSlide();s.elements=es;return newDeck('Quality',[s]);}
const title=()=>element('text',{text:'Clear evidence',x:96,y:120,w:1248,h:120,fontSize:60});
test('a deliberate single-title page retains its visual hierarchy instead of moving a smaller title to the top',()=>{
 const d=document([element('text',{text:'Less, but better.',x:200,y:300,w:1040,h:170,fontSize:104,align:'center'})]);
 const r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert.deepEqual(r.suggestions.map(c=>c.id),['original']);assert.deepEqual(r.suggestions[0].slide,d.slides[0]);assert.equal(layoutProposal(d,r.suggestions),null);
});
test('a readable image-led source filters smaller evidence and reduced headline hierarchy',()=>{
 const d=document([element('text',{text:'One clear idea',x:96,y:80,w:1200,h:112,fontSize:84}),element('image',{src:'data:image/png;base64,aA==',x:96,y:215,w:1248,h:500})]);
 const r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert.equal(r.suggestions.length,1);assert(r.rejected.some(c=>c.reasons?.some(x=>/smaller|too small/.test(x))));
});
test('original image annotations cannot become a disconnected legend on the slide',()=>{
 const image=element('image',{src:'data:image/png;base64,aA==',x:96,y:260,w:1248,h:440,fit:'cover'}),label=element('text',{text:'Key detail',x:200,y:345,w:240,h:65,fontSize:30,group:'annotation'}),line=element('line',{x:460,y:400,w:200,h:1,group:'annotation'});
 const d=document([title(),image,label,line]);const r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert(r.rejected.some(c=>c.reasons?.includes('Image annotations are separated from their original position')));
});
test('the baseline uses actual contained image area rather than its letterbox frame',()=>{
 const a=document([element('image',{src:'data:image/png;base64,aA==',x:100,y:200,w:1200,h:200})]),b=structuredClone(a.slides[0]);b.elements[0]={...b.elements[0],x:300,y:200,w:600,h:400};
 const before=assessLayout(a,a.slides[0],measure),after=assessLayout(a,b,measure);assert.equal(before.visuals.get(b.elements[0].id),60000);assert.equal(after.visuals.get(b.elements[0].id),240000);assert(!layoutRegressions(a,before,after).some(x=>/Evidence/.test(x)));
});
test('table allocation expands its usable height and checks all rows instead of shrinking it like a photo',()=>{
 const table=element('table',{x:96,y:275,w:1248,h:240,fontSize:24,cells:[['Feature','Evidence'],...Array.from({length:6},(_,i)=>[`Row ${i+1}`,'Complete source'])]});const d=document([title(),table]);
 const c=createLayoutCandidate(d,d.slides[0].id,'story',DEFAULT_LAYOUT_OPTIONS,measure),after=c.slide.elements[1];assert(after.h>table.h);assert(after.fontSize>=16);assert(tableHeight(after,after.fontSize,after.w,measure)<=after.h+2);
});
test('font styling can preserve original geometry and all protected objects',()=>{
 const d=document([element('text',{text:'Original focal title',x:200,y:300,w:1040,h:170,fontSize:84,fontFamily:'Bodoni Moda'}),element('text',{text:'Protected footer',x:96,y:746,w:1200,h:28,fontSize:16,locked:true})]);const original=JSON.stringify(d);
 const r=curatedLayouts(d,d.slides[0].id,{...DEFAULT_LAYOUT_OPTIONS,style:'modern'},measure),keep=r.suggestions[0];assert.equal(keep.id,'original');assert.equal(keep.slide.elements[0].fontFamily,'Manrope');assert.equal(keep.slide.elements[0].fontSize,84);assert.equal(keep.slide.elements[0].y,300);assert.deepEqual(keep.slide.elements[1],d.slides[0].elements[1]);assert.equal(JSON.stringify(d),original);
});
test('unfittable content yields a safe unchanged baseline while raw unsafe operations remain blocked',()=>{
 const d=document([title(),element('text',{text:'Unabridged content '.repeat(1500),x:96,y:300,w:800,h:300,fontSize:30})]);const r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert.equal(r.suggestions.length,1);assert.equal(r.suggestions[0].operations.length,0);assert.deepEqual(r.suggestions[0].slide,d.slides[0]);assert.equal(layoutProposal(d,r.suggestions),null);assert(r.sourceIssues>0);
});
test('every offered rearrangement meets the original-relative gate and a recommendation always exists',()=>{
 const d=document([title(),element('text',{text:'A complete explanation that sits beside the source evidence.',x:96,y:300,w:600,h:300,fontSize:28}),element('image',{src:'data:image/png;base64,aA==',x:750,y:300,w:570,h:330})]);const before=assessLayout(d,d.slides[0],measure),r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert.equal(r.suggestions.filter(c=>c.recommended).length,1);
 for(const c of r.suggestions.filter(c=>c.id!=='original')){assert.equal(c.issues.length,0);assert.deepEqual(layoutRegressions(d,before,assessLayout(d,c.slide,measure)),[]);}
});
test('a larger picture cannot justify swapping an authored text-left/evidence-right reading order',()=>{
 const d=document([title(),element('text',{text:'The explanation comes first.',x:96,y:300,w:600,h:200,fontSize:28}),element('image',{src:'data:image/png;base64,aA==',x:750,y:290,w:570,h:390})]);const swapped=structuredClone(d.slides[0]);swapped.elements[1].x=750;swapped.elements[1].w=570;swapped.elements[2].x=96;swapped.elements[2].w=600;
 assert(layoutRegressions(d,assessLayout(d,d.slides[0],measure),assessLayout(d,swapped,measure)).includes('The reading order of text and evidence has changed'));
});
test('diagram nodes cannot move away from their original connectors',()=>{
 const node=element('rect',{x:96,y:300,w:280,h:160}),other=element('rect',{x:570,y:300,w:280,h:160}),line=element('line',{x:376,y:380,w:194,h:1,stroke:'#26362c',strokeWidth:3});const d=document([title(),node,other,line]),after=structuredClone(d.slides[0]);after.elements[1].w=398;
 assert(layoutRegressions(d,assessLayout(d,d.slides[0],measure),assessLayout(d,after,measure)).includes('Diagram connections have changed'));
});
