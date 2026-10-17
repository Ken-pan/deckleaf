import {test} from 'node:test';
import assert from 'node:assert/strict';
import {colorToHsva,hsvaToColor,colorPlanePoint} from '../src/core/color-picker';

test('picker color conversions round-trip RGB and authored alpha without drift',()=>{
  for(const color of ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#e3e7db','#33669980','#12345600','#abcdef01'])assert.equal(hsvaToColor(colorToHsva(color)),color);
  for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
    const color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
    assert.equal(hsvaToColor(colorToHsva(color)),color);
  }
});
test('picker handles achromatic colors, hue wrapping and transparent starting states',()=>{
  assert.deepEqual(colorToHsva('transparent'),{h:0,s:0,v:1,a:1});
  assert.equal(colorToHsva('#000').s,0);
  assert.equal(hsvaToColor({h:360,s:1,v:1,a:1}),'#ff0000');
  assert.equal(hsvaToColor({h:-120,s:1,v:1,a:0}),'#0000ff00');
});
test('color-plane gestures clamp edges and remain finite at collapsed bounds',()=>{
  assert.deepEqual(colorPlanePoint(50,25,100,100),{s:.5,v:.75});
  assert.deepEqual(colorPlanePoint(-20,120,100,100),{s:0,v:0});
  assert.deepEqual(colorPlanePoint(120,-20,100,100),{s:1,v:1});
  assert.deepEqual(colorPlanePoint(0,0,0,0),{s:0,v:1});
});

test('RGB, HSL and HSB channel editing produces the expected colors and retains alpha',async()=>{
  const {colorChannels,channelsToColor}=await import('../src/core/color-picker');
  const red=colorToHsva('#ff000080');
  assert.deepEqual(colorChannels(red,'rgb'),[255,0,0]);
  assert.deepEqual(colorChannels(red,'hsl'),[0,100,50]);
  assert.deepEqual(colorChannels(red,'hsb'),[0,100,100]);
  for(const [format,values] of [['rgb',[0,255,0]],['hsl',[120,100,50]],['hsb',[120,100,100]]] as const){
    assert.equal(hsvaToColor(channelsToColor([...values],format,red.a)),'#00ff0080');
  }
  assert.equal(hsvaToColor(channelsToColor([240,0,0],'hsl')),'#000000');
  assert.equal(hsvaToColor(channelsToColor([240,0,100],'hsl')),'#ffffff');
});
