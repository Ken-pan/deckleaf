import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compositeColor,contrastRatio,mixColors,readableTextColor} from '../src/core/color-contrast';

test('alpha compositing uses the visible background and preserves invisible colors',()=>{
  assert.equal(compositeColor('#0008','#ffffff'),'#777777');
  assert.equal(compositeColor('#00000080','#ffffff'),'#7f7f7f');
  for(const color of ['transparent','#0000','#ffffff00'])assert.equal(readableTextColor(color,'#26362c'),color);
  assert.equal(readableTextColor('#111111','#26362c',4.5,0),'#111111');
});
test('readability corrections retain authored alpha, including impossible contrast targets',()=>{
  const background='#26362c',corrected=readableTextColor('#111111cc',background);
  assert.equal(corrected.slice(7),'cc');assert.ok(contrastRatio(compositeColor(corrected,background),background)>=4.5);
  assert.equal(readableTextColor('#ffffff11','#ffffff'),'#00000011');
});
test('bounded contrast search matches the minimal quantized correction without rounding thresholds',()=>{
  for(const foreground of ['#111111','#687168','#73856e','#ffffff','#dce4ef','#112233cc']){
    for(const background of ['#26362c','#ffffff','#808080'])for(const target of [3,4.5,7]){
      const ratio=(color:string)=>contrastRatio(compositeColor(color,background),background),alpha=foreground.slice(7);
      const end=ratio('#000000'+alpha)>ratio('#ffffff'+alpha)?'#000000':'#ffffff';
      const expected=ratio(foreground)>=target?foreground:Array.from({length:100},(_,i)=>mixColors(foreground,end,(i+1)/100)+alpha).find(color=>ratio(color)>=target)??end+alpha;
      assert.equal(readableTextColor(foreground,background,target),expected,`${foreground} on ${background} at ${target}`);
    }
  }
});
