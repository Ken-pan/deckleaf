import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blankSlide, element, newDeck, validateDeck, ResourceAttributionSchema } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { DOODLES, resourceElement, resourceOperation, resourceQuery } from '../src/core/resources';
import {resourceReplacementPatch} from '../src/core/resource-replacement';
import { resourceCredits, exportBroadser } from '../src/core/export';
import { normalizePhoto, publicAddress, sanitizeSvg, imageMime, loadResource, iconSvg } from '../server/resources';
import { getIconData } from '@iconify/utils';

const source = {id: 'doodles:running', kind: 'illustration' as const, title: '奔跑', provider: 'Open Doodles', creator: 'Pablo Stanley', sourceUrl: 'https://www.opendoodles.com/', license: 'CC0 1.0', licenseUrl: 'https://www.opendoodles.com/about', attribution: '奔跑 — Pablo Stanley · CC0 1.0', attributionRequired: false};
test('asset defaults match their purpose and never enlarge small bitmap sources', () => {
  const deck = newDeck('Sizes', [blankSlide()]);
  const vector='data:image/svg+xml;base64,AA==', raster='data:image/png;base64,AA==';
  const icon=resourceElement(vector,{...source,kind:'icon'},24,24,deck);
  assert.equal(icon.w,64);assert.equal(icon.h,64);
  const illustration=resourceElement(vector,source,400,800,deck);
  assert.equal(illustration.w,160);assert.equal(illustration.h,320);
  const photo=resourceElement(raster,{...source,kind:'photo'},1920,1080,deck);
  assert.equal(photo.w,480);assert.equal(photo.h,270);
  const portrait=resourceElement(raster,undefined,1000,2000,deck);
  assert.equal(portrait.w,180);assert.equal(portrait.h,360);
  const small=resourceElement(raster,undefined,32,20,deck);
  assert.equal(small.w,32);assert.equal(small.h,20);
  const smallIllustration=resourceElement(raster,source,160,80,deck);
  assert.equal(smallIllustration.w,160);assert.equal(smallIllustration.h,80);
  const half=resourceElement(vector,{...source,kind:'icon'},24,24,{...deck,width:720,height:405});
  assert.equal(half.w,32);assert.equal(half.h,32);
  for(const dimensions of [[0,20],[20,0],[-1,20],[Infinity,20],[20,NaN]])assert.throws(()=>resourceElement(raster,undefined,dimensions[0],dimensions[1],deck));
});
test('provenance is optional for old documents and persists in document transactions', () => {
  const deck = newDeck('Resources', [blankSlide()]); validateDeck(deck);
  const image = resourceElement('data:image/svg+xml;base64,AA==', source, 1024, 768, deck);
  const next = applyOperations(deck, [resourceOperation(deck, deck.slides[0].id, image)]);
  assert.deepEqual(validateDeck(JSON.parse(JSON.stringify(next))).slides[0].elements[0].resource, source);
  assert.equal(deck.slides[0].elements.length, 0);
  assert.equal(image.w / image.h, 1024 / 768); assert(image.x >= 0 && image.y >= 0);
  assert.throws(() => ResourceAttributionSchema.parse({...source, sourceUrl: 'javascript:alert(1)'}));
});
test('replacement preserves layout, identity, rotation, fit and history source; rejects missing or locked targets', () => {
  const original = element('image', {src: 'data:image/png;base64,AA==', x: 25, y: 90, w: 300, h: 120, rotation: 17, fit: 'cover', sourceRegion:{left:.1,top:.2,right:.3,bottom:.2}, resource: {...source, title: 'Original'}});
  const slide = blankSlide(); slide.elements.push(original); const deck = newDeck('Replace', [slide]);
  const nextImage = resourceElement('data:image/svg+xml;base64,AB==', source, 24, 24, deck);
  const updated = applyOperations(deck, [resourceOperation(deck, slide.id, nextImage, original.id)]).slides[0].elements[0];
  for (const key of ['id', 'x', 'y', 'w', 'h', 'rotation', 'fit'] as const) assert.equal(updated[key], original[key]);
  assert.equal(updated.resource?.title, '奔跑'); assert.equal(original.resource?.title, 'Original');
  assert.equal(updated.sourceRegion,undefined);assert.equal(original.sourceRegion?.left,.1);assert.equal(updated.src,nextImage.src);
  const preview = {...original, ...resourceReplacementPatch(nextImage,{fit:original.fit})};
  assert.deepEqual(preview, updated);
  assert.equal(original.src, 'data:image/png;base64,AA==');
  assert.throws(() => resourceOperation(deck, slide.id, nextImage, 'missing'));
  deck.slides[0].elements[0].locked = true; assert.throws(() => resourceOperation(deck, slide.id, nextImage, original.id));
  assert.throws(() => resourceOperation(deck, 'missing', nextImage));
});
test('replacement fit and crop choices preview and commit together without changing the original frame', () => {
  const original = element('image', {src:'data:image/png;base64,AA==',x:70,y:90,w:400,h:220,fit:'contain',crop:{left:.1,right:.2,top:.05,bottom:.05},rotation:17,opacity:.7,resource:source});
  const slide=blankSlide();slide.elements.push(original);const deck=newDeck('Replace crop',[slide]);
  const image=resourceElement('data:image/svg+xml;base64,AB==',source,800,400,deck);
  const kept=applyOperations(deck,[resourceOperation(deck,slide.id,image,original.id)]).slides[0].elements[0];
  assert.equal(kept.crop,undefined);assert.equal(kept.fit,'contain');
  const options={fit:'cover' as const};
  const preview={...original,...resourceReplacementPatch(image,options)};
  const committed=applyOperations(deck,[resourceOperation(deck,slide.id,image,original.id,options)]).slides[0].elements[0];
  assert.deepEqual(preview,committed);assert.equal(committed.crop,undefined);assert.equal(committed.fit,'cover');
  for(const key of ['id','x','y','w','h','rotation','opacity'] as const)assert.equal(committed[key],original[key]);
  assert.equal(original.fit,'contain');assert.deepEqual(original.crop,{left:.1,right:.2,top:.05,bottom:.05});
});
test('replacement never inherits stretching or unequal crop scales, including explicit legacy options', () => {
  const original=element('image',{src:'data:image/png;base64,AA==',fit:'fill',w:500,h:200,crop:{left:.1,right:.2,top:.05,bottom:.05},sourceRegion:{left:0,right:0,top:0,bottom:0}});
  const slide=blankSlide();slide.elements.push(original);const deck=newDeck('Legacy stretch',[slide]);
  const portrait=resourceElement('data:image/svg+xml;base64,AB==',source,100,800,deck);
  for(const options of [undefined,{fit:'fill' as const}]){
    const updated=applyOperations(deck,[resourceOperation(deck,slide.id,portrait,original.id,options)]).slides[0].elements[0];
    assert.equal(updated.fit,'contain');assert.equal(updated.crop,undefined);assert.equal(updated.sourceRegion,undefined);
    assert.equal(updated.w,500);assert.equal(updated.h,200);assert.equal(updated.id,original.id);
  }
  assert.equal(original.fit,'fill');assert.deepEqual(original.crop,{left:.1,right:.2,top:.05,bottom:.05});
});
test('only the offered photo licenses and non-mature public images are imported', () => {
  const raw = {id: 'abefa1df-a6f9-40fb-9ef9-c471fb21cb92', url: 'https://example.org/image.jpg', foreign_landing_url: 'https://example.org/source', license: 'cc0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', title: 'Photo', creator: 'Photographer'};
  assert.equal(normalizePhoto(raw)?.license, 'CC0 1.0');
  const by = normalizePhoto({...raw, license: 'by', license_version: '4.0'}); assert.equal(by?.license, 'CC BY 4.0'); assert.equal(by?.attributionRequired, true);
  for (const license of ['by-nc', 'by-nd', 'by-sa', 'unknown']) assert.equal(normalizePhoto({...raw, license}), null);
  assert.equal(normalizePhoto({...raw, mature: true}), null);
  assert.equal(normalizePhoto({...raw, url: 'http://example.org/insecure.jpg'}), null);
});
test('resource fetches reject private addresses and arbitrary client URL or path input', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.4.2', '192.168.1.5', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('2606:4700:4700::1111'), true);
  for (const id of ['https://example.org', 'doodles:../../.env', 'iconify:lucide:../../.env', 'iconify:unknown:home']) await assert.rejects(loadResource(id));
});
test('SVG checks reject scripts, event handlers, external references and entity tricks', () => {
  const cases = ['<script>alert(1)</script>', '<g onload="alert(1)"/>', '<foreignObject/>', '<use href="https://example.org/x.svg"/>', '<use href="&#106;avascript:alert(1)"/>', '<path fill="url(https://example.org/a)"/>', '<style>@import "x"</style>'];
  for (const content of cases) assert.throws(() => sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`));
  assert.throws(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>'));
  assert(sanitizeSvg('<svg><defs><path id="a"/></defs><use href="#a"/></svg>'));
});
test('all 33 bundled Open Doodles validate, retain source paths and support accent replacement', async () => {
  assert.equal(DOODLES.length, 33);
  for (const [id] of DOODLES) {
    const original = await readFile(`public/resources/doodles/${id}.svg`, 'utf8'); sanitizeSvg(original);
    const data = await loadResource(`doodles:${id}`, '#123456');
    assert.equal(data.type, 'image/svg+xml'); assert.equal(data.resource.color, '#123456');
    assert.equal((data.bytes.toString().match(/<path\b/g) || []).length, (original.match(/<path\b/g) || []).length);
    assert(!/#FF5678/i.test(data.bytes.toString()));
  }
});
test('image signatures reject HTML or SVG masquerading as a photo', () => {
  assert.equal(imageMime(Buffer.from('<html>not an image</html>')), null);
  assert.equal(imageMime(Buffer.from('<svg></svg>')), null);
  assert.equal(imageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
});
test('batched icon data resolves aliases and preserves transformations and chosen color', () => {
  const icon = getIconData({prefix: 'sample', width: 24, height: 24, icons: {house: {body: '<path fill="currentColor" d="M1 1h5v5z"/>'}}, aliases: {home: {parent: 'house', rotate: 1}}}, 'home');
  assert(icon); const svg = iconSvg(icon, '#bc4f3c'); assert(svg.includes('#bc4f3c')); assert(svg.includes('transform=')); assert(!svg.includes('currentColor')); assert.throws(() => iconSvg(icon, 'red" onload="x'));
});
test('credits deduplicate reused resources and travel with notes in exports', () => {
  const deck = newDeck('Credits', [blankSlide()]);
  for (let i = 0; i < 2; i++) deck.slides[0].elements.push(resourceElement('data:image/svg+xml;base64,AA==', {...source, licenseNotice: 'Copyright notice'}, 24, 24, deck));
  const credits = resourceCredits(deck); assert.equal(credits.split('Copyright notice').length, 2);
  assert(exportBroadser(deck).cards[0].text.includes('Pablo Stanley')); assert(exportBroadser(deck).cards[0].text.includes('Copyright notice'));
  assert.equal(resourceQuery('建筑'), 'architecture'); assert.equal(resourceQuery('home'), 'home');
});

test('all ten offline icon collections search and import without external services', async () => {
  const {resourceCatalog, searchResources} = await import('../server/resources');
  const {blueBlackLibrary} = await import('../server/blue-black');
  const {graphicLibrary} = await import('../server/deck-graphics');
  const catalog = await resourceCatalog(); assert.equal(catalog.collections.length, 10); assert(catalog.iconCount > 45000); assert.equal(catalog.illustrationCount, 163 + (await blueBlackLibrary()).length + (await graphicLibrary()).length);
  for (const collection of catalog.collections) {
    const first = await searchResources(new URLSearchParams({kind: 'icon', set: collection.id, q: ''}));
    assert(first.items.length); const image = await loadResource(first.items[0].id, '#123456');
    assert.equal(image.type, 'image/svg+xml'); assert(image.resource.licenseNotice); assert(image.bytes.toString().includes('#123456'));
  }
});
test('offline search supports Chinese synonyms, style filters and disjoint result pages', async () => {
  const {searchResources} = await import('../server/resources');
  const translated = await searchResources(new URLSearchParams({kind: 'icon', set: 'ph', q: '搜索'})); assert(translated.items.length);
  const homes = await searchResources(new URLSearchParams({kind: 'icon', set: 'ph', q: 'home', style: 'solid'})); assert(homes.items.length); assert(homes.items.every(i => i.id.endsWith('-fill')));
  const one = await searchResources(new URLSearchParams({kind: 'icon', set: 'lucide', page: '1'})), two = await searchResources(new URLSearchParams({kind: 'icon', set: 'lucide', page: '2'}));
  assert(one.hasMore); assert(one.total && one.total > 1900); assert(!one.items.some(item => two.items.some(other => item.id === other.id)));
});
test('all new illustration imports preserve their verified author source and have no external image dependency', async () => {
  const {illustrationLibrary} = await import('../server/resource-catalog'); const records = await illustrationLibrary(); assert.equal(records.length, 130);
  for (const record of records) { const data = await loadResource(`illlustrations:${record.id}`); assert.equal(data.resource.sourceUrl, record.sourceUrl); assert.equal(data.resource.license, 'CC0 1.0'); assert(['image/svg+xml','image/png'].includes(data.type)); }
  const ticket = await loadResource('illlustrations:day34-ticket'); assert.equal(ticket.type, 'image/svg+xml'); assert(!/<image\b/.test(ticket.bytes.toString()));
});
test('illustration series and theme filters exclude unrelated collections and paginate safely', async () => {
  const {searchResources} = await import('../server/resources');
  const page = await searchResources(new URLSearchParams({kind: 'illustration', collection: 'illlustrations'})); assert.equal(page.total, 130); assert.equal(page.items.length, 48); assert(page.items.every(i => i.provider === 'illlustrations'));
  const nature = await searchResources(new URLSearchParams({kind: 'illustration', collection: 'all', category: 'nature'})); assert(nature.items.length); assert(nature.items.every(i => i.category === 'nature')); assert(!nature.items.some(i => i.title === 'map location'));
});
test('batch insertion groups all images in one atomic transaction and stays in panoramic and portrait canvases', async () => {
  const {resourceBatchOperations, MAX_RESOURCE_BATCH, validateResourceImport} = await import('../src/core/resources');
  for (const [width,height] of [[1440,810],[600,1000],[5000,200]]) {
    const deck = newDeck('Batch', [blankSlide()], width, height), slide = deck.slides[0];
    const images = Array.from({length:12}, (_,i) => resourceElement('data:image/png;base64,AA==', {...source,title:`Asset ${i}`}, i % 2 ? 400 : 1000, i % 2 ? 1000 : 400, deck));
    const operations = resourceBatchOperations(deck, slide.id, images), next = applyOperations(deck, operations);
    assert.equal(next.revision, 1); assert.equal(next.slides[0].elements.length,12); assert.equal(deck.slides[0].elements.length,0);
    assert.equal(new Set(next.slides[0].elements.map(e=>e.group)).size,1);
    for (const e of next.slides[0].elements) assert(e.x >= 0 && e.y >= 0 && e.x + e.w <= width + .001 && e.y + e.h <= height + .001);
    assert.throws(()=>resourceBatchOperations(deck,slide.id,[...images,images[0]])); assert.equal(MAX_RESOURCE_BATCH,12);
    assert.throws(()=>validateResourceImport(deck,operations,100)); assert.equal(deck.revision,0);
  }
});
test('favorites and recent entries keep safe metadata, strip transient image data and reject corrupt storage', async () => {
  const {shelfEntry,shelfItem,readShelf,rememberResource} = await import('../src/core/resource-shelf');
  const item = {...source,previewUrl:'data:image/svg+xml;base64,AA==',colorable:true,width:1024,height:768};
  const favorite = shelfEntry(item,'#123456'), raw = JSON.stringify([favorite]); assert(!raw.includes('data:image')); assert.equal(readShelf(raw).length,1); assert(shelfItem(favorite).previewUrl.startsWith('/api/resources/preview?id='));
  assert.deepEqual(readShelf('invalid'),[]); assert.equal(readShelf(JSON.stringify([{resource:{...source,id:'https://127.0.0.1'}}])).length,0);
  let recent:any[]=[]; for(let i=0;i<45;i++)recent=rememberResource(recent,{...item,id:`doodles:asset-${i}`},undefined,i); assert.equal(recent.length,40); assert.equal(recent[0].usedAt,44);
});
test('SVG raster references must be embedded image bytes and cannot execute SVG or load external files', () => {
  assert.throws(()=>sanitizeSvg('<svg><image href="file.png"/></svg>'));
  assert.throws(()=>sanitizeSvg('<svg><image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/></svg>'));
  assert.throws(()=>sanitizeSvg('<svg><image href="data:image/png;base64,PHNjcmlwdD4="/></svg>'));
});

test('malformed photo metadata is skipped without failing the entire results page', () => {
  const raw={id:'abefa1df-a6f9-40fb-9ef9-c471fb21cb92',url:'https://example.org/image.jpg',foreign_landing_url:'https://example.org/source',license:'by',license_version:'4.0',license_url:'https://creativecommons.org/licenses/by/4.0/'};
  assert.equal(normalizePhoto({...raw,license_url:null}),null); assert.equal(normalizePhoto({...raw,license_version:undefined}),null); assert(normalizePhoto(raw));
});
