import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck,type GroupLayout} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {rotationTools,normalizeRotation,formatRotation} from '../src/core/rotation';
import {selectionMembers,selectionFrame} from '../src/core/selection-transform';
import {resolveSlideTextSizing} from '../src/core/text-layout';
const near=(a:number,b:number)=>assert(Math.abs(a-b)<.00001,`${a} != ${b}`);
const point=(angle:number)=>({x:100+100*Math.cos(angle*Math.PI/180),y:100+100*Math.sin(angle*Math.PI/180)});
const frame={x:0,y:0,w:200,h:200};
test('rotation tracks both seam crossings and multiple turns without changing the source',()=>{
 const e=element('image',{x:0,y:0,w:200,h:200,src:'data:image/png;base64,AA==',rotation:22,flipX:true,flipY:true}),s={...blankSlide(),elements:[e]},frozen=JSON.stringify(s);
 let g=rotationTools.begin(frame,[e],point(170),true);g=rotationTools.update(g,point(-170));near(g.angle,20);g=rotationTools.update(g,point(170));near(g.angle,0);
 for(let i=1;i<=24;i++)g=rotationTools.update(g,point(170+i*30));near(g.angle,720);assert.deepEqual(rotationTools.operations(s,g),[]);
 const rotated=rotationTools.preview(s,rotationTools.update(g,point(-160))).elements[0];near(rotated.rotation,52);assert.deepEqual([rotated.x,rotated.y,rotated.w,rotated.h,rotated.flipX,rotated.flipY],[0,0,200,200,true,true]);assert.equal(JSON.stringify(s),frozen);
 assert.equal(normalizeRotation(-720),0);
});
test('Shift snaps the resulting single angle; releasing Shift restores the unsnapped trajectory',()=>{
 const e=element('rect',{rotation:22}),g=rotationTools.begin(frame,[e],point(0),true),snapped=rotationTools.update(g,point(20),true);near(snapped.angle,23);near(rotationTools.preview({...blankSlide(),elements:[e]},snapped).elements[0].rotation,45);near(rotationTools.update(snapped,point(20),false).angle,20);
 assert.equal(rotationTools.update(g,{x:100,y:100}),g);
});
test('a freeform nested group rotates about its common centre, including hidden members, in one atomic revision',()=>{
 const s=blankSlide();s.id='s';s.groups=[{id:'g',name:'Group'},{id:'child',name:'Child',parent:'g'}];s.elements=[element('rect',{id:'a',group:'child',x:0,y:0,w:100,h:100,rotation:30}),element('text',{id:'b',group:'g',x:100,y:0,w:100,h:100,text:'Keep',textSizing:'fixed'}),element('rect',{id:'hidden',group:'child',hidden:true,x:0,y:100,w:100,h:100})];
 const d=newDeck('Rotate',[s]),members=selectionMembers(s,['a','b']),f=selectionFrame(s,['a','b'])!,center={x:f.x+f.w/2,y:f.y+f.h/2};
 let g=rotationTools.begin(f,members,{x:center.x+100,y:center.y},false);g=rotationTools.update(g,{x:center.x,y:center.y+100});
 const ops=rotationTools.operations(s,g);assert.equal(ops.length,3);const next=applyOperations(d,ops);assert.equal(next.revision,d.revision+1);assert.deepEqual(next.slides[0],resolveSlideTextSizing(rotationTools.preview(s,g),d));assert.deepEqual(next.slides[0].groups,s.groups);assert.equal(next.slides[0].elements[0].rotation,120);assert.equal(next.slides[0].elements[2].rotation,90);
 const a=next.slides[0].elements[0],b=next.slides[0].elements[1];near(a.x,b.x);near(b.y-a.y,100);
});
test('locked/decorative objects and axis-aligned flow groups offer no rigid rotation; Fill members leave Fill deliberately',()=>{
 const s=blankSlide(),a=element('rect',{id:'a',group:'g',x:0,y:0,w:200,h:200,layoutItem:{widthMode:'fill',heightMode:'fixed'}});s.elements=[a];const layout:GroupLayout={id:'g',name:'Flow',direction:'horizontal',gap:10,padding:{top:10,right:10,bottom:10,left:10},align:'start',justify:'start',columns:2,x:0,y:0,w:400,h:300,order:['a'],widthMode:'fixed',heightMode:'fixed'};s.autoLayouts=[layout];
 assert.equal(rotationTools.allowed(s,[a],false),false);assert(rotationTools.allowed(s,[a],true));assert.equal(rotationTools.allowed(s,[{...a,locked:true}],true),false);assert.equal(rotationTools.allowed(s,[{...a,designPattern:true}],true),false);assert.equal(rotationTools.allowed(s,[],true),false);
 const g=rotationTools.update(rotationTools.begin(frame,[a],point(0),true),point(45)),d=newDeck('Flow',[s]),next=applyOperations(d,rotationTools.operations(s,g));assert.equal(next.slides[0].elements[0].layoutItem?.widthMode,'fixed');assert.equal(next.slides[0].elements[0].rotation,45);assert.deepEqual(next.slides[0],resolveSlideTextSizing(rotationTools.preview(s,g),d));
});

const enabled={enabled:true,scale:1};
const nearby=(rotation=37)=>{
 const moving=element('rect',{id:'moving',x:0,y:0,w:200,h:200,rotation:10});
 const reference=element('rect',{id:'reference',x:230,y:0,w:180,h:100,rotation,name:'Reference'});
 const slide={...blankSlide(),elements:[moving,reference]};
 return{moving,reference,slide,g:rotationTools.begin(frame,[moving],point(0),true,rotationTools.scene(slide,[moving],frame))};
};
test('automatic common angles capture, hold and release without replacing the raw trajectory',()=>{
 const e=element('rect',{rotation:10}),g=rotationTools.begin(frame,[e],point(0),true);
 let held=rotationTools.update(g,point(33),false,enabled);near(held.angle,35);assert.equal(held.snap?.kind,'common');
 held=rotationTools.update(held,point(39),false,enabled);near(held.angle,35);near(held.delta,39);
 const released=rotationTools.update(held,point(41),false,enabled);near(released.angle,41);assert.equal(released.snap,undefined);
 const reverse=rotationTools.update(released,point(34),false,enabled);near(reverse.angle,35);
});
test('nearby authored angles including decimal angles attract the resulting bearing',()=>{
 const {g,slide}=nearby(37.25),frozen=JSON.stringify(slide),held=rotationTools.update(g,point(25),false,enabled);
 near(held.angle,27.25);near(rotationTools.preview(slide,held).elements[0].rotation,37.25);
 assert.equal(held.snap?.referenceId,'reference');assert.equal(held.snap?.memberId,'moving');assert.equal(JSON.stringify(slide),frozen);
 const next=rotationTools.update(held,point(31),false,enabled);near(next.angle,27.25);
 const released=rotationTools.update(next,point(33),false,enabled);near(released.angle,35);assert.equal(released.snap?.kind,'common');
});
test('Alt bypasses automatic and explicit stepping; modifier changes restore the same pointer bearing',()=>{
 const {g}=nearby(),held=rotationTools.update(g,point(25),false,enabled);
 const free=rotationTools.update(held,point(25),true,{...enabled,alt:true});near(free.angle,25);assert.equal(free.snap,undefined);
 near(rotationTools.update(free,point(25),false,enabled).angle,27);
 const step=rotationTools.update(free,point(25),true,{enabled:false});near(step.angle,20);assert.equal(step.snap?.kind,'step');
 near(rotationTools.update(step,point(25),false,{enabled:false}).angle,25);
});
test('angle seams and additional turns match neighbours without reversing the turn',()=>{
 const {g}=nearby(359);let current=rotationTools.update(g,point(-10.5),false,enabled);near(current.angle,-11);
 current=rotationTools.update(current,point(-15),false,{...enabled,alt:true});
 for(let i=1;i<=24;i++)current=rotationTools.update(current,point(-15+i*30),false,{...enabled,alt:true});
 current=rotationTools.update(current,point(-10.5),false,enabled);near(current.delta,709.5);near(current.angle,709);assert.equal(current.snap?.angle,359);
});
test('neighbour capture uses screen radius with bounded extra touch forgiveness',()=>{
 const {g}=nearby(),long=(angle:number,r:number)=>({x:100+r*Math.cos(angle*Math.PI/180),y:100+r*Math.sin(angle*Math.PI/180)});
 const mouse=rotationTools.update(g,long(23,100),false,enabled);near(mouse.angle,23);
 const touch=rotationTools.update(g,long(23,100),false,{...enabled,pointerType:'touch'});near(touch.angle,27);
 const far=rotationTools.update(g,long(25,300),false,enabled);near(far.angle,25);
 const zoom=rotationTools.update(g,long(25,300),false,{...enabled,scale:1/3});near(zoom.angle,27);
 const nearCenter=rotationTools.update(g,long(19,3),false,{...enabled,pointerType:'touch'});near(nearCenter.angle,19);
});
test('hidden, transparent, decorative, off-page and distant objects cannot attract rotation',()=>{
 const {g,slide,moving,reference}=nearby();slide.elements=[moving,{...reference,hidden:true},{...reference,id:'transparent',opacity:0},{...reference,id:'pattern',designPattern:true},{...reference,id:'off-page',x:-1000},{...reference,id:'distant',x:2000}];
 const scene=rotationTools.scene(slide,[moving],frame,{width:4000,height:900});assert.deepEqual(scene.references.map(r=>r.element.id),['distant']);
 near(rotationTools.update({...g,scene},point(25),false,enabled).angle,25);
});
test('locked visible neighbours remain useful references and equal angles pick the closest object',()=>{
 const {g,slide,moving,reference}=nearby();slide.elements.push({...reference,id:'farther',x:400});reference.locked=true;
 const held=rotationTools.update({...g,scene:rotationTools.scene(slide,[moving],frame)},point(25),false,enabled);
 assert.equal(held.snap?.referenceId,'reference');
});
test('an intentional approach switches between close references without boundary chatter',()=>{
 const {g,slide,moving,reference}=nearby();slide.elements.push({...reference,id:'second',rotation:40});
 const start={...g,scene:rotationTools.scene(slide,[moving],frame)};
 let held=rotationTools.update(start,point(26),false,enabled);assert.equal(held.snap?.referenceId,'reference');
 held=rotationTools.update(held,point(28),false,enabled);assert.equal(held.snap?.referenceId,'reference');
 held=rotationTools.update(held,point(29.5),false,enabled);assert.equal(held.snap?.referenceId,'second');near(held.angle,30);
});
test('mixed nested selection matches a visible member while preserving every relative angle and centre',()=>{
 const {slide,reference}=nearby(67);slide.groups=[{id:'outer',name:'Outer'},{id:'inner',name:'Inner',parent:'outer'}];
 const a=element('rect',{id:'a',group:'inner',x:0,y:0,w:100,h:80,rotation:22,flipX:true});
 const b=element('rect',{id:'b',group:'outer',x:150,y:0,w:80,h:80,rotation:40,flipY:true});
 const hidden=element('rect',{id:'hidden',group:'inner',x:0,y:120,w:80,h:80,rotation:66,hidden:true});
 slide.elements=[a,b,hidden,reference];const members=[a,b,hidden],f=selectionFrame(slide,['a','b'])!,c={x:f.x+f.w/2,y:f.y+f.h/2};
 const p=(angle:number)=>({x:c.x+100*Math.cos(angle*Math.PI/180),y:c.y+100*Math.sin(angle*Math.PI/180)});
 const scene=rotationTools.scene(slide,members,f);assert.deepEqual(scene.anchors.map(e=>e.id),['a','b']);assert.deepEqual(scene.references.map(r=>r.element.id),['reference']);
 const g=rotationTools.update(rotationTools.begin(f,members,p(0),false,scene),p(26),false,enabled);near(g.angle,27);assert.equal(g.snap?.memberId,'b');
 const d=newDeck('Mixed rotation',[slide]),next=applyOperations(d,rotationTools.operations(slide,g));assert.equal(next.revision,1);assert.deepEqual(next.slides[0],resolveSlideTextSizing(rotationTools.preview(slide,g),d));
 const [ar,br,hr]=next.slides[0].elements;near(ar.rotation,49);near(br.rotation,67);near(hr.rotation,93);near(br.rotation-ar.rotation,18);assert.equal(ar.flipX,true);assert.equal(br.flipY,true);assert.equal(next.slides[0].elements[3].rotation,67);
});
test('reference group members expose their authored bearing without making the moving group attract itself',()=>{
 const {slide,moving,reference}=nearby();slide.groups=[{id:'ref-group',name:'Ref group'}];reference.group='ref-group';
 const scene=rotationTools.scene(slide,[moving],frame);assert.equal(scene.references[0].element.rotation,37);assert.equal(scene.references[0].element.id,'reference');
});
test('rotation readout rounds the seam and removes negative zero without losing full-turn selection deltas',()=>{
 assert.equal(formatRotation(359.999),'0°');assert.equal(formatRotation(-.001),'0°');assert.equal(formatRotation(37.25),'37.3°');assert.equal(formatRotation(-.001,true),'0°');assert.equal(formatRotation(720,true),'+720°');
});
