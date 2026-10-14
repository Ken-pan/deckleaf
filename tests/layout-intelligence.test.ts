import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck,type SlideElement} from '../src/core/model';
import {layoutObjectRole} from '../src/core/layout-content';
import {assessLayout,layoutRegressions} from '../src/core/layout-quality';
import {analyzeLayout,createLayoutCandidate,curatedLayouts,DEFAULT_LAYOUT_OPTIONS,layoutProposal,type LayoutCandidate} from '../src/core/auto-layout';
const source='data:image/png;base64,aA==';
const icon={id:'test:icon',kind:'icon' as const,provider:'Local',title:'Icon',creator:'QA',sourceUrl:'https://example.com/icon',license:'CC0',licenseUrl:'https://example.com/license',attribution:'QA',attributionRequired:false};
function document(es:SlideElement[]){const s=blankSlide();s.elements=es;return newDeck('Semantic layout QA',[s]);}
const title=()=>element('text',{name:'标题',text:'Evidence before decoration',x:96,y:120,w:1200,h:120,fontSize:60});
test('small icons, logos, empty data and invisible marks never become main evidence',()=>{
 const es=[element('image',{name:'Icon',src:source,resource:icon,w:64,h:64}),element('image',{name:'Logo',src:source,w:280,h:80}),element('chart',{values:[]}),element('table',{cells:[['',' ']]}),element('rect',{fill:'transparent'}),element('text',{text:'Invisible',opacity:0})],d=document(es);
 assert.equal(analyzeLayout(d,d.slides[0]).units,0);assert.equal(curatedLayouts(d,d.slides[0].id).suggestions.length,1);
 for(const id of ['story','split','grid','focus'] as const)assert.equal(createLayoutCandidate(d,d.slides[0].id,id).operations.length,0);
});
test('large intentional icon art remains content while a plain shape alone is protected',()=>{
 const hero=element('image',{src:source,resource:icon,w:700,h:500}),d=document([hero,element('rect',{x:40,y:40,w:32,h:32})]);
 assert.equal(layoutObjectRole(hero,d),'content');assert.equal(analyzeLayout(d,d.slides[0]).units,1);assert.equal(analyzeLayout(d,d.slides[0]).preserved,1);
});
test('an icon beside genuine evidence stays unchanged and does not affect image allocation',()=>{
 const mark=element('image',{name:'Icon',src:source,resource:icon,x:40,y:40,w:64,h:64}),d=document([title(),element('text',{text:'A clear explanation.',x:96,y:300,w:550,h:160,fontSize:28}),element('image',{src:source,x:700,y:300,w:580,h:330}),mark]);
 const c=createLayoutCandidate(d,d.slides[0].id,'split');assert.equal(c.units,3);assert.deepEqual(c.slide.elements.at(-1),mark);assert(!c.operations.some(o=>o.op==='update_element'&&o.elementId===mark.id));
});
test('a grouped icon remains a supporting mark and cannot grow into hero art',()=>{
 const mark=element('image',{src:source,resource:icon,x:96,y:300,w:64,h:64,group:'label'}),label=element('text',{text:'Supporting point',x:180,y:300,w:260,h:100,fontSize:28,group:'label'}),d=document([title(),mark,label,element('image',{src:source,x:700,y:300,w:500,h:330})]);
 assert.equal(analyzeLayout(d,d.slides[0]).text,2);const c=createLayoutCandidate(d,d.slides[0].id,'grid');assert(c.slide.elements[1].w<=mark.w*1.25+.01);
 assert.throws(()=>layoutProposal(d,[{...c,issues:[],operations:[{op:'update_element',slideId:d.slides[0].id,elementId:mark.id,patch:{w:600,h:600}}]}]),/Decorative elements/);
});
test('rich text without a plain fallback remains actual editable content',()=>{
 const d=document([element('text',{name:'标题',text:'',runs:[{text:'Real rich headline',bold:true}],fontSize:64})]);assert.equal(analyzeLayout(d,d.slides[0]).text,1);
 assert(curatedLayouts(d,d.slides[0].id,{...DEFAULT_LAYOUT_OPTIONS,style:'modern'}).suggestions[0].operations.length);
});
test('a long supporting paragraph is not styled as a bold headline just because it is large',()=>{
 const p=element('text',{text:'Full supporting narrative. '.repeat(12),fontSize:36,fontWeight:400,x:96,y:200,w:1248,h:500}),d=document([p]);const c=curatedLayouts(d,d.slides[0].id,{...DEFAULT_LAYOUT_OPTIONS,style:'modern'}).suggestions[0];assert.equal(c.slide.elements[0].fontWeight,400);assert.equal(c.slide.elements[0].fontSize,36);
});
test('unsupported source-region objects protect their entire existing group',()=>{
 const crop=element('image',{src:source,sourceRegion:{left:.1,top:.1,right:.1,bottom:.1},group:'native'}),label=element('text',{text:'Native shape',group:'native'}),d=document([title(),crop,label]);
 for(const id of ['story','split','grid','focus'] as const){const c=createLayoutCandidate(d,d.slides[0].id,id,{...DEFAULT_LAYOUT_OPTIONS,style:'modern'});assert.deepEqual(c.slide.elements.slice(1),[crop,label]);}
});
test('a nearby caption under a single image follows its image without rewriting groups',()=>{
 const image=element('image',{src:source,x:700,y:290,w:580,h:340}),caption=element('text',{text:'Original image caption',fontSize:20,x:700,y:650,w:580,h:30}),d=document([title(),image,caption]);
 assert.equal(analyzeLayout(d,d.slides[0]).units,2);const c=createLayoutCandidate(d,d.slides[0].id,'split'),a=c.slide.elements[1],b=c.slide.elements[2];assert(b.y>=a.y+a.h);assert(Math.abs((b.y-a.y)/(caption.y-image.y)-a.w/image.w)<.001);assert.equal(b.group,undefined);
});
test('loading or broken evidence yields no new rearrangement, then becomes eligible when ready',()=>{
 const d=document([title(),element('text',{text:'Supporting evidence.',fontSize:28,x:96,y:300,w:550,h:160}),element('image',{src:source,x:750,y:300,w:480,h:300})]);
 let status:'loading'|'failed'|'ready'='loading';const measure=Object.assign((text:string,_e:SlideElement,size:number)=>text.length*size*.5,{aspect:()=>1.5,imageStatus:()=>status});
 for(status of ['loading','failed'] as const){const r=curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure);assert.equal(r.suggestions.length,1);assert.equal(r.unresolvedImages,1);assert(r.rejected.every(c=>c.issues.some(i=>/Image not ready/.test(i.message))));}
 status='ready';assert.equal(curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure).unresolvedImages,0);assert(curatedLayouts(d,d.slides[0].id,DEFAULT_LAYOUT_OPTIONS,measure).suggestions.length>1);
});
test('layout proposal final guard rejects injected objects, source changes and rewritten text',()=>{
 const d=document([title()]),c=createLayoutCandidate(d,d.slides[0].id,'story');
 for(const operation of [{op:'add_element',slideId:d.slides[0].id,element:element('rect')},{op:'update_element',slideId:d.slides[0].id,elementId:d.slides[0].elements[0].id,patch:{text:'Invented claim'}},{op:'update_element',slideId:d.slides[0].id,elementId:d.slides[0].elements[0].id,patch:{crop:{left:0,top:0,right:.1,bottom:0}}}])assert.throws(()=>layoutProposal(d,[{...c,operations:[operation]} as LayoutCandidate]),/Layout suggestions/);
 const rich={...c,operations:[{op:'update_element',slideId:d.slides[0].id,elementId:d.slides[0].elements[0].id,patch:{runs:[{text:'Invented rich claim'}]}}]} as LayoutCandidate;assert.throws(()=>layoutProposal(d,[rich]),/change content/);
});
test('layout transactions cannot change inline emphasis or color while keeping the same words',()=>{
 const d=document([element('text',{text:'Source words',runs:[{text:'Source words',bold:true,color:'#26362c'}]})]),e=d.slides[0].elements[0],c=createLayoutCandidate(d,d.slides[0].id,'story');
 assert.throws(()=>layoutProposal(d,[{...c,operations:[{op:'update_element',slideId:d.slides[0].id,elementId:e.id,patch:{runs:[{text:'Source words',bold:false,color:'#ff0000'}]}}]}]),/change content/);
});
test('an annotation line pointing into an image remains attached even when its label is outside',()=>{
 const image=element('image',{src:source,x:400,y:260,w:800,h:440}),label=element('text',{text:'Detail',group:'annotation',x:200,y:345,w:160,h:65}),line=element('line',{group:'annotation',stroke:'#26362c',strokeWidth:2,x:370,y:400,w:200,h:1}),d=document([title(),image,label,line]);
 const after=structuredClone(d.slides[0]);after.elements[1].x=650;const measure=Object.assign((text:string,_e:SlideElement,size:number)=>text.length*size*.5,{aspect:()=>2});
 assert(layoutRegressions(d,assessLayout(d,d.slides[0],measure),assessLayout(d,after,measure)).includes('Diagram connections have changed'));
});
test('raising right-hand text slightly does not justify reversing an authored two-column relationship',()=>{
 const d=document([title(),element('text',{text:'Supporting point',x:96,y:330,w:400,h:180,fontSize:28}),element('image',{src:source,x:750,y:310,w:480,h:330})]),after=structuredClone(d.slides[0]);after.elements[1]={...after.elements[1],x:950,y:230,w:350};after.elements[2]={...after.elements[2],x:96,y:310,w:700};const measure=Object.assign((text:string,_e:SlideElement,size:number)=>text.length*size*.5,{aspect:()=>1.5});
 assert(layoutRegressions(d,assessLayout(d,d.slides[0],measure),assessLayout(d,after,measure)).includes('The reading order of text and evidence has changed'));
});
