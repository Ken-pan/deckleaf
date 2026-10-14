import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resourceReplacementContext} from '../src/core/resource-replacement-context';
import type {ResourceAttribution} from '../src/core/model';

const resource=(id:string,kind:ResourceAttribution['kind']):ResourceAttribution=>({id,kind,title:'Current asset',provider:'Test',creator:'Test author',sourceUrl:'https://example.com',license:'CC0',licenseUrl:'https://example.com/license',attribution:'Test',attributionRequired:false});
test('replacement resumes the current resource family independently of saved browsing',()=>{
  assert.deepEqual(resourceReplacementContext(resource('blue-black:scene-13-review','illustration')),{kind:'illustration',collection:'blue-black',iconSet:'lucide',photoSource:''});
  assert.equal(resourceReplacementContext(resource('doodles:running','illustration')).collection,'doodles');
  assert.equal(resourceReplacementContext(resource('illlustrations:work','illustration')).collection,'illlustrations');
  assert.equal(resourceReplacementContext(resource('deck-graphics:fine-dots','illustration')).collection,'deck-graphics');
  assert.equal(resourceReplacementContext(resource('iconify:ph:arrow-right','icon')).iconSet,'ph');
  assert.equal(resourceReplacementContext(resource('unsplash:123','photo')).photoSource,'unsplash');
  assert.equal(resourceReplacementContext(resource('pexels:123','photo')).photoSource,'pexels');
  assert.equal(resourceReplacementContext().kind,'photo');
});
