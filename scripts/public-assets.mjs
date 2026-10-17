import {cp, mkdir, realpath, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, relative, sep} from 'node:path';

// Working collections have already been merged into blue-black-v1. Preserve
// their sources locally; ship only the runtime collection and its gallery.
const workingCollections = new Set([
  'blue-black-ai-v1', 'blue-black-internal-v1', 'blue-black-services-v1',
  'blue-black-capabilities-v1', 'blue-black-spots-v1', 'blue-black-spots-v2',
]);
export function runtimePublicAsset(path) {
  const parts = path.split(/[\\/]/);
  if (parts.some(part => part === '.DS_Store' || part === 'qa')) return false;
  if (parts[0] === 'website') return false;
  // Editable exports consume full FNTDATA, not the font-builder's TTF sources.
  if (parts[0] === 'fonts' && parts[1] === 'pptx' && /\.ttf(?:\.(?:br|gz))?$/.test(parts.at(-1))) return false;
  if (parts[0] === 'resources' && workingCollections.has(parts[1])) return false;
  // The gallery generates downloads with JSZip; this historical aggregate is
  // a second copy of the PNG collection, and is never requested by the app.
  if (parts[0] === 'resources' && parts[1] === 'blue-black-v1' && parts.at(-1).endsWith('.zip')) return false;
  return true;
}
// Generate a runtime-only manifest in the output. The original manifest and
// source hashes remain unchanged in public and in the separate source package.
export async function writeRuntimeFontManifest(source, destination) {
  let raw;
  try { raw = await readFile(resolve(source, 'fonts/pptx/manifest.json'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const faces = JSON.parse(raw);
  if (!Array.isArray(faces) || !faces.length) throw new Error('Missing editable font faces.');
  const runtime = [];
  for (const face of faces) {
    if (!/^\/fonts\/pptx\/[\w-]+\.fntdata$/.test(face.file) || !/^\/fonts\/pptx\/[\w-]+\.txt$/.test(face.license) || face.fsType !== 0) throw new Error('Invalid editable font manifest.');
    const bytes = await readFile(resolve(destination, '.' + face.file));
    if (bytes.length < 36 || bytes.readUInt16LE(34) !== 0x504c || bytes.readUInt32LE(0) !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== face.sha256) throw new Error(`Editable font integrity failed: ${face.family}`);
    await readFile(resolve(destination, '.' + face.license));
    const {ttf: _sourceTtf, sourceHashes: _sourceHashes, ...entry} = face;
    runtime.push(entry);
  }
  await mkdir(resolve(destination, 'fonts/pptx'), {recursive: true});
  await writeFile(resolve(destination, 'fonts/pptx/manifest.json'), JSON.stringify(runtime, null, 2) + '\n');
}
export async function copyRuntimeFonts(source, destination) {
  await mkdir(resolve(destination, 'fonts'), {recursive: true});
  await cp(resolve(source, 'fonts'), resolve(destination, 'fonts'), {recursive: true,
    filter: path => runtimePublicAsset(relative(source, path).split(sep).join('/'))});
  await writeRuntimeFontManifest(source, destination);
}
export function runtimePublicAssets() {
  let config;
  return {
    name: 'runtime-public-assets', apply: 'build',
    configResolved(resolved) { config = resolved; },
    async closeBundle() {
      if (!config || config.build.write === false) return;
      const source = resolve(config.root, 'public'), destination = resolve(config.root, config.build.outDir);
      // A local release can expose its output through a directory symlink.
      // Copy into the existing target without replacing that link.
      await mkdir(destination, {recursive: true});
      const target = await realpath(destination);
      await cp(source, target, {recursive: true, filter: path => runtimePublicAsset(relative(source, path).split(sep).join('/'))});
      await writeRuntimeFontManifest(source, target);
    },
  };
}
