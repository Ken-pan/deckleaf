import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutNumberPresets,scrubNumber} from '../src/core/numeric-field';

test('numeric scrubbing supports precision, snapping, negative values and bounds',()=>{
  assert.equal(scrubNumber(842.7,10,{step:1,fractional:true}),853);
  assert.equal(scrubNumber(0,3,{step:1,fine:true,fractional:true}),.3);
  assert.equal(scrubNumber(1.2,2,{step:.05}),1.3);
  assert.equal(scrubNumber(-5,1,{step:1,coarse:true,increment:4}),4);
  assert.equal(scrubNumber(8,-100,{step:1,min:0}),0);
  assert.equal(scrubNumber(95,100,{step:1,max:100}),100);
  assert.equal(scrubNumber(5,-10,{step:1}),-5);
});

test('layout presets use the current slide and selection dimensions',()=>{
  const slide={width:1440,height:810},frame={w:501.3,h:488};
  assert.deepEqual(layoutNumberPresets('x',slide,frame).slice(-2),[{value:469.4,label:'Center'},{value:938.7,label:'Right edge'}]);
  assert.deepEqual(layoutNumberPresets('y',slide,frame).slice(-2),[{value:161,label:'Center'},{value:322,label:'Bottom edge'}]);
  assert.deepEqual(layoutNumberPresets('h',slide,frame).map(p=>typeof p==='number'?p:p.value),[202.5,405,607.5,810]);
});

test('presets honor each field range, step base and duplicate values',async()=>{
  const {numberPresets}=await import('../src/core/numeric-field');
  assert.deepEqual(numberPresets('font',{min:18,max:28,step:'any'}).map(p=>p.value),[18,20,24,28]);
  assert.deepEqual(numberPresets('stroke',{min:1,max:8,step:1}).map(p=>p.value),[1,2,3,4,6,8]);
  assert.deepEqual(numberPresets('scale',{min:25,max:200,step:5}).map(p=>p.value),[25,50,75,100,125,150,200]);
  assert.deepEqual(numberPresets('number',{min:3,max:9,step:2}).map(p=>p.value),[3,9]);
  assert.deepEqual(numberPresets('number',{presets:[0,0,NaN,Infinity,{value:4,label:'Four'},5],min:0,max:4,step:1}),[{value:0,label:''},{value:4,label:'Four'}]);
  assert.equal(scrubNumber(25,1,{step:5,stepBase:25,min:25,max:200}),30);
});

test('preset magnets capture, hold through small movements and release with continued dragging',async()=>{
  const {snappedScrubNumber}=await import('../src/core/numeric-field');
  const options={step:1,fractional:true},targets=[-90,0,45,90];
  assert.deepEqual(snappedScrubNumber(40,1,options,targets),{value:41});
  assert.deepEqual(snappedScrubNumber(40,3.5,options,targets),{value:45,snapped:45});
  assert.deepEqual(snappedScrubNumber(40,6,options,targets,45),{value:45,snapped:45});
  assert.deepEqual(snappedScrubNumber(40,9,options,targets,45),{value:49});
  assert.deepEqual(snappedScrubNumber(-10,8.5,options,targets),{value:0,snapped:0});
  assert.deepEqual(snappedScrubNumber(90,-43.5,options,targets),{value:45,snapped:45});
});

test('Alt bypasses magnets and fractional fields use the same pointer scale',async()=>{
  const {snappedScrubNumber}=await import('../src/core/numeric-field');
  assert.deepEqual(snappedScrubNumber(40,35,{step:1,fine:true,fractional:true},[45],45),{value:43.5});
  const options={step:.05,fractional:true},targets=[1,1.2,1.4,1.5,1.6,2];
  assert.deepEqual(snappedScrubNumber(1,7.6,options,targets),{value:1.4,snapped:1.4});
  assert.deepEqual(snappedScrubNumber(1,8.6,options,targets,1.4),{value:1.4,snapped:1.4});
  assert.deepEqual(snappedScrubNumber(1,9.2,options,targets,1.4),{value:1.45});
});

test('magnets respect hard limits, dense presets and Shift increment constraints',async()=>{
  const {snappedScrubNumber}=await import('../src/core/numeric-field');
  assert.deepEqual(snappedScrubNumber(0,1,{step:1,min:0,max:100},[0,24,100]),{value:1});
  assert.deepEqual(snappedScrubNumber(100,-1,{step:1,min:0,max:100},[0,24,100],100),{value:99});
  assert.deepEqual(snappedScrubNumber(1,2.5,{step:1},[1,2,3,4,5,6],3),{value:4});
  const snapped=snappedScrubNumber(20,.6,{step:1,coarse:true,increment:4},[24,26,48]);
  assert.equal(snapped.value%4,0);assert.notEqual(snapped.snapped,26);
  assert.deepEqual(snappedScrubNumber(10,2,{step:1},[NaN,Infinity]),{value:12});
});

test('numeric menus stay short without reducing drag magnets or allowing invalid values',async()=>{
  const {NUMBER_PRESETS,numberPresets,numberMenuPresets}=await import('../src/core/numeric-field');
  for(const kind of Object.keys(NUMBER_PRESETS) as (keyof typeof NUMBER_PRESETS)[]) {
    const menu=numberMenuPresets(kind),all=numberPresets(kind);
    assert(menu.length>0&&menu.length<=6,kind);
    assert(menu.every(item=>all.some(candidate=>candidate.value===item.value)),kind);
  }
  assert.deepEqual(numberMenuPresets('spacing').map(item=>item.value),[0,8,16,24,32,48]);
  assert(numberPresets('spacing').some(item=>item.value===12));
  assert.deepEqual(numberMenuPresets('font',{min:18,max:19}).map(item=>item.value),[18]);
  assert.deepEqual(numberMenuPresets('number',{min:3,max:9,step:2}).map(item=>item.value),[3,9]);
  const presets=layoutNumberPresets('w',{width:1440,height:810},{w:500,h:300});
  assert.deepEqual(numberMenuPresets('dimension',{presets}),numberPresets('dimension',{presets}));
  const custom=numberMenuPresets('number',{presets:Array.from({length:20},(_,value)=>({value,label:`Value ${value}`}))});
  assert.equal(custom.length,6);assert.equal(custom[0].value,0);assert.equal(custom.at(-1)?.value,19);
});
