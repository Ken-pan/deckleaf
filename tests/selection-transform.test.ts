import {test} from 'node:test';import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,type GroupLayout} from '../src/core/model';
import {applyOperations,moveElements} from '../src/core/operations';
import {alignElements,arrangementUnits} from '../src/core/arrangement-operations';
import {selectionFrame,selectionMembers,selectionKeepsRatio,resizeSelectionFrame,selectionScalePatches,selectionScalePreview,scaleSelection} from '../src/core/selection-transform';
import {resolveSlideTextSizing} from '../src/core/text-layout';
import {reorderedSelection} from '../src/core/stack-order';
function fixture(){const s=blankSlide();s.id='s';s.groups=[{id:'root',name:'Root'},{id:'child',name:'Child',parent:'root'}];s.elements=[element('rect',{id:'a',group:'child',x:100,y:100,w:100,h:50}),element('rect',{id:'b',group:'child',x:220,y:100,w:100,h:50}),element('text',{id:'t',group:'root',x:100,y:200,w:300,h:80,fontSize:30,textSizing:'fixed',text:'Rich',paragraphs:[{runs:[{text:'Rich',fontSize:20,bold:true}],align:'left',spaceBefore:10,spaceAfter:6,indent:4,firstLineIndent:2}]}),element('rect',{id:'hidden',group:'root',hidden:true,x:80,y:20,w:40,h:20}),element('image',{id:'other',x:700,y:100,w:200,h:100,src:'data:image/png;base64,AA=='})];return newDeck('Group scaling',[s]);}
test('selection side scaling centres the perpendicular axis and clamps at a stable opposite midpoint',()=>{
 const frame={x:100,y:100,w:300,h:180},members=[element('rect',{w:100,h:60})];
 assert.deepEqual(resizeSelectionFrame(frame,members,60,90,'e',true),{x:100,y:82,w:360,h:216});
 assert.deepEqual(resizeSelectionFrame(frame,members,60,90,'e',false),{x:100,y:100,w:360,h:180});
 assert.deepEqual(resizeSelectionFrame(frame,members,99,-36,'n',true),{x:70,y:64,w:360,h:216});
 const tiny=[element('rect',{w:1,h:1})],clamped=resizeSelectionFrame(frame,tiny,1000,0,'w',true);
 assert.deepEqual(clamped,frame);
});
test('nested selection scales hidden members, rich typography and child geometry without changing identities or provenance',()=>{
 const d=fixture(),s=d.slides[0],ids=['a','b','t'],f=selectionFrame(s,ids,'root')!;assert.deepEqual(f,{x:100,y:100,w:300,h:180});const members=selectionMembers(s,ids,false,'root');assert.equal(members.length,4);const frozen=JSON.stringify(d),next=applyOperations(d,scaleSelection(d,'s',ids,f,{...f,w:f.w*2,h:f.h*2},'root'));assert.equal(JSON.stringify(d),frozen);const [a,b,t,h,o]=next.slides[0].elements;
 assert.deepEqual([a.x,a.y,a.w,a.h,b.x],[100,100,200,100,340]);assert.equal(t.fontSize,60);assert.equal(t.paragraphs![0].runs[0].fontSize,40);assert.equal(t.paragraphs![0].spaceBefore,20);assert.equal(t.textSizing,'fixed');assert.deepEqual([h.x,h.y,h.w,h.h],[60,-60,80,40]);assert.deepEqual(o,s.elements[4]);assert.deepEqual(next.slides[0].groups,s.groups);assert.equal(next.revision,d.revision+1);
});
test('automatic text and rotated groups retain proportions; quarter-turn fixed frames support deliberate free resize',()=>{
 const auto=element('text',{id:'auto',textSizing:'auto-height'}),rotated=element('rect',{rotation:30}),quarter=element('rect',{id:'quarter',x:100,y:100,w:100,h:50,rotation:90});assert(selectionKeepsRatio([auto],true));assert(selectionKeepsRatio([rotated],true));assert(selectionKeepsRatio([quarter],true,true));assert.equal(selectionKeepsRatio([quarter],true),false);assert.throws(()=>selectionScalePatches([rotated],{x:0,y:0,w:100,h:100},{x:0,y:0,w:200,h:100}),/proportionally/);const patch=selectionScalePatches([quarter],{x:0,y:0,w:300,h:200},{x:0,y:0,w:600,h:200}).get('quarter')!;assert.equal(patch.w,100);assert.equal(patch.h,100);
});
test('nested auto layouts scale frames, gap, padding and Fill limits in the same atomic transaction',()=>{
 let d=fixture(),s=d.slides[0];s.elements=s.elements.filter(e=>['a','b','t'].includes(e.id));s.groups![1].layoutItem={widthMode:'fill',heightMode:'fixed',minWidth:150,maxWidth:400};s.elements[0].layoutItem={widthMode:'fill',heightMode:'fixed',minWidth:80,maxWidth:160};
 const rule=(id:string,order:string[],attrs:Partial<GroupLayout>={}):GroupLayout=>({id,name:id,direction:'vertical',gap:10,padding:{top:5,right:5,bottom:5,left:5},align:'start',justify:'start',columns:2,x:100,y:100,w:400,h:300,widthMode:'fixed',heightMode:'hug',order,...attrs});s.autoLayouts=[rule('root',['child','t']),rule('child',['a','b'],{direction:'horizontal'})];d=applyOperations(d,[{op:'set_group_layout',slideId:'s',layout:s.autoLayouts[0]}]);s=d.slides[0];const f=selectionFrame(s,['a','b','t'],'root')!,next=applyOperations(d,scaleSelection(d,'s',['a','b','t'],f,{...f,w:f.w*1.5,h:f.h*1.5},'root')),n=next.slides[0];
 assert.deepEqual(resolveSlideTextSizing(selectionScalePreview(s,selectionMembers(s,['a','b','t'],false,'root'),f,{...f,w:f.w*1.5,h:f.h*1.5}),d),n);
 assert.equal(n.autoLayouts![0].w,s.autoLayouts![0].w*1.5);assert.equal(n.autoLayouts![0].h,s.autoLayouts![0].h*1.5);assert.equal(n.autoLayouts![1].gap,15);assert.equal(n.groups![1].layoutItem!.minWidth,225);assert.equal(n.elements[0].layoutItem!.widthMode,'fill');assert.equal(n.elements[0].layoutItem!.minWidth,120);assert.equal(n.elements[0].w,s.elements[0].w*1.5);assert.equal(n.elements[2].fontSize,45);
});
test('a locked descendant blocks the complete container; moving hidden descendants preserves internal spacing',()=>{
 const d=fixture(),s=d.slides[0],ids=['a','b','t'];const moved=applyOperations(d,moveElements(d,'s',ids,20,30,'root'));assert.equal(moved.slides[0].elements[3].x,100);s.elements[3].locked=true;assert.deepEqual(selectionMembers(s,ids,false,'root'),[]);assert.deepEqual(moveElements(d,'s',ids,20,30,'root'),[]);assert.deepEqual(scaleSelection(d,'s',ids,{x:100,y:100,w:300,h:180},{x:100,y:100,w:600,h:360},'root'),[]);
});
test('stack sorting moves a complete nested group as one unit and an individual child only inside its parent',()=>{
 const d=fixture(),s=d.slides[0];assert.deepEqual(reorderedSelection(s,['a','b','t'],1,'root'),['other','a','b','t','hidden']);assert.deepEqual(reorderedSelection(s,['a'],1),['b','a','t','hidden','other']);assert.deepEqual(reorderedSelection(s,['other'],'back'),['other','a','b','t','hidden']);s.elements[3].locked=true;assert.deepEqual(reorderedSelection(s,['a','b','t'],'front','root'),s.elements.map(e=>e.id));
});

test('whole-group alignment follows its visible frame, translates hidden members and excludes any locked subtree',()=>{
 const d=fixture(),s=d.slides[0],ids=['a','b','t'],units=arrangementUnits(d,'s',ids);assert.equal(units.length,1);assert.equal(units[0].elements.length,4);const n=applyOperations(d,alignElements(d,'s',ids,'left','page')).slides[0];assert.equal(n.elements[0].x,0);assert.equal(n.elements[3].x,-20);assert.equal(n.elements[1].x-n.elements[0].x,120);s.elements[3].locked=true;assert.deepEqual(arrangementUnits(d,'s',ids),[]);assert.deepEqual(alignElements(d,'s',ids,'left','page'),[]);
});

test('multiple auto-layout groups share a padded outer frame and individual scope keeps a leaf frame',()=>{
 const s=blankSlide();s.groups=[{id:'one',name:'One'},{id:'two',name:'Two'}];s.elements=[element('rect',{id:'a',group:'one',x:120,y:120,w:60,h:40}),element('rect',{id:'b',group:'two',x:320,y:120,w:60,h:40})];
 const layout=(id:string,x:number):GroupLayout=>({id,name:id,x,y:100,w:150,h:100,direction:'horizontal',columns:1,gap:24,padding:{top:20,right:20,bottom:20,left:20},align:'start',justify:'start',widthMode:'fixed',heightMode:'fixed',order:[id==='one'?'a':'b']});s.autoLayouts=[layout('one',100),layout('two',300)];
 assert.deepEqual(selectionFrame(s,['a','b']),{x:100,y:100,w:350,h:100});assert.deepEqual(selectionFrame(s,['a'],'@leaves'),{x:120,y:120,w:60,h:40});assert.deepEqual(selectionFrame(s,['a'],'a'),{x:120,y:120,w:60,h:40});
});
