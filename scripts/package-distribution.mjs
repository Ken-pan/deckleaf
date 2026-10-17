import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {projectRoot, distributionOutput, freshOutput, inventory, packageManifest, exportSources, archivePackage} from './distribution.mjs';
const index = process.argv.indexOf('--output');
if (index >= 0 && !process.argv[index + 1]) throw new Error('Missing output directory.');
const output = distributionOutput(index >= 0 ? process.argv[index + 1] : resolve(projectRoot, 'output/distribution', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid));
await freshOutput(output);
const app = resolve(output, 'app'), website = resolve(output, 'website');
// Keep generators sequential: they own shared generated brand/plugin outputs.
execFileSync('npm', ['run', 'build'], {cwd: projectRoot, env: {...process.env, DECK_STUDIO_BUILD_DIR: app}, stdio: 'inherit'});
execFileSync(process.execPath, ['scripts/build-website.mjs', website], {cwd: projectRoot, stdio: 'inherit'});
execFileSync(process.execPath, ['scripts/compress-assets.mjs'], {cwd: projectRoot, env: {...process.env, DECK_STUDIO_BUILD_DIR: website}, stdio: 'inherit'});
const reports = {app: await packageManifest(app, 'offline-app-assets'), website: await packageManifest(website, 'website'), 'export-sources': await exportSources(projectRoot, resolve(output, 'export-sources'))};
const archives = {};
for (const name of Object.keys(reports)) archives[name] = await archivePackage(output, name, `decksprig-${name}.tar.gz`);
const packages = {};
for (const [name, report] of Object.entries(reports)) {
  const files = await inventory(resolve(output, name));
  packages[name] = {kind: report.kind, files: Object.keys(files).length, unpackedBytes: Object.values(files).reduce((sum,file)=>sum+file.bytes,0), archive: archives[name]};
}
await writeFile(resolve(output, 'release.json'), JSON.stringify({format: 'decksprig-distribution/1', packages, totalUnpackedBytes: Object.values(packages).reduce((sum,p)=>sum+p.unpackedBytes,0), totalArchiveBytes: Object.values(archives).reduce((sum,a)=>sum+a.bytes,0)}, null, 2) + '\n');
await writeFile(resolve(output, 'SHA256SUMS'), Object.values(archives).map(a=>`${a.sha256}  ${a.file}\n`).join(''));
await writeFile(resolve(output, 'README.md'), '# Decksprig distribution packages\n\napp/ contains the existing local editor frontend and runtime resources, including full offline HTML/PPTX/POTX export fonts and original template media. It requires the repository Node service (DECK_STUDIO_DIST pointing to app/); Node, server source/dependencies, user documents and native conversion tools are outside these asset archives, as they were outside the prior Vite dist.\n\nwebsite/ is the independent marketing site. Its /app link is a deployment integration point; use the existing build:web command when assembling the compatible combined browser hosting layout. This command does not deploy either package.\n\nexport-sources/ retains original TTF faces, source manifest, licenses, generator and hashed inputs. It is optional for runtime use and is not a downloadable dependency of exports. Source manifests keep their original paths inside that package.\n\nrelease.json reports each unpacked and archived size plus aggregate totals. Keep SHA256SUMS with the tar.gz files. Existing source assets and documents are never removed by this packager.\n');
console.log(JSON.stringify({output, packages}, null, 2));
