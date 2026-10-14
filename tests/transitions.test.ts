import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { TRANSITION_IDS, TRANSITION_PRESETS, transitionFrames, createPageTransition } from '../src/core/transitions';
import { newDeck, blankSlide, validateDeck } from '../src/core/model';
import { applyOperations } from '../src/core/operations';

test('all transition presets save through the shared transaction and legacy pages remain unchanged', () => {
  const d=newDeck('Protected source',[blankSlide()]); d.slides[0].source={provider:'PDF',render:'data:image/png;base64,aA==',warnings:[],fidelity:'source-render'};
  const original=JSON.stringify(d); assert.equal(new Set(TRANSITION_PRESETS.map(p=>p.id)).size,TRANSITION_IDS.length);
  for(const effect of TRANSITION_IDS){const result=applyOperations(d,[{op:'update_slide',slideId:d.slides[0].id,patch:{transition:{effect,duration:800,easing:'smooth'}}}],d.revision,'ai');assert.equal(validateDeck(result).slides[0].transition?.effect,effect);assert.deepEqual(result.slides[0].source,d.slides[0].source);assert.equal(JSON.stringify(d),original)}
  assert.throws(()=>applyOperations(d,[{op:'update_slide',slideId:d.slides[0].id,patch:{transition:{effect:'unsupported' as any,duration:800,easing:'smooth'}}}]));
});
test('forward and backward frames serialize without application dependencies and masks keep a stable topology', () => {
  const frames=runInNewContext(`(${transitionFrames.toString()})`,{__name:(f:Function)=>f});
  for(const id of TRANSITION_IDS)for(const direction of [-1,1])for(const incoming of [true,false]){
    const values:Keyframe[]=frames(id,direction,incoming);assert(values.length>=2);assert(!JSON.stringify(values).match(/NaN|undefined/));
    const paths=values.filter(f=>String(f.clipPath).startsWith('polygon')).map(f=>String(f.clipPath).split(',').length);if(paths.length)assert(paths.every(n=>n===paths[0]));
  }
  assert.match(String(transitionFrames('parallax',-1)[0].transform),/-100%/);
  assert.equal(transitionFrames('soft-focus',1,true,true)[0].filter,'none');
  assert.equal(transitionFrames('cube',1)[0].transformOrigin,'0% 50%');
});
test('page playback supports pause, cancellation, static preference and unsupported-frame fallback', async () => {
  const controls:any[]=[];let calls=0;
  const target=()=>({style:{visibility:''},animate:()=>{calls++;let settle!:()=>void;const a={playState:'running',finished:new Promise<void>(ok=>settle=ok),pause(){this.playState='paused'},play(){this.playState='running'},cancel(){this.playState='idle';settle()},finish(){this.playState='finished';settle()}};controls.push(a);return a}} as unknown as HTMLElement);
  const run=createPageTransition(transitionFrames,{smooth:'linear'}),incoming=target(),outgoing=target(),t={effect:'mosaic' as const,duration:800,easing:'smooth' as const};
  const playback=run(incoming,outgoing,t,1,{paused:true});assert(controls.every(a=>a.playState==='paused'));playback.setPaused(false);assert(controls.every(a=>a.playState==='running'));controls.forEach(a=>a.finish());await playback.finished;assert.equal(outgoing.style.visibility,'hidden');assert(controls.every(a=>a.playState==='idle'));
  const before=calls;await run(target(),target(),t,1,{reduced:true}).finished;assert.equal(calls,before);
  const interrupted=run(target(),target(),t,-1);interrupted.cancel();await interrupted.finished;assert(interrupted.animations.every(a=>a.playState==='idle'));
  let fallback=0;const bad={style:{visibility:''},animate:(frames:Keyframe[])=>{if(frames.some(f=>f.clipPath))throw new Error('Unsupported mask');fallback++;return target().animate(frames)}} as unknown as HTMLElement;
  const result=run(bad,null,t,1);assert.equal(fallback,1);result.cancel();await result.finished;
});

test('comfort profiles bound camera motion, avoid opaque text overlap and stay stable on small screens', async () => {
  const { EASINGS }=await import('../src/core/motion');
  assert.equal(EASINGS.smooth,'cubic-bezier(.22,1,.36,1)');
  const fades=['fade','slide','zoom','zoom-through','pullback','soft-focus','orbit','stack','flip','hinge'] as const;
  const opacityAt=(values:Keyframe[],time:number)=>{const pts=values.map((f,i)=>({t:Number(f.offset ?? i/(values.length-1)),v:Number(f.opacity)})).filter(p=>Number.isFinite(p.v));const end=pts.findIndex(p=>p.t>=time);if(end<=0)return pts[Math.max(0,end)].v;const a=pts[end-1],b=pts[end];return a.v+(b.v-a.v)*(time-a.t)/(b.t-a.t)};
  for(const effect of fades)for(const direction of [-1,1]){
    const enter=transitionFrames(effect,direction,true),exit=transitionFrames(effect,direction,false);
    for(let t=0;t<=1;t+=.01)assert(!(opacityAt(enter,t)>.35 && opacityAt(exit,t)>.35),`${effect} leaves both texts readable at ${t}`);
  }
  for(const effect of ['zoom','zoom-through','pullback','soft-focus','orbit','stack'] as const)for(const direction of [-1,1])for(const incoming of [false,true]){
    for(const f of transitionFrames(effect,direction,incoming)){const m=/scale\(([^)]+)\)/.exec(String(f.transform));if(m)assert(Number(m[1])>=.88 && Number(m[1])<=1.15,`${effect} has excessive scale`)}
  }
  const desktop=transitionFrames('orbit',1)[0],mobile=transitionFrames('orbit',1,true,true)[0];
  assert(Math.abs(Number(/rotate\(([-\d.]+)/.exec(String(mobile.transform))![1]))<Math.abs(Number(/rotate\(([-\d.]+)/.exec(String(desktop.transform))![1])));
  const mosaic = transitionFrames('mosaic')[0].clipPath, pixels = transitionFrames('pixels')[0].clipPath;
  assert(typeof mosaic === 'string'); assert(typeof pixels === 'string');
  assert(mosaic.split(',').length<80);
  assert(pixels.split(',').length<150);
});
