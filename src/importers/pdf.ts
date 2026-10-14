import { element, blankSlide, newDeck, type Deck } from '../core/model';
export async function importPdf(data: ArrayBuffer | Uint8Array, name: string, progress = (_s: string) => {}): Promise<Deck> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = pdfjs.getDocument({data: new Uint8Array(data)});
  const pdf = await loadingTask.promise;
  if (pdf.numPages > 500) throw new Error('This PDF exceeds 500 pages. Import it in smaller batches.');
  const first = await pdf.getPage(1), v = first.getViewport({scale: 1});
  const width = 1440, height = Math.round(width * v.height / v.width), slides = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      progress(`Reading PDF · ${i} / ${pdf.numPages}`);
      const page = await pdf.getPage(i), base = page.getViewport({scale: 1});
      const viewport = page.getViewport({scale: Math.min(2, 1920 / base.width)});
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d')!;
      await page.render({canvasContext: context, viewport, canvas}).promise;
      const s = blankSlide(); s.background = '#ffffff';
      s.source = {provider: 'PDF', render: canvas.toDataURL('image/png'), fidelity: 'source-render', warnings: ['The source reference keeps static pages. The editable version extracts text only; fonts, images, and layout need rebuilding. PDF does not include animations or native objects.'], label: name};
      const text = await page.getTextContent();
      const factor = width / base.width;
      for (const item of text.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const t = pdfjs.Util.transform(base.transform, item.transform), size = Math.hypot(t[2], t[3]) * factor;
        s.elements.push(element('text', {text: item.str, x: t[4] * factor, y: t[5] * factor - size, w: Math.max(4, item.width * factor), h: size * 1.4, fontSize: Math.max(4, size), name: 'PDF text'}));
      }
      if (base.width / base.height !== v.width / v.height) s.source.warnings.push('This file contains different page sizes. Source references are scaled proportionally to the current canvas.');
      slides.push(s); page.cleanup();
    }
  } finally { await loadingTask.destroy(); }
  const d = newDeck(name.replace(/\.pdf$/i, ''), slides, width, height);
  d.provenance = {provider: 'PDF', filename: name, importedAt: new Date().toISOString()}; return d;
}
