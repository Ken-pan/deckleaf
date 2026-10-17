import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, access, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runtimePublicAssets, writeRuntimeFontManifest} from '../scripts/public-assets.mjs';
import {distributionOutput, exportSources, freshOutput} from '../scripts/distribution.mjs';

const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
async function put(root: string, path: string, bytes: Uint8Array | string) {
  await mkdir(join(root, path, '..'), {recursive:true});await writeFile(join(root,path),bytes);
}
async function fixture(root: string) {
  const payload=Buffer.alloc(64);payload.writeUInt32LE(64,0);payload.writeUInt16LE(0x504c,34);
  const face={family:'Fixture',style:'regular',weight:400,file:'/fonts/pptx/fixture.fntdata',ttf:'/fonts/pptx/fixture.ttf',license:'/fonts/pptx/fixture-OFL.txt',fsType:0,sha256:sha(payload),sourceHashes:{'public/fonts/fixture/source.woff2':sha('source font')}};
  await put(root,'public/fonts/pptx/manifest.json',JSON.stringify([face]));
  await put(root,'public/fonts/pptx/fixture.fntdata',payload);
  await put(root,'public/fonts/pptx/fixture.ttf','original full TTF');
  await put(root,'public/fonts/pptx/fixture.ttf.br','source sidecar');
  await put(root,'public/fonts/pptx/fixture-OFL.txt','source license');
  await put(root,'public/fonts/fixture/source.woff2','source font');
  await put(root,'public/fonts/fixture/OFL.txt','original license');
  await put(root,'public/fonts/fixture.css','runtime font CSS');
  await put(root,'public/fonts/document.ttf','required runtime TTF');
  await put(root,'public/website/hero.png','original website art');
  await put(root,'public/examples/template-assets/originals/source.png','original provenance asset');
  await put(root,'src/core/font-catalog.json',JSON.stringify([{family:'Fixture',css:'/fonts/fixture.css',license:'/fonts/fixture/OFL.txt'}]));
  for (const path of ['scripts/build-template-fonts.py','LICENSE','ASSET_LICENSES.md','THIRD_PARTY_NOTICES.md']) await put(root,path,'retained source');
  return face;
}

test('app distribution separates website/source TTF but retains offline font payloads, licenses, runtime TTF and original template links',async t=>{
  const root=await mkdtemp(join(tmpdir(),'deck-split-assets-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const face=await fixture(root),before=await readFile(join(root,'public/fonts/pptx/manifest.json'),'utf8');
  const plugin=runtimePublicAssets();plugin.configResolved({root,build:{outDir:'app'}});await plugin.closeBundle();
  for(const path of ['website','fonts/pptx/fixture.ttf','fonts/pptx/fixture.ttf.br'])await assert.rejects(access(join(root,'app',path)));
  for(const path of ['fonts/pptx/fixture.fntdata','fonts/pptx/fixture-OFL.txt','fonts/document.ttf','examples/template-assets/originals/source.png'])await access(join(root,'app',path));
  const manifest=JSON.parse(await readFile(join(root,'app/fonts/pptx/manifest.json'),'utf8'));
  assert.equal(manifest[0].sha256,face.sha256);assert(!('ttf' in manifest[0]));assert(!('sourceHashes' in manifest[0]));
  assert.equal(await readFile(join(root,'public/fonts/pptx/manifest.json'),'utf8'),before);
  assert.equal(await readFile(join(root,'public/website/hero.png'),'utf8'),'original website art');
  await writeFile(join(root,'app/fonts/pptx/fixture.fntdata'),'corruption');
  await assert.rejects(writeRuntimeFontManifest(join(root,'public'),join(root,'app')),/integrity/);
});

test('source packages retain the exact original manifest, hashed inputs, TTF and licenses and reject inconsistent source hashes',async t=>{
  const root=await mkdtemp(join(tmpdir(),'deck-export-sources-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await fixture(root);const output=join(root,'output/sources');
  const report=await exportSources(root,output);
  assert.equal(report.kind,'export-sources');
  assert.deepEqual(await readFile(join(output,'public/fonts/pptx/manifest.json')),await readFile(join(root,'public/fonts/pptx/manifest.json')));
  assert.equal(await readFile(join(output,'public/fonts/pptx/fixture.ttf'),'utf8'),'original full TTF');
  assert.equal(report.files['public/fonts/fixture/source.woff2'].sha256,sha('source font'));
  await assert.rejects(exportSources(root,output),{code:'EEXIST'});
  await writeFile(join(root,'public/fonts/fixture/source.woff2'),'changed');
  await assert.rejects(exportSources(root,join(root,'output/invalid')),/source integrity/);
});

test('distribution staging refuses unrelated or existing destinations',async t=>{
  const root=await mkdtemp(join(tmpdir(),'deck-release-output-'));t.after(()=>rm(root,{recursive:true,force:true}));
  assert.throws(()=>distributionOutput(join(root,'public'),root),/output directory/);
  assert.throws(()=>distributionOutput(join(root,'../output'),root),/output directory/);
  assert.equal(distributionOutput(join(root,'output/release'),root),join(root,'output/release'));
  await freshOutput(join(root,'output/release'));await assert.rejects(freshOutput(join(root,'output/release')),{code:'EEXIST'});
});
