import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const root = new URL('../', import.meta.url), require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const counts = {};
for (const name of Object.keys(pkg.dependencies).filter(name => name.startsWith('@iconify-json/')).sort()) {
  const {version} = require(`${name}/package.json`);
  const data = JSON.parse(await readFile(require.resolve(`${name}/icons.json`), 'utf8'));
  counts[name.slice('@iconify-json/'.length)] = {version, count: Object.keys(data.icons).length};
}
await writeFile(new URL('server/icon-counts.json', root), JSON.stringify(counts, null, 2) + '\n');
console.log(`Indexed ${Object.keys(counts).length} icon collections without shipping their SVG bodies in the catalog.`);
