// Fictional data only. No portfolio, customer, or research material is bundled.
const art = (id: string) => ({src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dfe6dd"/><text x="32" y="80">${id}</text></svg>`).toString('base64')}`, alt: `Synthetic image ${id}`, caption: `Fictional image ${id}`});
type SampleSlide = {id: string; title: string; body: string; kicker: string; template: string; narration: {script: string}; artifact?: ReturnType<typeof art>; items: {label: string; title: string; body: string; artifact?: ReturnType<typeof art>}[]; choices?: {label: string; text: string; chosen: boolean}[]; meta?: {label: string; value: string}[]};
export const structuredSamples: {slug: string; raw: {title: string; slides: SampleSlide[]}}[] = [12, 8, 10].map((count, document) => ({
  slug: `sample-${document + 1}`,
  raw: {title: `Fictional project ${document + 1}`, slides: Array.from({length: count}, (_, page) => {
    const id = `sample-${document + 1}-page-${page + 1}`;
    return {id, title: `Sample heading ${page + 1}`, body: 'A short fictional explanation.', kicker: 'SYNTHETIC SAMPLE',
      template: page === 1 ? 'gallery' : page === 2 ? 'sequence' : 'split',
      narration: {script: `Fictional speaker notes for ${id}.`},
      ...(page === 1 ? {items: Array.from({length: 4}, (_, image) => ({label: `Image ${image + 1}`, title: `Sample artifact ${image + 1}`, body: 'An invented caption.', artifact: art(`${id}-image-${image + 1}`)}))}
        : page === 2 ? {artifact: art(`${id}-sequence`), activeItemIndex: 0, items: [{label: 'Step 1', title: 'An invented step', body: 'Synthetic sequence description.'}]}
        : {items: [{label: 'Point 1', title: 'Sample observation', body: 'Invented supporting text.'}], choices: [{label: 'Option A', text: 'A fictional design choice', chosen: true}], meta: [{label: 'Context', value: 'Synthetic test data'}]}),
    };
  })},
}));
