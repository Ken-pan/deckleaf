import {writeFile,readFile} from 'node:fs/promises';
import {templateDeck} from '../src/core/templates';

// Preview data comes from the actual authored decks at build time. The welcome
// screen needs three covers, without generating or retaining their full stories.
const covers = ['portfolio','review','minimal'].map(collection => {
  const full = templateDeck(collection), slide = full.slides[0];
  const deck = {...full, slides: [slide], updatedAt: '2026-01-01T00:00:00.000Z'};
  const ids = [deck.id, slide.id, ...slide.elements.map(e=>e.id), ...(slide.groups??[]).map(g=>g.id), ...(slide.autoLayouts??[]).map(g=>g.id)];
  const names = new Map(ids.map((id,index)=>[id,`preview-${collection}-${index}`]));
  return JSON.parse(JSON.stringify(deck, (_key,value)=>typeof value==='string'?names.get(value)??value:value));
});
const target = new URL('../src/core/template-covers.json',import.meta.url), encoded = JSON.stringify(covers)+'\n';
if(process.argv.includes('--check')) {
  if(await readFile(target,'utf8')!==encoded)throw new Error('Template cover previews are stale. Run npm run build:previews.');
} else await writeFile(target, encoded);
console.log(`Prepared ${covers.length} canonical template covers (${(encoded.length/1000).toFixed(1)} KB).`);
