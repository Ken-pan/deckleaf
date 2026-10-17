import type {Deck} from './model';
import {download, deckFilename} from './download';
import {slideLabel} from './slide-label';
import {resourceCredits} from './resource-credits';

// Format dispatch belongs to the export flow, rather than the startup shell.
// Each converter retains its own deferred loading boundary.
export async function downloadDocument(deck: Deck, kind: string, original: boolean): Promise<string> {
  const name = deckFilename(deck);
  if (kind === 'json') {
    const [{portableDeck}, {documentJsonBlob}] = await Promise.all([import('./portable-document'), import('./document-json')]);
    download(await documentJsonBlob(await portableDeck(deck), {space:2}), `${name}.deck.json`);
  } else if (kind === 'markdown') {
    const credits = resourceCredits(deck);
    download(`# ${deck.title}\n\n${deck.slides.map((slide, index) => `## ${slideLabel(index)}\n\n${slide.elements.filter(element => element.type === 'text').map(element => element.text).join('\n\n')}\n\n### Notes\n\n${slide.notes}`).join('\n\n---\n\n')}${credits ? `\n\n## Sources and licenses\n\n${credits}` : ''}`, `${name}.md`, 'text/markdown');
  } else {
    const exporter = await import('./export');
    if (kind === 'pptx') await exporter.exportPptx(deck, original);
    else if (kind === 'potx') await exporter.exportPptx(deck, false, true);
    else if (kind === 'pptx-source') await exporter.exportPptx(deck, true);
    else if (kind === 'keynote') return await exporter.exportKeynote(deck, original) || 'Download started';
    else if (kind === 'html') await exporter.exportHtml(deck, original);
    else if (kind === 'broadser') download(JSON.stringify(exporter.exportBroadser(deck), null, 2), `${name}.broadser.json`);
  }
  return 'Download started';
}
