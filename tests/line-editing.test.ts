import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element,blankSlide,newDeck,validateDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {DEFAULT_LINE} from '../src/core/line-schema';
import {lineEndpoints,lineLocalToWorld,lineWorldToLocal,lineEndpointPatch,lineBendPoint,lineBendPatch,lineEndpointTarget,lineSnapTargets} from '../src/core/line-editing';
const close=(a:{x:number;y:number},b:{x:number;y:number},tolerance=1e-7)=>{assert(Math.hypot(a.x-b.x,a.y-b.y)<tolerance,`${JSON.stringify(a)} != ${JSON.stringify(b)}`);};

test('endpoint dragging keeps the opposite end fixed through flips, rotation, horizontal/vertical crossing and every route',()=>{
  for(const route of ['straight','elbow','rounded','curve','arc','step','zigzag','wave'] as const)for(const rotation of [0,37,90,180,270])for(const flipX of [false,true])for(const flipY of [false,true]){
    const e=element('line',{x:300,y:200,w:260,h:120,rotation,flipX,flipY,stroke:'#123456',strokeWidth:6,line:{...DEFAULT_LINE,route,start:'circle',end:'arrow'}}),original=JSON.stringify(e),before=lineEndpoints(e);
    for(const which of ['start','end'] as const)for(const target of [{x:20,y:50},{x:650,y:700},{x:before[which==='start'?'end':'start'].x,y:100},{x:600,y:before[which==='start'?'end':'start'].y}]){
      const patch=lineEndpointPatch(e,which,target),updated={...e,...patch},after=lineEndpoints(updated);
      close(after[which==='start'?'end':'start'],before[which==='start'?'end':'start']);close(after[which],target,1.1);
      assert.equal(updated.rotation,rotation);assert.deepEqual(updated.line,e.line);assert.doesNotThrow(()=>validateDeck(newDeck('Line',[{...blankSlide(),elements:[updated]}])));
    }
    assert.equal(JSON.stringify(e),original);
  }
});

test('legacy one-pixel lines have exact endpoint anchors and can turn vertical, reverse or move either endpoint',()=>{
  for(const size of [{w:300,h:1},{w:1,h:300}])for(const flipX of [false,true])for(const flipY of [false,true]){
    const e=element('line',{x:100,y:100,...size,flipX,flipY}),ends=lineEndpoints(e);
    for(const which of ['start','end'] as const){const other=which==='start'?'end':'start',target={x:ends[other].x,y:ends[other].y+180},updated={...e,...lineEndpointPatch(e,which,target)};close(lineEndpoints(updated)[other],ends[other]);close(lineEndpoints(updated)[which],target);}
    close(lineWorldToLocal(e,lineLocalToWorld(e,{x:17,y:23})),{x:17,y:23});
  }
});

test('Shift quantizes direction from the stationary endpoint; Alt frees both angle and geometry snapping',()=>{
  const e=element('line',{x:0,y:0,w:200,h:100}),target={x:140,y:36};
  const constrained=lineEndpointTarget(e,'end',target,{shift:true,snapping:true});
  const a=Math.atan2(constrained.point.y,constrained.point.x)/(Math.PI/4);assert(Math.abs(a-Math.round(a))<1e-8);
  assert.deepEqual(lineEndpointTarget(e,'end',target,{shift:true,alt:true,snapping:true,targets:[{x:143,y:34}]}).point,target);
  const snap=lineEndpointTarget(e,'end',target,{snapping:true,targets:[{x:143,y:34}],threshold:6});assert.deepEqual(snap.point,{x:143,y:34});assert.equal(snap.guides.length,2);
});

test('bend handles map to the stored route parameter even after rotation/reflection and respect bounds',()=>{
  for(const route of ['elbow','rounded','curve','arc','step'] as const){
    const e=element('line',{x:20,y:30,w:400,h:200,rotation:37,flipX:true,line:{...DEFAULT_LINE,route}}),p=lineBendPoint(e)!;
    const vertical=route==='arc'||route==='step',target={...p,[vertical?'y':'x']:(vertical?e.h:e.w)*.7};
    const patch=lineBendPatch(e,lineLocalToWorld(e,target));assert(Math.abs(patch.line!.bend-.7)<1e-8);
    const max=lineBendPatch(e,lineLocalToWorld(e,{x:10000,y:10000}));assert(max.line!.bend>=.1&&max.line!.bend<=.9);
  }
  assert.equal(lineBendPoint(element('line',{w:200,h:1})),null);
  assert.equal(lineBendPoint(element('line',{w:1,h:200,line:{...DEFAULT_LINE,route:'curve'}})),null);
});

test('endpoint operations stay atomic and undo-ready while leaving widths, styling, other objects and source data intact',()=>{
  const line=element('line',{x:50,y:50,w:250,h:100,line:{...DEFAULT_LINE,end:'arrow'},strokeWidth:6}),other=element('rect',{x:700,y:50,w:100,h:100}),s={...blankSlide(),elements:[line,other]},deck=newDeck('Endpoints',[s]),before=JSON.stringify(deck);
  const patch=lineEndpointPatch(line,'end',{x:400,y:300});
  const result=applyOperations(deck,[{op:'update_element',slideId:s.id,elementId:line.id,patch}],deck.revision);
  assert.equal(result.revision,deck.revision+1);assert.equal(JSON.stringify(deck),before);assert.deepEqual(result.slides[0].elements[1],other);assert.equal(result.slides[0].elements[0].strokeWidth,6);assert.deepEqual(result.slides[0].elements[0].line,line.line);
  const targets=lineSnapTargets(line,[line,other,{...other,id:'hidden',hidden:true,x:999}],{width:1440,height:810});assert(targets.some(p=>p.x===700));assert(!targets.some(p=>p.x===999));
});
