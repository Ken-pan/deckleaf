import {test} from 'node:test';
import assert from 'node:assert/strict';
import {containsCredential,publicationReviewText} from '../scripts/release-content.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('release scans recognize modern credential shapes without exposing values',()=>{
  for(const prefix of ['sk-proj-','ghp_','github_pat_','figd_','sb_secret_','AIza']) assert.equal(containsCredential(prefix+'A'.repeat(60)),true);
  assert.equal(containsCredential('AKIA'+'A'.repeat(16)),true);
  assert.equal(containsCredential('Use UNSPLASH_ACCESS_KEY outside Git; fictional-test-key.'),false);
});
test('approved project rasters do not produce text credential false positives',async()=>{
  const bytes=await readFile(new URL('../public/examples/template-assets/minimal-balance.jpg',import.meta.url));
  const text=JSON.stringify({src:`data:image/jpeg;base64,${bytes.toString('base64')}`});
  const approved=new Set([createHash('sha256').update(bytes).digest('hex')]);
  assert.equal(containsCredential(text),true);
  assert.equal(containsCredential(publicationReviewText(text,approved)),false);
  assert.equal(containsCredential(publicationReviewText(text,new Set())),true);
});
test('credentials outside approved raster bytes still block publication',async()=>{
  const bytes=await readFile(new URL('../public/examples/template-assets/minimal-balance.jpg',import.meta.url));
  const approved=new Set([createHash('sha256').update(bytes).digest('hex')]);
  const text=JSON.stringify({src:`data:image/jpeg;base64,${bytes.toString('base64')}`,key:'sk-proj-'+'A'.repeat(60)});
  assert.equal(containsCredential(publicationReviewText(text,approved)),true);
});
test('embedded published fonts use the same byte identity check as images',async()=>{
  const bytes=await readFile(new URL('../public/fonts/inter.ttf',import.meta.url));
  const text=`data:font/ttf;base64,${bytes.toString('base64')}`;
  const approved=new Set([createHash('sha256').update(bytes).digest('hex')]);
  assert.equal(containsCredential(text),true);
  assert.equal(containsCredential(publicationReviewText(text,approved)),false);
  assert.equal(containsCredential(publicationReviewText(text,new Set())),true);
});
