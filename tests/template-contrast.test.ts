import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIONS} from '../src/core/template-collections';
import {contrastRatio} from '../src/core/deck-design-system';

test('template small labels remain readable on paper and tinted content panels',()=>{
  for(const collection of COLLECTIONS){
    const colors=collection.system.colors;
    for(const background of [colors.background,colors.surface]){
      for(const role of ['ink','muted','accent'] as const){
        assert.ok(contrastRatio(colors[role],background)>=4.5,`${collection.name}: ${role} on ${background}`);
      }
    }
  }
});
