function joinBytes(chunks:Uint8Array[],size:number){const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;}
import { ResourceAttributionSchema } from '../src/core/model';
import { attributionText, resourceMetadata, resourceQuery, isStockPhotoSource, unsplashImageUrl, type ResourceItem, type ResourcePage, type StockPhotoProvider, type PhotoProviderStatus, type EmbeddedResource } from '../src/core/resources';

const names = {unsplash: 'Unsplash', pexels: 'Pexels'};
const environment = {unsplash: 'UNSPLASH_ACCESS_KEY', pexels: 'PEXELS_API_KEY'};
const validId = (provider: StockPhotoProvider, id: string) => provider === 'unsplash' ? /^[\w-]{6,100}$/.test(id) : /^[1-9]\d{0,15}$/.test(id);
function officialUrl(raw: unknown, host: string) {
  try { const url = new URL(String(raw)); if (url.protocol === 'https:' && url.hostname === host && !url.username && !url.password && !url.port && !['client_id','access_key','api_key','secret'].some(key => url.searchParams.has(key))) return url; } catch { /* invalid provider response */ }
  return undefined;
}
function referral(raw: string) { const url = new URL(raw); url.searchParams.set('utm_source', 'deck_studio'); url.searchParams.set('utm_medium', 'referral'); return url.href; }
export type ProviderPhoto = ResourceItem & {imageUrl: string; thumbnailUrl: string; downloadLocation?: string};
export function normalizeStockPhoto(provider: StockPhotoProvider, raw: any): ProviderPhoto | null {
  const id = String(raw?.id || ''); if (!validId(provider, id) || raw?.premium || raw?.plus) return null;
  const unsplash = provider === 'unsplash';
  const source = officialUrl(unsplash ? raw.links?.html : raw.url, unsplash ? 'unsplash.com' : 'www.pexels.com');
  const profile = officialUrl(unsplash ? raw.user?.links?.html : raw.photographer_url, unsplash ? 'unsplash.com' : 'www.pexels.com');
  const image = unsplash ? String(raw.urls?.regular || '') : String(raw.src?.large2x || raw.src?.large || '');
  const preview = unsplash ? String(raw.urls?.small || '') : String(raw.src?.medium || '');
  if (!source || !profile || !(unsplash ? unsplashImageUrl(image) && unsplashImageUrl(preview) : officialUrl(image, 'images.pexels.com') && officialUrl(preview, 'images.pexels.com'))) return null;
  const download = unsplash ? officialUrl(raw.links?.download_location, 'api.unsplash.com') : undefined;
  if (unsplash && (!download || download.pathname !== `/photos/${id}/download`)) return null;
  const resource = ResourceAttributionSchema.safeParse({id: `${provider}:${id}`, kind: 'photo', provider: names[provider], title: String((unsplash ? raw.alt_description || raw.description : raw.alt) || 'Untitled photo').slice(0, 1000), creator: String((unsplash ? raw.user?.name : raw.photographer) || '').slice(0, 500), sourceUrl: unsplash ? referral(source.href) : source.href, creatorUrl: unsplash ? referral(profile.href) : profile.href, license: `${names[provider]} License`, licenseUrl: `https://${unsplash ? 'unsplash.com' : 'www.pexels.com'}/license${unsplash ? '' : '/'}`, attributionRequired: true, attribution: '', licenseNotice: unsplash ? 'Unsplash requires photographer credit, a profile link, and an Unsplash link. Images use official online URLs and are not CC0.' : 'Pexels License applies; these images are not CC0. Keep photographer and Pexels links. Do not resell unmodified images or redistribute them as a stock library.'});
  if (!resource.success || !resource.data.creator) return null;
  return {...resource.data, attribution: `${attributionText(resource.data)}\nPhotographer: ${resource.data.creatorUrl}`, previewUrl: unsplash ? preview : `/api/resources/preview?id=pexels:${id}`, imageUrl: image, thumbnailUrl: preview, downloadLocation: download?.href, width: Number(raw.width) > 0 ? Number(raw.width) : undefined, height: Number(raw.height) > 0 ? Number(raw.height) : undefined};
}

export class PhotoProviders {
  private sessions = new Map<StockPhotoProvider, string>();
  private photos = new Map<string, ProviderPhoto>();
  private pages = new Map<string, {expires: number; page: ResourcePage}>();
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args), private env: Record<string,string|undefined> = typeof process === 'undefined' ? {} : process.env) {}
  private key(provider: StockPhotoProvider) { return this.sessions.get(provider) || this.env[environment[provider]] || ''; }
  status(): PhotoProviderStatus[] { return (['unsplash', 'pexels'] as const).map(id => ({id, label: names[id], configured: Boolean(this.key(id)), configuration: this.sessions.has(id) ? 'session' : this.env[environment[id]] ? 'environment' : 'none'})); }
  private async json(provider: StockPhotoProvider, raw: string, override?: string): Promise<any> {
    const key = override || this.key(provider); if (!key) throw Object.assign(new Error(`Connect ${names[provider]} first, or download a photo from the provider’s website and upload it.`), {status: 409});
    const url = officialUrl(raw, provider === 'unsplash' ? 'api.unsplash.com' : 'api.pexels.com'); if (!url) throw new Error('Invalid photo API URL.');
    let response: Response;
    try { response = await this.fetcher(url.href, {redirect: 'error', signal: AbortSignal.timeout(15000), headers: {Authorization: provider === 'unsplash' ? `Client-ID ${key}` : key, ...(provider === 'unsplash' ? {'Accept-Version': 'v1'} : {})}}); }
    catch { throw Object.assign(new Error(`${names[provider]} Could not connect. Try again later.`), {status: 502}); }
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error(response.status === 401 || response.status === 403 ? `${names[provider]} Invalid credentials or insufficient access. Check the connection settings.` : response.status === 429 ? `${names[provider]} The request limit has been reached. Try again later or switch providers.` : `${names[provider]} is unavailable. Try again later.`), {status: response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 409 : 502}); }
    if (Number(response.headers.get('content-length')) > 3_000_000) { await response.body?.cancel(); throw new Error('The photo provider response is too large.'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('The photo provider returned an empty response.'); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 3_000_000) throw new Error('The photo provider response is too large.'); chunks.push(part.value); } try { return JSON.parse(new TextDecoder().decode(joinBytes(chunks,size))); } catch { throw new Error(`${names[provider]} Invalid response format.`); } }
    finally { await reader.cancel(); }
  }
  async configure(raw: unknown) {
    const value = raw as any, provider = value?.provider;
    if (!isStockPhotoSource(provider)) throw Object.assign(new Error('Unsupported photo provider.'), {status: 422});
    if (typeof value.key !== 'string') throw Object.assign(new Error('Enter photo provider credentials.'), {status: 422});
    const key = value.key.trim(); if (key && !/^[\w-]{16,500}$/.test(key)) throw Object.assign(new Error('Invalid credential format.'), {status: 422});
    if (key) { await this.json(provider, provider === 'unsplash' ? 'https://api.unsplash.com/photos?per_page=1' : 'https://api.pexels.com/v1/curated?per_page=1', key); this.sessions.set(provider, key); }
    else this.sessions.delete(provider);
    this.pages.clear(); this.photos.clear(); return this.status();
  }
  private remember(photo: ProviderPhoto) { this.photos.delete(photo.id); this.photos.set(photo.id, photo); if (this.photos.size > 300) this.photos.delete(this.photos.keys().next().value!); }
  async search(provider: StockPhotoProvider, params: URLSearchParams): Promise<ResourcePage> {
    if (!this.key(provider)) throw Object.assign(new Error(`Connect ${names[provider]}`), {status: 409});
    const page = Math.max(1, Math.min(50, Math.floor(Number(params.get('page')) || 1))), query = resourceQuery(params.get('q') || '') || 'nature';
    const key = `${provider}:${params}`; const cached = this.pages.get(key); if (cached && cached.expires > Date.now()) return cached.page;
    const args = new URLSearchParams(provider === 'unsplash' ? {query, page: String(page), per_page: '20', content_filter: 'high'} : {query, page: String(page), per_page: '20'});
    const orientation = ({wide: 'landscape', tall: 'portrait', square: provider === 'unsplash' ? 'squarish' : 'square'} as Record<string,string>)[params.get('aspect') || '']; if (orientation) args.set('orientation', orientation);
    const data = await this.json(provider, `${provider === 'unsplash' ? 'https://api.unsplash.com/search/photos' : 'https://api.pexels.com/v1/search'}?${args}`);
    const photos = (provider === 'unsplash' ? data.results : data.photos); if (!Array.isArray(photos)) throw new Error('The photo provider returned an invalid result.');
    const items = photos.map(raw => normalizeStockPhoto(provider, raw)).filter((item): item is ProviderPhoto => Boolean(item)); for (const item of items) this.remember(item);
    const total = Math.max(0, Number(provider === 'unsplash' ? data.total : data.total_results) || 0);
    const result = {items: items.map(({imageUrl, thumbnailUrl, downloadLocation, ...item}) => item), page, total, hasMore: page < 50 && (provider === 'unsplash' ? page < Number(data.total_pages || 1) : Boolean(data.next_page))};
    this.pages.set(key, {expires: Date.now() + 300_000, page: result}); if (this.pages.size > 40) this.pages.delete(this.pages.keys().next().value!); return result;
  }
  async photo(id: string): Promise<ProviderPhoto> {
    const [provider, name, extra] = id.split(':'); if (!isStockPhotoSource(provider) || extra || !validId(provider, name || '')) throw new Error('Invalid photo ID.');
    const cached = this.photos.get(id); if (cached) return cached;
    const raw = await this.json(provider, `${provider === 'unsplash' ? 'https://api.unsplash.com/photos/' : 'https://api.pexels.com/v1/photos/'}${name}`);
    const item = normalizeStockPhoto(provider, raw); if (!item || item.id !== id) throw new Error('Invalid photo details.'); this.remember(item); return item;
  }
  async importUnsplash(id: string): Promise<EmbeddedResource> {
    const photo = await this.photo(id); if (!id.startsWith('unsplash:') || !photo.downloadLocation) throw new Error('Invalid photo ID.');
    await this.json('unsplash', photo.downloadLocation);
    return {src: photo.imageUrl, resource: resourceMetadata(photo)};
  }
}
export const photoProviders = new PhotoProviders();
