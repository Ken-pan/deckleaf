import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankSlide, element, newDeck, validateDeck, PrototypeSchema } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { normalizePrototypeUrl, prototypeElement, prototypeEmbedUrl } from '../src/core/prototype';
import { clickOrders, defaultAnimation, playElement } from '../src/core/motion';
import { transitionFrames } from '../src/core/transitions';

const share = 'https://www.figma.com/proto/ABC123/Review?page-id=1%3A2&node-id=5-3&starting-point-node-id=5%3A3&t=temporary';
test('legacy documents load without changing geometry, notes or source render', () => {
  const s = blankSlide(); s.source = {provider:'PDF',render:'data:image/png;base64,aA==',warnings:[],fidelity:'source-render'};
  s.notes='Original notes'; s.elements=[element('text',{rotation:25,text:'Evidence'})];
  const d = newDeck('Legacy',[s]); const loaded=validateDeck(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(loaded,d); assert.equal(loaded.slides[0].transition,undefined); assert.equal(loaded.slides[0].elements[0].animation,undefined);
});
test('motion and prototype edits are atomic and revision guarded for AI too', () => {
  const s=blankSlide(), p=prototypeElement(share,1440,810);s.elements=[p];const d=newDeck('Motion',[s]),before=JSON.stringify(d);
  const ops=[{op:'update_slide' as const,slideId:s.id,patch:{transition:{effect:'push' as const,duration:400,easing:'smooth' as const}}},{op:'update_element' as const,slideId:s.id,elementId:p.id,patch:{animation:{...defaultAnimation,effect:'rise' as const,trigger:'click' as const}}}];
  const next=applyOperations(d,ops,0,'ai');assert.equal(next.revision,1);assert.equal(next.slides[0].elements[0].prototype?.url,p.prototype?.url);assert.equal(JSON.stringify(d),before);
  assert.throws(()=>applyOperations(next,ops,0,'ai'));
  assert.throws(()=>applyOperations(d,[...ops,{op:'update_slide',slideId:s.id,patch:{transition:{effect:'fade',duration:9000,easing:'smooth'}}}]));assert.equal(JSON.stringify(d),before);
  d.slides[0].elements[0].locked=true;assert.throws(()=>applyOperations(d,ops,0,'ai'));
});
test('share URLs, iframe code and legacy Figma wrappers preserve starting frame and use Embed Kit 2', () => {
  const url=normalizePrototypeUrl(share);assert(!url.includes('t=temporary'));const p=PrototypeSchema.parse({url});const embed=new URL(prototypeEmbedUrl(p,'public-client'));
  assert.equal(embed.hostname,'embed.figma.com');assert.equal(embed.searchParams.get('starting-point-node-id'),'5:3');assert.equal(embed.searchParams.get('embed-host'),'deck-studio');assert.equal(embed.searchParams.get('scaling'),'contain');assert.equal(embed.searchParams.get('client-id'),'public-client');
  assert.equal(normalizePrototypeUrl(`<iframe src="${share.replaceAll('&','&amp;')}"></iframe>`),url);
  assert.equal(normalizePrototypeUrl(`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(share)}`),url);
});
test('unsafe URLs, design links and credential-bearing URLs are rejected before document save', () => {
  for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:password@example.com/proto','https://example.com/?access_token=secret','https://example.com/?api_key=secret','https://www.figma.com/design/ABC/File']) assert.throws(()=>normalizePrototypeUrl(url));
  assert.throws(()=>PrototypeSchema.parse({url:'https://www.figma.com/proto/ABC?client-id=public'}));
  assert.throws(()=>validateDeck(newDeck('Invalid',[{...blankSlide(),elements:[element('prototype')]}])));
});
test('click sequences group equal cues, ignore hidden/disabled animations and retain numeric order', () => {
  const s=blankSlide();s.elements=[element('text',{animation:{...defaultAnimation,effect:'fade',trigger:'click',order:8}}),element('rect',{animation:{...defaultAnimation,effect:'rise',trigger:'click',order:2}}),element('rect',{animation:{...defaultAnimation,effect:'slide',trigger:'click',order:2}}),element('text',{hidden:true,animation:{...defaultAnimation,effect:'fade',trigger:'click',order:1}}),element('text',{animation:{...defaultAnimation,trigger:'click',order:0}})];
  assert.deepEqual(clickOrders(s),[2,8]);assert.match(String(transitionFrames('push',-1)[0].transform),/-100%/);
});
test('reduced motion suppresses WAAPI and immediately exposes complete content and replay preserves node rotation', () => {
  let calls=0,cancels=0;const node={style:{visibility:'',transform:'rotate(25deg)'},inert:false,animate:()=>{calls++;return{cancel:()=>cancels++}}} as unknown as HTMLElement;
  const a={...defaultAnimation,effect:'rise' as const,trigger:'click' as const,order:2};
  const p={animation:a,step:0,orders:[2],enabled:true,reduced:true,replay:0,offset:0};const action=playElement(node,p);
  assert.equal(node.style.visibility,'');assert.equal(node.inert,false);action.update({...p,step:1});assert.equal(node.style.visibility,'');assert.equal(calls,0);
  action.update({...p,step:1,reduced:false});assert.equal(calls,0);action.update({...p,step:1,reduced:false,replay:1});assert.equal(calls,1);assert.equal(node.style.transform,'rotate(25deg)');action.destroy();assert(cancels>0);
});

test('layout proposals preserve prototype links, viewport settings and animation cues', async () => {
  const {createLayoutCandidate, layoutProposal} = await import('../src/core/auto-layout');
  const s=blankSlide();const p=prototypeElement(share,1440,810);p.animation={...defaultAnimation,effect:'fade',trigger:'click',order:3};
  s.elements=[element('text',{text:'Try the prototype',x:100,y:100,w:900,h:90,fontSize:48}),p];const d=newDeck('Embedded evidence',[s]);
  const candidate=createLayoutCandidate(d,s.id,'split');const proposal=layoutProposal(d,[candidate]);
  assert(proposal);const after=applyOperations(d,proposal.operations,proposal.baseRevision);const embedded=after.slides[0].elements.find(e=>e.id===p.id)!;
  assert.deepEqual(embedded.prototype,p.prototype);assert.deepEqual(embedded.animation,p.animation);assert.equal(embedded.id,p.id);
});

test('pause applies to future entrances and resume never replays completed effects', () => {
  let calls=0;const controls: {playState:string;pause:()=>void;play:()=>void;cancel:()=>void}[]=[];
  const node={style:{visibility:''},inert:false,animate:()=>{calls++;const a={playState:'running',pause(){this.playState='paused'},play(){this.playState='running'},cancel(){this.playState='idle'}};controls.push(a);return a}} as unknown as HTMLElement;
  const p={animation:{...defaultAnimation,effect:'rise' as const,trigger:'click' as const},orders:[0],step:0,enabled:true,reduced:false,paused:true,replay:0,offset:0};
  const action=playElement(node,p);action.update({...p,step:1});assert.equal(controls[0].playState,'paused');
  action.update({...p,step:1,paused:false});assert.equal(controls[0].playState,'running');assert.equal(calls,1);
  controls[0].playState='finished';action.update({...p,step:1});assert.equal(controls[0].playState,'finished');action.update({...p,step:1,paused:false});assert.equal(calls,1);
  action.update({...p,step:1,reduced:true});action.update({...p,step:1,reduced:false});assert.equal(calls,1);assert.equal(node.style.visibility,'');action.destroy();
});
test('page handoff holds entrance time and authored delays, while restored content stays complete', () => {
  const controls: any[]=[];
  const node={style:{visibility:''},inert:false,animate:(_frames:Keyframe[],timing:KeyframeAnimationOptions)=>{const a={timing,playState:'running',currentTime:0,pause(){this.playState='paused'},play(){this.playState='running'},cancel(){this.playState='idle'}};controls.push(a);return a}} as unknown as HTMLElement;
  const p={animation:{...defaultAnimation,effect:'fade' as const,delay:120},orders:[],step:0,enabled:true,reduced:false,entering:true,replay:0,offset:70};
  const action=playElement(node,p);assert.equal(controls[0].playState,'paused');assert.equal(controls[0].timing.delay,190);assert.equal(node.inert,true);
  action.update({...p,entering:false,paused:true});assert.equal(controls[0].playState,'paused');assert.equal(node.inert,false);
  action.update({...p,entering:false});assert.equal(controls[0].playState,'running');assert.equal(controls.length,1);
  action.update({...p,entering:false,restored:true});assert.equal(controls[0].playState,'idle');assert.equal(node.style.visibility,'');
  action.update({...p,entering:false,restored:false});assert.equal(controls.length,1);
  action.update({...p,restored:true,replay:1});assert.equal(controls.length,1);
  action.update({...p,replay:2});assert.equal(controls.length,2);assert.equal(controls[1].playState,'paused');action.destroy();
});
test('backward restoration does not suppress a later deliberately repeated click cue', () => {
  let calls=0;const node={style:{visibility:''},inert:false,animate:()=>{calls++;return {playState:'running',cancel(){this.playState='idle'}}}} as unknown as HTMLElement;
  const p={animation:{...defaultAnimation,effect:'fade' as const,trigger:'click' as const},orders:[0],step:1,enabled:true,reduced:false,restored:true,replay:0,offset:0};
  const action=playElement(node,p);assert.equal(calls,0);assert.equal(node.style.visibility,'');
  action.update({...p,restored:false,step:0});assert.equal(node.style.visibility,'hidden');
  action.update({...p,restored:false});assert.equal(calls,1);action.destroy();
});
test('returning to a previous page restores its final click cue and page limits stay stable', async () => {
  const {navigateCue}=await import('../src/core/motion');
  assert.deepEqual(navigateCue(1,0,-1,[3,2]),{index:0,step:3});assert.deepEqual(navigateCue(0,3,1,[3,2]),{index:1,step:0});assert.deepEqual(navigateCue(1,2,1,[3,2]),{index:1,step:2});assert.deepEqual(navigateCue(0,0,-1,[3,2]),{index:0,step:0});
});
test('suggested entrances preserve authored cues, explicitly static objects, protected layers and backgrounds', async () => {
  const {suggestEntrances}=await import('../src/core/motion');const s=blankSlide();
  s.elements=[element('text',{animation:{...defaultAnimation,effect:'fade',trigger:'click',order:5,delay:400}}),element('text',{animation:{...defaultAnimation,effect:'none'}}),element('image',{src:'data:image/png;base64,aA==',locked:true}),element('text',{hidden:true}),element('rect',{x:0,y:0,w:1440,h:810}),element('text',{text:'Unconfigured title'})];const d=newDeck('Motion guard',[s]);const ops=suggestEntrances(d,s);assert.equal(ops.length,1);const next=applyOperations(d,ops);
  assert.deepEqual(next.slides[0].elements.slice(0,5),d.slides[0].elements.slice(0,5));assert.equal(next.slides[0].elements[5].animation?.order,6);
});
test('web prototype hash routes survive normalization while credentials in query and fragments are rejected', () => {
  const url='https://example.com/demo?locale=zh#/checkout/payment';assert.equal(normalizePrototypeUrl(url),url);assert.equal(prototypeEmbedUrl(PrototypeSchema.parse({url})),url);
  for(const bad of ['https://example.com/#access_token=private','https://example.com/?api%5Fkey=private','https://example.com/#/view?password=private'])assert.throws(()=>normalizePrototypeUrl(bad));
});

test('prototype-only metadata cannot leak onto text in a mixed transaction', () => {
  const s=blankSlide();s.elements=[element('text',{text:'Keep this text'})];const d=newDeck('Mixed guard',[s]),before=JSON.stringify(d);
  assert.throws(()=>applyOperations(d,[{op:'update_slide',slideId:s.id,patch:{notes:'Draft'}},{op:'update_element',slideId:s.id,elementId:s.elements[0].id,patch:{prototype:PrototypeSchema.parse({url:normalizePrototypeUrl(share)})}}]));assert.equal(JSON.stringify(d),before);
});

test('opt-in entrances run with page transitions and still honor pause and reduced motion',()=>{
 const controls:any[]=[];
 const node={style:{visibility:''},inert:false,animate:()=>{const a={playState:'running',pause(){this.playState='paused'},play(){this.playState='running'},cancel(){this.playState='idle'}};controls.push(a);return a}} as unknown as HTMLElement;
 const p={animation:{...defaultAnimation,effect:'fade' as const,withTransition:true},orders:[],step:0,enabled:true,reduced:false,entering:true,replay:0,offset:0};
 const action=playElement(node,p);assert.equal(controls[0].playState,'running');assert.equal(node.inert,true);
 action.update({...p,paused:true});assert.equal(controls[0].playState,'paused');action.update({...p,paused:false});assert.equal(controls[0].playState,'running');
 action.update({...p,reduced:true});assert.equal(controls[0].playState,'idle');assert.equal(node.style.visibility,'');action.destroy();
});
