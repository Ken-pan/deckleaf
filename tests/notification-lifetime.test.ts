import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationDuration, notificationLifetime} from '../src/notification-lifetime';

class Target {
  dataset:Record<string,string> = {};
  parentElement?:Target;
  listeners = new Map<string, (event: any) => void>();
  addEventListener(type: string, handler: any) { this.listeners.set(type, handler); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  contains(value: unknown) { return value === this; }
  emit(type: string, event = {}) { this.listeners.get(type)?.(event); }
}
function environment() {
  let now = 0, sequence = 0;
  const jobs = new Map<number, {at:number; callback:()=>void}>(), node = new Target(), document = Object.assign(new Target(), {hidden:false});
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({document, Node:Target, performance:{now:()=>now}, setTimeout:(callback:()=>void,delay:number)=>{const id=++sequence;jobs.set(id,{at:now+delay,callback});return id;}, clearTimeout:(id:number)=>jobs.delete(id)})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{configurable:true,value});
  }
  return {node, document, jobs, tick(ms:number) { const end=now+ms; while(true) {const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;jobs.delete(next[0]);next[1].callback();}now=end;}, restore() {for(const [key,value] of previous) {if(value)Object.defineProperty(globalThis,key,value);else delete (globalThis as any)[key];}}};
}

test('warnings, errors and information have no expiry; long confirmations get reading time',()=>{
  for (const tone of ['info','warning','error'] as const) assert.equal(notificationDuration(tone,'Please read this'),0);
  assert.equal(notificationDuration('success','Copied'),6000);
  assert.equal(notificationDuration('success','x'.repeat(150)),9000);
  assert.equal(notificationDuration('success','x'.repeat(1000)),12000);
});
test('hover and keyboard focus each pause the remaining lifetime; hidden time is excluded',()=>{
  const env=environment(); let dismissed=0;
  try {
    const action=notificationLifetime(env.node as unknown as HTMLElement,{id:1,duration:6000,dismiss:()=>dismissed++});
    env.tick(2000);env.node.emit('pointerenter');env.tick(10000);assert.equal(dismissed,0);
    env.node.emit('focusin');env.node.emit('pointerleave');env.tick(10000);assert.equal(dismissed,0);
    env.node.emit('focusout',{relatedTarget:null});env.tick(1000);
    env.document.hidden=true;env.document.emit('visibilitychange');env.tick(20000);assert.equal(dismissed,0);
    env.document.hidden=false;env.document.emit('visibilitychange');env.tick(2999);assert.equal(dismissed,0);env.tick(1);assert.equal(dismissed,1);
    action.destroy();assert.equal(env.node.listeners.size,0);assert.equal(env.document.listeners.size,0);
  } finally {env.restore();}
});
test('repeated confirmations get a fresh lifetime and replacements cancel earlier dismissal',()=>{
  const env=environment();let old=0,current=0;
  try {
    const action=notificationLifetime(env.node as unknown as HTMLElement,{id:1,duration:6000,dismiss:()=>old++});env.tick(5000);
    action.update({id:2,duration:6000,dismiss:()=>current++});env.tick(5999);assert.equal(old+current,0);env.tick(1);assert.equal(current,1);
    action.update({id:3,duration:6000,dismiss:()=>old++});env.tick(1000);
    action.update({id:4,duration:0,dismiss:()=>current++});env.tick(20000);assert.equal(old,0);assert.equal(current,1);
    action.destroy();assert.equal(env.jobs.size,0);
  } finally {env.restore();}
});

test('a toast deferred for lack of space pauses and resumes its remaining display time',()=>{
  const env=environment();let dismissed=0;const surface=new Target();env.node.parentElement=surface;
  try {
    const action=notificationLifetime(env.node as unknown as HTMLElement,{id:1,duration:6000,dismiss:()=>dismissed++});
    env.tick(2000);surface.dataset.notificationHidden='true';surface.emit('notificationvisibilitychange');env.tick(15000);assert.equal(dismissed,0);
    surface.dataset.notificationHidden='false';surface.emit('notificationvisibilitychange');env.tick(3999);assert.equal(dismissed,0);env.tick(1);assert.equal(dismissed,1);
    action.destroy();assert.equal(surface.listeners.size,0);
  } finally {env.restore();}
});
