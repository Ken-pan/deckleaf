import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {templateDeck} from '../src/core/templates';
import {validateDeck} from '../src/core/model';
const names={portfolio:'editorial',review:'studio',minimal:'minimalist',proposal:'monograph',pitch:'signal',report:'ledger'};
const counts=[];
for(const [collection,file] of Object.entries(names)){
 const deck=templateDeck(collection);
 for(const slide of deck.slides)for(const element of slide.elements){
  if(element.type!=='image'||!element.src.startsWith('/'))continue;
  if(!/^\/(?:examples\/template-assets|resources\/blue-black-v1)\/[\w/.-]+\.(?:png|jpg|svg)$/.test(element.src))throw Error('Unexpected template media');
  const bytes=await readFile(resolve('public','.'+element.src));
  const mime=element.src.endsWith('.jpg')?'image/jpeg':element.src.endsWith('.svg')?'image/svg+xml':'image/png';
  element.src=`data:${mime};base64,${bytes.toString('base64')}`;
 }
 validateDeck(deck);await writeFile(`public/website/assets/${file}.deck.json`,JSON.stringify(deck));counts.push({collection,file,slides:deck.slides.length});
}
await mkdir('output/website',{recursive:true});await writeFile('output/website/template-counts.json',JSON.stringify(counts,null,2));console.log(counts);
