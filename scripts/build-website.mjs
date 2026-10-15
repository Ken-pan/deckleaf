import { cp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { publicOrigin } from './public-origin.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'public/website');
const origin = publicOrigin();
for (const [from,to] of [
  ['public/brand/logo.svg','logo.svg'],['public/favicon.svg','favicon.svg'],
  ['public/brand/apple-touch-icon.png','apple-touch-icon.png'],
  ['public/fonts/inter.ttf','inter.ttf'],['public/fonts/manrope.ttf','manrope.ttf'],
  ['public/fonts/bodoni-moda.ttf','bodoni-moda.ttf'],
  ['public/fonts/Inter-OFL.txt','Inter-OFL.txt'],['public/fonts/Manrope-OFL.txt','Manrope-OFL.txt'],
  ['public/fonts/Bodoni-Moda-OFL.txt','Bodoni-Moda-OFL.txt'],
]) await cp(resolve(root,from),resolve(source,'assets',to));
// Public marketing assets only; the browser build adds its separate editor entry.
const out = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'output/website/dist');
await mkdir(out, { recursive: true });
await cp(source, out, { recursive: true });
// Apply the deployment origin to every website document, including downloadable
// templates, attribution in the presentation, and crawler metadata.
async function updateOrigin(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await updateOrigin(path);
    else if (/\.(?:html|json|xml|txt)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      const updated = source.replaceAll('https://decksprig.kens-toolbox.com', origin);
      if (updated !== source) await writeFile(path, updated);
    }
  }
}
await updateOrigin(out);
for (const name of ['privacy.html','licenses.html','legal.css','licenses']) await cp(resolve(root,'public',name),resolve(out,name),{recursive:true});
await mkdir(resolve(out,'fonts'),{recursive:true});
for (const name of ['inter.ttf','Inter-OFL.txt']) await cp(resolve(root,'public/fonts',name),resolve(out,'fonts',name));
await mkdir(resolve(out,'brand'),{recursive:true});
await cp(resolve(root,'public/brand/logo.svg'),resolve(out,'brand/logo.svg'));
const required = ['index.html','site.css','site.js','demo.html','presentation.html','guide.html','guide.zh-CN.html','guide.css','assets/decksprig-demo.mp4','assets/editor-light.jpg','assets/editor-dark.jpg','assets/portfolio.jpg','assets/review.jpg','assets/proposal.jpg','assets/pitch.jpg','assets/report.jpg','assets/social.jpg','assets/editorial.deck.json','assets/studio.deck.json','assets/monograph.deck.json','assets/signal.deck.json','assets/ledger.deck.json','assets/logo.svg','assets/favicon.svg','assets/inter.ttf','assets/manrope.ttf','assets/bodoni-moda.ttf'];
for (const name of required) await stat(resolve(out,name));
const html = await readFile(resolve(out,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const path = match[1].split(/[?#]/)[0];
  if (!/^(https?:|#)/.test(match[1]) && path !== '/app') await stat(resolve(out,path.replace(/^\//,'')));
}
const manifest = {};
async function inspect(dir,prefix='') {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = resolve(dir,entry.name), key = prefix+entry.name;
    if(entry.isDirectory())await inspect(path,key+'/');
    else {const bytes=await readFile(path);manifest[key]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
  }
}
await inspect(out);
await writeFile(resolve(root,'output/website/build-manifest.json'),JSON.stringify({origin,files:manifest},null,2));
console.log(`Website ready: ${out} (${Object.keys(manifest).length} files).`);
