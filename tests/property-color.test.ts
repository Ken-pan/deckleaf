import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propertyColor,pickedPropertyColor,nativePropertyColor} from '../src/core/property-color';

test('property colors normalize pasted short hex and preserve authored alpha',()=>{
  assert.equal(propertyColor(' ABC '),'#aabbcc');
  assert.equal(propertyColor('#AbC8'),'#aabbcc88');
  assert.equal(propertyColor('11223380'),'#11223380');
  assert.equal(propertyColor(' Transparent '),'transparent');
  for(const value of ['', '#12', '#12345', '#1234567', 'rgb(1,2,3)', '#gggggg'])assert.equal(propertyColor(value),undefined);
});
test('native RGB edits retain alpha unless the selection is mixed',()=>{
  assert.equal(pickedPropertyColor('#445566','#abc8'),'#44556688');
  assert.equal(pickedPropertyColor('#445566','#11223300'),'#44556600');
  assert.equal(pickedPropertyColor('#445566','#abc8',true),'#445566');
  assert.equal(pickedPropertyColor('#445566','transparent'),'#445566');
  assert.equal(nativePropertyColor('#abc8'),'#aabbcc');
  assert.equal(nativePropertyColor('transparent'),'#ffffff');
});
