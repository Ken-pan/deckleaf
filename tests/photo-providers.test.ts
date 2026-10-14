import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhotoProviders, normalizeStockPhoto } from '../server/photo-providers';
import { resourceElement, resourceBatchOperations, resourceMetadata, PHOTO_SOURCES } from '../src/core/resources';
import { newDeck, blankSlide } from '../src/core/model';
import { applyOperations } from '../src/core/operations';
import { shelfEntry, shelfItem, readShelf } from '../src/core/resource-shelf';
import { resourceCredits } from '../src/core/export';
const unsplash = {id: 'LBI7cgq3pbM', width: 1200, height: 800, alt_description: 'Forest', urls: {small: 'https://images.unsplash.com/photo-demo?ixid=retained&w=400', regular: 'https://images.unsplash.com/photo-demo?ixid=retained&w=1080'}, user: {name: 'Example Author', links: {html: 'https://unsplash.com/@example'}}, links: {html: 'https://unsplash.com/photos/LBI7cgq3pbM', download_location: 'https://api.unsplash.com/photos/LBI7cgq3pbM/download?ixid=retained'}};
const pexels = {id: 3573351, width: 1200, height: 800, alt: 'Rocks', photographer: 'Example Photographer', photographer_url: 'https://www.pexels.com/@example', url: 'https://www.pexels.com/photo/rocks-3573351/', src: {medium: 'https://images.pexels.com/photos/3573351/photo.jpg?w=400', large2x: 'https://images.pexels.com/photos/3573351/photo.jpg?w=1600'}};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type':'application/json'}});
const key = 'test-only-credential-1234567890';
test('stock photos carry distinct licenses, linked authors and safe provider URLs; reject premium and URL substitution', () => {
  const a = normalizeStockPhoto('unsplash', unsplash)!; assert.equal(a.license, 'Unsplash License'); assert.equal(a.attributionRequired, true); assert.ok(a.previewUrl.startsWith('https://images.unsplash.com')); assert.ok(a.creatorUrl?.includes('utm_source=deck_studio')); assert.match(a.downloadLocation!, /ixid=retained/);
  assert.equal(normalizeStockPhoto('unsplash', {...unsplash, premium: true}), null);
  assert.equal(normalizeStockPhoto('unsplash', {...unsplash, links: {...unsplash.links, download_location: 'https://attacker.test/download'}}), null);
  assert.equal(normalizeStockPhoto('unsplash', {...unsplash, urls:{...unsplash.urls, small:'https://images.unsplash.com/photo?client_id=secret'}}), null);
  assert.equal(normalizeStockPhoto('pexels', {...pexels, src:{...pexels.src, large2x:'http://127.0.0.1/private'}}), null);
  const b = normalizeStockPhoto('pexels', pexels)!; assert.equal(b.license,'Pexels License'); assert.equal(b.previewUrl,'/api/resources/preview?id=pexels:3573351'); assert.match(b.attribution,/Example Photographer/);
});
test('server credentials are validated before connection, only readiness is returned, disconnect removes session configuration', async () => {
  const requests: {url: string; init?: RequestInit}[] = [];
  const service = new PhotoProviders((async(url,init)=>{requests.push({url:String(url),init});return json([]);}) as typeof fetch, {});
  await service.configure({provider:'unsplash',key}); assert.equal(service.status()[0].configuration,'session'); assert.equal((requests[0].init?.headers as any).Authorization,`Client-ID ${key}`); assert.equal(requests[0].init?.redirect,'error'); assert.ok(!JSON.stringify(service.status()).includes(key));
  await service.configure({provider:'unsplash',key:''}); assert.equal(service.status()[0].configured,false);
  await assert.rejects(service.configure({provider:'wrong',key}),/Unsupported/); await assert.rejects(service.configure({provider:'pexels',key:'short'}),/format/);
  const failed = new PhotoProviders((async()=>json({errors:[key]},401)) as typeof fetch, {}); await assert.rejects(failed.configure({provider:'unsplash',key}),e=>!(e as Error).message.includes(key)); assert.equal(failed.status()[0].configured,false);
});
test('search preserves safe orientation, Chinese query translation and pagination without exposing keys or private response fields', async () => {
  const requests:string[]=[];const service = new PhotoProviders((async url=>{requests.push(String(url));return String(url).includes('pexels')?json({photos:[pexels],total_results:43,next_page:'next'}):json({results:[unsplash],total:43,total_pages:3});}) as typeof fetch,{UNSPLASH_ACCESS_KEY:key,PEXELS_API_KEY:key});
  const result=await service.search('unsplash',new URLSearchParams({q:'自然',aspect:'square',page:'2'})); assert.equal(result.hasMore,true); assert.equal(result.total,43); const url=new URL(requests[0]);assert.equal(url.searchParams.get('query'),'nature');assert.equal(url.searchParams.get('orientation'),'squarish');assert.equal(url.searchParams.get('content_filter'),'high');assert.equal(url.searchParams.get('page'),'2'); assert.ok(!JSON.stringify(result).includes(key));assert.ok(!('downloadLocation' in result.items[0]));
  const b=await service.search('pexels',new URLSearchParams({q:'山',aspect:'wide'}));assert.equal(b.items[0].provider,'Pexels');assert.match(requests.at(-1)!,/orientation=landscape/);
  const unavailable=new PhotoProviders((async()=>json({})) as typeof fetch,{});await assert.rejects(unavailable.search('unsplash',new URLSearchParams()),/Connect/);
});
test('Unsplash import uses the direct API image and fires the original download event on every selection, never on preview', async () => {
  const calls:string[]=[];const service=new PhotoProviders((async url=>{calls.push(String(url));return String(url).includes('/download')?json({url:'https://images.unsplash.com/download'}):json(unsplash);}) as typeof fetch,{UNSPLASH_ACCESS_KEY:key});
  await service.photo('unsplash:LBI7cgq3pbM');assert.equal(calls.length,1);const first=await service.importUnsplash('unsplash:LBI7cgq3pbM');const second=await service.importUnsplash('unsplash:LBI7cgq3pbM');assert.equal(first.src,unsplash.urls.regular);assert.equal(first.src,second.src);assert.equal(calls.filter(url=>url.includes('/download?ixid=retained')).length,2);assert.ok(!JSON.stringify(first).includes('download_location'));
  await assert.rejects(service.photo('unsplash:../private'),/Invalid/);await assert.rejects(service.photo('pexels:1:2'),/Invalid/);
});
test('provider quota and malformed errors stay actionable without leaking upstream body or credentials',async()=>{
 const quota=new PhotoProviders((async()=>json({message:key},429)) as typeof fetch,{PEXELS_API_KEY:key});await assert.rejects(quota.search('pexels',new URLSearchParams()),e=>(e as any).status===429&&!(e as Error).message.includes(key));
 const malformed=new PhotoProviders((async()=>new Response(key)) as typeof fetch,{PEXELS_API_KEY:key});await assert.rejects(malformed.search('pexels',new URLSearchParams()),/Invalid response format/);
});
test('favorite previews survive service restarts as safe direct CDN URLs and reject arbitrary URLs or credentials',()=>{
 const item=normalizeStockPhoto('unsplash',unsplash)!;const entry=shelfEntry(item);const restored=readShelf(JSON.stringify([entry]));assert.equal(shelfItem(restored[0]).previewUrl,unsplash.urls.small);
 const corrupt=readShelf(JSON.stringify([{...entry,remotePreview:'https://attacker.test/private'},{...shelfEntry(normalizeStockPhoto('pexels',pexels)!),remotePreview:'https://images.unsplash.com/photo-demo'}]));assert.equal(corrupt[0].remotePreview,undefined);assert.equal(corrupt[1].remotePreview,undefined);
});
test('provider metadata persists through shared atomic transactions and exports without transient endpoints or keys',()=>{
 const d=newDeck('Photo providers',[blankSlide()]);const photo=normalizeStockPhoto('unsplash',unsplash)!;const image=resourceElement(photo.imageUrl,resourceMetadata(photo),1200,800,d);const result=applyOperations(d,resourceBatchOperations(d,d.slides[0].id,[image]),d.revision);assert.equal(result.slides[0].elements[0].src,photo.imageUrl);assert.ok(!JSON.stringify(result).includes('downloadLocation'));assert.match(resourceCredits(result),/Photographer: https:\/\/unsplash.com\/@example/);assert.ok(!JSON.stringify(result).includes(key));
 const ids=PHOTO_SOURCES.map(s=>s.id);for(const id of ['unsplash','pexels','nasa','rawpixel','europeana','smithsonian_air_and_space_museum'])assert.ok(ids.includes(id));
});

test('archival sources include uncategorized collection images while general search retains photo and license filters',async()=>{
 const {openverseSearchParams}=await import('../server/resources');
 const archive=openverseSearchParams(new URLSearchParams({source:'europeana'}));assert.equal(archive.get('category'),null);assert.equal(archive.get('q'),null);assert.equal(archive.get('license'),'cc0,pdm');
 const explicit=openverseSearchParams(new URLSearchParams({source:'smithsonian_air_and_space_museum',q:'飞机',license:'by'}));assert.equal(explicit.get('q'),'airplane');assert.equal(explicit.get('license'),'by');
 const defaultSearch=openverseSearchParams(new URLSearchParams());assert.equal(defaultSearch.get('category'),'photograph');assert.equal(defaultSearch.get('q'),'architecture');assert.throws(()=>openverseSearchParams(new URLSearchParams({source:'unsplash'})),/Unsupported/);
});
