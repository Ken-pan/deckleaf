import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

const br = promisify(brotliCompress), gz = promisify(gzip);
const extensions = new Set(['.js', '.mjs', '.css', '.html', '.json', '.svg', '.txt', '.ttf', '.otf']);
let files = 0, bytes = 0, compressedBytes = 0;
async function compress(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await compress(path); continue; }
    if (!extensions.has(extname(path))) continue;
    const original = await readFile(path);
    if (original.length < 1024) continue;
    const [brotli, zipped] = await Promise.all([
      br(original, {params: {[constants.BROTLI_PARAM_QUALITY]: 5}}), gz(original, {level: 6}),
    ]);
    if (brotli.length < original.length) await writeFile(path + '.br', brotli);
    if (zipped.length < original.length) await writeFile(path + '.gz', zipped);
    files++; bytes += original.length; compressedBytes += Math.min(original.length, brotli.length);
  }
}
await compress(process.env.DECK_STUDIO_BUILD_DIR || 'dist');
console.log(`Precompressed ${files} assets: ${(bytes / 1e6).toFixed(2)} MB → ${(compressedBytes / 1e6).toFixed(2)} MB (Brotli).`);
