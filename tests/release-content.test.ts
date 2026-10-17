import {test} from 'node:test';
import assert from 'node:assert/strict';
import {containsCredential} from '../scripts/release-content.mjs';
test('release scans recognize modern credential shapes without exposing values',()=>{
  for(const prefix of ['sk-proj-','ghp_','github_pat_','figd_','sb_secret_','AIza']) assert.equal(containsCredential(prefix+'A'.repeat(60)),true);
  assert.equal(containsCredential('AKIA'+'A'.repeat(16)),true);
  assert.equal(containsCredential('Use UNSPLASH_ACCESS_KEY outside Git; fictional-test-key.'),false);
});
