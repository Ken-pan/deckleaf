import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineFontSchema, blankSlide, element, newDeck, type OnlineFont } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { normalizeOnlineCatalog, onlineReference, parseOnlineCss, rangeContains, onlineFontUses, embeddedOnlineFonts } from '../src/core/online-fonts';
import { fontOperations, fontWeights } from '../src/core/fonts';

const font: OnlineFont = {id: 'figtree', family: 'Figtree', version: '5.3.0', category: 'sans', chinese: false,
  weights: [300,400,500,600,700,800,900], styles: ['normal', 'italic'], license: 'OFL-1.1', licenseNotice: 'Copyright test fixture. SIL OPEN FONT LICENSE Version 1.1.'};
const css = "@font-face {font-family: 'Figtree';font-style:normal;font-weight:400;src:url(./files/figtree-latin-400-normal.woff2);unicode-range:U+0000-00FF;}";
test('online catalogue accepts OFL and Apache licenses and excludes unsafe, local or unsupported entries', () => {
  const entry = {id: 'figtree', family: 'Figtree', category: 'sans-serif', license: 'OFL-1.1', weights: [400,700,1000], styles: ['normal'], subsets: ['latin']};
  const result = normalizeOnlineCatalog([entry, {...entry, id: 'apache-example', family: 'Apache Example', license: 'Apache-2.0'}, {...entry, license: 'commercial'}, {...entry, id: '../path'}, {...entry, family: 'Inter'}, {...entry, family: 'Bad;family'}, {...entry, category: 'icons'}]);
  assert.equal(result.length, 2); assert.deepEqual(result[0].weights, [400,700]); assert.equal(result[0].online, true);
  assert(result.some(f => f.licenseId === 'Apache-2.0'));
});
test('online references accept pinned versions and full license notices, not arbitrary URLs', () => {
  assert.deepEqual(OnlineFontSchema.parse(font), font);
  for (const patch of [{id: '../font'}, {version: 'latest'}, {version: '5.3.0/../'}, {family: 'Injected;style'}, {license: 'commercial'}, {licenseNotice: ''}]) assert.throws(() => OnlineFontSchema.parse({...font, ...patch}));
});
test('font registration and selected text changes form one atomic revision and preserve original content', () => {
  const slide = blankSlide(); slide.elements = [element('text', {text: 'Original content', fontWeight: 700, runs: [{text: 'Original ', bold: true}, {text: 'content', color: '#123456'}]})];
  const deck = newDeck('Online fonts', [slide]), before = JSON.stringify(deck);
  const view = {...deck, onlineFonts: [font]};
  const ops = fontOperations(view, slide.id, [slide.elements[0].id], font.family);
  const next = applyOperations(deck, [{op: 'register_online_font', font}, ...ops]);
  assert.equal(next.revision, 1); assert.deepEqual(next.onlineFonts, [font]); assert.equal(next.slides[0].elements[0].text, 'Original content');
  assert.equal(next.slides[0].elements[0].fontWeight, 700); assert.equal(next.slides[0].elements[0].runs?.[1].color, '#123456');
  assert.equal(JSON.stringify(deck), before);
  assert.throws(() => applyOperations(deck, [{op: 'register_online_font', font}, {op: 'delete_element', slideId: slide.id, elementId: 'missing'}]));
  assert.equal(JSON.stringify(deck), before); assert.throws(() => applyOperations(next, ops, 0));
  assert.deepEqual(fontWeights('Figtree', [], next.onlineFonts), font.weights);
});
test('online style files use fixed package paths and correctly match Latin, CJK and wildcard ranges', () => {
  const faces = parseOnlineCss(css, font, 400, 'normal'); assert.equal(faces.length, 1);
  assert.equal(faces[0].url, 'https://cdn.jsdelivr.net/npm/@fontsource/figtree@5.3.0/files/figtree-latin-400-normal.woff2');
  assert(rangeContains('U+4E00-9FFF', '设计')); assert(!rangeContains('U+0000-00FF', '设计')); assert(rangeContains('U+4??', 'Ж'));
  assert.throws(() => parseOnlineCss(css.replace('./files/figtree-latin-400-normal.woff2', 'https://untrusted.example/font.woff2'), font, 400, 'normal'));
});
test('paragraph font changes preserve bullets, spacing and run content while loading explicit run weights', () => {
  const slide = blankSlide(); slide.elements = [element('text', {text: 'Paragraph', paragraphs: [{align: 'right', bullet: '•', spaceBefore: 12, spaceAfter: 8, indent: 20, firstLineIndent: -10,
    runs: [{text: 'Paragraph', fontFamily: 'Arial', fontWeight: 500, color: '#123456', italic: true}]}]})];
  const deck = {...newDeck('Paragraphs', [slide]), onlineFonts: [font]};
  const next = applyOperations(deck, fontOperations(deck, slide.id, [slide.elements[0].id], 'Figtree'));
  const p = next.slides[0].elements[0].paragraphs![0];
  assert.equal(p.bullet, '•'); assert.equal(p.spaceBefore, 12); assert.equal(p.firstLineIndent, -10); assert.equal(p.runs[0].text, 'Paragraph');
  assert.equal(p.runs[0].fontFamily, 'Figtree'); assert.equal(p.runs[0].color, '#123456');
  assert.equal(onlineFontUses(next)[0].weight, 500); assert.equal(onlineFontUses(next)[0].style, 'italic');
});
test('reload and export identify rich-run weights, italics, table text, hidden objects and embedded-font precedence', () => {
  const slide = blankSlide(); slide.elements = [element('text', {text: 'Rich', fontFamily: 'Figtree', runs: [{text: 'Bold', bold: true}, {text: 'Italic', italic: true}]}), element('table', {fontFamily: 'Figtree', cells: [['Cell']]}), element('text', {fontFamily: 'Figtree', text: 'Hidden', hidden: true})];
  const deck = {...newDeck('Styles', [slide]), onlineFonts: [font]};
  const uses = onlineFontUses(deck); assert.equal(uses.length, 3); assert(uses.some(u => u.weight === 700 && u.sample === 'Bold')); assert(uses.some(u => u.style === 'italic'));
  assert(!uses.some(u => u.sample.includes('Hidden')));
  deck.fonts = [{family: 'Figtree', name: 'owned.woff2', data: 'data:font/woff2;base64,AA==', weight: '400', style: 'normal'}]; assert.equal(onlineFontUses(deck).length, 0);
});
test('portable HTML embeds online font bytes and verified complete licenses with no CDN dependency', async () => {
  const slide = blankSlide(); slide.elements = [element('text', {fontFamily: 'Figtree', text: 'Portable'})];
  const deck = {...newDeck('Portable', [slide]), onlineFonts: [font]};
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('metadata.json')) return Response.json({family: 'Figtree', category: 'sans-serif', subsets: ['latin'], weights: font.weights, styles: font.styles, license: {type: 'OFL-1.1'}});
    if (url.endsWith('/LICENSE')) return new Response(font.licenseNotice);
    if (url.endsWith('/400.css')) return new Response(css);
    if (url.endsWith('.woff2')) return new Response(new Uint8Array([119,79,70,50,0,1,2]));
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const result = (await embeddedOnlineFonts(deck)).join('\n'); assert.match(result, /data:font\/woff2;base64,/); assert.match(result, /SIL OPEN FONT LICENSE/); assert(!result.includes('https://cdn.'));
  } finally { globalThis.fetch = oldFetch; }
});

test('Google catalogue reuses bundled families and exposes Apache font provenance', () => {
  const fonts = normalizeOnlineCatalog([
    {id: 'permanent-marker', family: 'Permanent Marker', type: 'google', category: 'handwriting', license: 'Apache-2.0', weights: [400], styles: ['normal'], subsets: ['latin']},
    {id: 'inter', family: 'Inter', type: 'google', category: 'sans-serif', license: 'OFL-1.1', weights: [400,700], styles: ['normal'], subsets: ['latin']}
  ], true);
  const apache = fonts.find(f => f.family === 'Permanent Marker')!;
  assert.equal(apache.licenseId, 'Apache-2.0'); assert.equal(apache.provider, 'google'); assert.match(apache.source, /^https:\/\/fonts.google.com\/specimen\//);
  const bundled = fonts.find(f => f.family === 'Inter')!;
  assert(!bundled.online); assert.match(bundled.css, /^\/fonts\//); assert.equal(bundled.provider, 'google');
});
test('Apache Google fonts retain copyright, complete license and package NOTICE in documents and exported HTML', async () => {
  const entry = normalizeOnlineCatalog([{id: 'permanent-marker', family: 'Permanent Marker', type: 'google', category: 'handwriting', license: 'Apache-2.0', weights: [400], styles: ['normal'], subsets: ['latin']}])[0];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/version/')) return Response.json({latest: '5.3.0'});
    if (url.endsWith('metadata.json')) return Response.json({family: entry.family, type: 'google', category: 'handwriting', subsets: ['latin'], weights: [400], styles: ['normal'], license: {type: 'Apache-2.0', attribution: 'Copyright Font Diner'}});
    if (url.endsWith('/LICENSE')) return new Response('Apache License\nVersion 2.0, January 2004\nComplete license fixture');
    if (url.endsWith('/NOTICE')) return new Response('Required upstream attribution fixture');
    if (url.endsWith('/400.css')) return new Response(css.replaceAll('figtree', 'permanent-marker').replaceAll('Figtree', entry.family));
    if (url.endsWith('.woff2')) return new Response(new Uint8Array([119,79,70,50,0,1,2]));
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const reference = await onlineReference(entry);
    assert.equal(reference.license, 'Apache-2.0'); assert.equal(reference.provider, 'google'); assert.match(reference.licenseNotice, /Copyright Font Diner/); assert.match(reference.licenseNotice, /Required upstream attribution/);
    const slide = blankSlide(); slide.elements = [element('text', {fontFamily: entry.family, text: 'Portable'})];
    const html = (await embeddedOnlineFonts({...newDeck('Apache font', [slide]), onlineFonts: [reference]})).join('\n');
    assert.match(html, /Apache License/); assert.match(html, /Copyright Font Diner/); assert.match(html, /Required upstream attribution/); assert.match(html, /data:font\/woff2;base64,/);
  } finally { globalThis.fetch = oldFetch; }
});

test('binary font responses coalesce only in flight and reuse durable cache after releasing buffers',async()=>{
 const {onlineCatalog}=await import('../src/core/online-fonts');const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
 const entries=new Map<string,Response>();let network=0,reads=0;
 globalThis.caches={open:async()=>({match:async(url:string)=>{reads++;return entries.get(url)?.clone();},put:async(url:string,response:Response)=>{entries.set(url,response.clone());}})} as unknown as CacheStorage;
 globalThis.fetch=async()=>{network++;return Response.json([]);};
 try{
  await Promise.all([onlineCatalog(),onlineCatalog()]);assert.equal(network,1);assert.equal(reads,1);
  await onlineCatalog();assert.equal(network,1);assert.equal(reads,2);
 }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
