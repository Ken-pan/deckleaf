import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, access, symlink, lstat, readlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimePublicAssets} from '../scripts/public-assets.mjs';
import {observeThumbnail} from '../src/core/thumbnail-visibility';
import {iconLibrary, resourceCatalog} from '../server/resource-catalog';
import {ICON_SETS} from '../src/core/resources';

test('runtime builds keep gallery dependencies and fonts but omit duplicate working assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deck-runtime-assets-'));
  const keep = ['fonts/document.ttf', 'resources/blue-black-v1/png/spot.png', 'resources/blue-black-v1/references/style-master.png', 'resources/blue-black-v1/prompts.json', 'resources/blue-black-v1/jszip.min.js', 'resources/characters-v1/manifest.json', 'resources/deck-graphics-v1/deck-graphics-v1.zip'];
  const omit = ['resources/blue-black-ai-v1/source.png', 'resources/blue-black-spots-v2/source.png', 'resources/blue-black-v1/qa/screenshot.png', 'resources/blue-black-v1/blue-black-library-v1.2.zip', '.DS_Store'];
  for (const path of [...keep, ...omit]) {const file=join(root,'public',path);await mkdir(join(file,'..'),{recursive:true});await writeFile(file,path);}
  const plugin = runtimePublicAssets();
  plugin.configResolved({root,build:{outDir:'dist'}});
  await plugin.closeBundle();
  for (const path of keep) assert.equal(await readFile(join(root,'dist',path),'utf8'),path);
  for (const path of omit) await assert.rejects(access(join(root,'dist',path)));
  for (const path of omit) assert.equal(await readFile(join(root,'public',path),'utf8'),path);
});

test('runtime assets copy into a linked build directory without replacing its link or existing files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'deck-linked-build-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(join(root, 'public/fonts'), {recursive:true});
  await mkdir(join(root, 'release/local-build'), {recursive:true});
  await writeFile(join(root, 'public/fonts/document.ttf'), 'document font');
  await writeFile(join(root, 'release/local-build/index.html'), 'built entry');
  await symlink('release/local-build', join(root, 'dist'), 'dir');
  const plugin = runtimePublicAssets();
  plugin.configResolved({root, build:{outDir:'dist'}});
  await plugin.closeBundle();
  assert.equal((await lstat(join(root, 'dist'))).isSymbolicLink(), true);
  assert.equal(await readlink(join(root, 'dist')), 'release/local-build');
  assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), 'built entry');
  assert.equal(await readFile(join(root, 'dist/fonts/document.ttf'), 'utf8'), 'document font');
  assert.equal(await readFile(join(root, 'public/fonts/document.ttf'), 'utf8'), 'document font');
});

test('thumbnail canvases leave the viewport and share a lifecycle-safe observer', () => {
  const original = globalThis.IntersectionObserver;
  let created=0, disconnected=0, callback:IntersectionObserverCallback;
  const observed = new Set<Element>();
  class Observer {
    constructor(cb:IntersectionObserverCallback){created++;callback=cb;}
    observe(target:Element){observed.add(target);}
    unobserve(target:Element){observed.delete(target);}
    disconnect(){disconnected++;observed.clear();}
  }
  globalThis.IntersectionObserver=Observer as unknown as typeof IntersectionObserver;
  try {
    const a={} as Element,b={} as Element,updatesA:boolean[]=[],updatesB:boolean[]=[];
    const stopA=observeThumbnail(a,value=>updatesA.push(value)),stopB=observeThumbnail(b,value=>updatesB.push(value));
    assert.equal(created,1);assert.equal(observed.size,2);
    const send=(target:Element,isIntersecting:boolean)=>callback!([{target,isIntersecting} as IntersectionObserverEntry],{} as IntersectionObserver);
    send(a,true);send(a,false);send(b,true);
    assert.deepEqual(updatesA,[true,false]);assert.deepEqual(updatesB,[true]);
    stopA();send(a,true);assert.deepEqual(updatesA,[true,false]);assert.equal(observed.size,1);assert.equal(disconnected,0);
    stopB();assert.equal(disconnected,1);
    const stop=observeThumbnail(a,()=>{});assert.equal(created,2);stop();assert.equal(disconnected,2);
  } finally {globalThis.IntersectionObserver=original;}
});

test('lightweight icon counts match installed bodies and concurrent library reads share ownership', async () => {
  const catalog=await resourceCatalog();
  for (const set of ICON_SETS) {
    const [first, second]=await Promise.all([iconLibrary(set.id),iconLibrary(set.id)]);
    assert.equal(first,second);
    assert.equal(catalog.collections.find(collection=>collection.id===set.id)!.count,Object.keys(first.data.icons).length);
  }
  assert.equal(catalog.iconCount,catalog.collections.reduce((sum,collection)=>sum+collection.count,0));
  await assert.rejects(iconLibrary('../invalid'),/Unsupported/);
});
