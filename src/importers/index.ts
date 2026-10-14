import {isBrowserEdition} from '../core/runtime';
import { uid, type Deck } from '../core/model';
import { importJson } from './structured';
import {importGoogleBundle} from './google-native';

export async function importFile(file: File, progress = (_s: string) => {}): Promise<Deck> {
  if (file.size > 100_000_000) throw new Error('Import files smaller than 100 MB.');
  let deck: Deck;
  if (/\.json$/i.test(file.name)) {const raw=JSON.parse(await file.text());
    if(raw.kind==='google-rest'&&!raw.googleSource){const response=await fetch('/api/import/google/source',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});const data=await response.json();if(!response.ok)throw new Error(data.error);raw.googleSource=data.googleSource;}
    deck=raw.kind==='google-rest'?await importGoogleBundle(raw):importJson(raw);}
  else if (/\.pdf$/i.test(file.name)) {
    const {importPdf} = await import('./pdf'); deck = await importPdf(await file.arrayBuffer(), file.name, progress);
  } else if (/\.pptx$/i.test(file.name)) {
    progress('Extracting PPTX objects…');
    const {importPptx} = await import('./pptx'); deck = await importPptx(await file.arrayBuffer(), file.name);
    if (!isBrowserEdition) try {
      progress('Creating source references…');
      const response = await fetch('/api/convert', {method: 'POST', headers: {'X-Filename': encodeURIComponent(file.name)}, body: file});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const {importPdf} = await import('./pdf');
      const pdf = await importPdf(Uint8Array.from(atob(data.pdf), x => x.charCodeAt(0)), file.name, progress);
      deck.slides.forEach((s, i) => { if (s.source && pdf.slides[i]) { s.source.render = pdf.slides[i].source?.render; s.source.warnings.push(data.warning); } });
    } catch (e: any) { deck.slides.forEach(s => s.source?.warnings.push(`Source reference unavailable: ${e.message}`)); }
    else deck.slides.forEach(s => s.source?.warnings.push('Browser import preserves editable PowerPoint objects. Desktop source rendering is available in the local edition.'));
  } else if (/\.key$/i.test(file.name)) {
    if(isBrowserEdition)throw new Error('Export the Keynote file as PowerPoint or PDF, then import it here. Native Keynote conversion requires the local Mac edition.');
    progress('Converting with Keynote…');
    const response = await fetch('/api/convert', {method: 'POST', headers: {'X-Filename': encodeURIComponent(file.name)}, body: file});
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    const {importPptx} = await import('./pptx');
    deck = await importPptx(Uint8Array.from(atob(data.pptx), x => x.charCodeAt(0)), file.name);
    const {importPdf} = await import('./pdf');
    const pdf = await importPdf(Uint8Array.from(atob(data.pdf), x => x.charCodeAt(0)), file.name, progress);
    deck.slides.forEach((s, i) => { s.source = {provider: 'Keynote', render: pdf.slides[i]?.source?.render, fidelity: 'source-render', warnings: [...(s.source?.warnings ?? []), data.warning]}; });
    deck.provenance = {...deck.provenance,provider: 'Keynote', filename: file.name, importedAt: new Date().toISOString()};
    deck.nativeSource = data.nativeSource;
  } else throw new Error('Import a PPTX, KEY, PDF, or Deck JSON file. For Figma .deck files, use a file link or the export plugin.');
  deck.id = uid('deck'); deck.revision = 0; deck.updatedAt = new Date().toISOString(); return deck;
}
