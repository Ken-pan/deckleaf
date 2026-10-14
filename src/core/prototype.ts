import { PrototypeSchema, element, type Prototype } from './model';

const figmaHosts = new Set(['figma.com', 'www.figma.com', 'embed.figma.com']);
export function normalizePrototypeUrl(input: string): string {
  let text = input.trim();
  if (/^<iframe\b/i.test(text)) {
    const src = text.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) throw new Error('The embed code has no link. Paste a share link instead.');
    text = src.replace(/&amp;/g, '&');
  }
  let url: URL;
  try { url = new URL(text); } catch { throw new Error('Paste a complete Figma prototype or web link.'); }
  if (figmaHosts.has(url.hostname) && url.pathname === '/embed') {
    const inner = url.searchParams.get('url');
    if (!inner) throw new Error('The Figma embed URL is missing its original link.');
    url = new URL(inner);
  }
  if (figmaHosts.has(url.hostname)) {
    if (!/^\/proto\/[\w-]+(?:\/|$)/.test(url.pathname)) throw new Error('Use a Figma prototype share link (/proto/). Design file links are not interactive prototypes.');
    url.hostname = 'www.figma.com'; url.protocol = 'https:'; url.port = '';
    for (const key of ['t', 'embed-host', 'embed_host', 'client-id']) url.searchParams.delete(key);
    url.hash = '';
  }
  const valid = PrototypeSchema.shape.url.safeParse(url.toString());
  if (!valid.success) throw new Error('Use an HTTP or HTTPS share link without passwords or API credentials.');
  return valid.data;
}
export function isFigmaPrototype(url: string) { try { const u = new URL(url); return figmaHosts.has(u.hostname) && u.pathname.startsWith('/proto/'); } catch { return false; } }
export function prototypeEmbedUrl(prototype: Prototype, clientId = '') {
  const url = new URL(prototype.url);
  if (isFigmaPrototype(prototype.url)) {
    url.hostname = 'embed.figma.com';
    url.searchParams.set('embed-host', 'deck-studio');
    url.searchParams.set('scaling', prototype.scaling);
    url.searchParams.set('content-scaling', prototype.responsive ? 'responsive' : 'fixed');
    url.searchParams.set('footer', String(prototype.chrome));
    url.searchParams.set('device-frame', String(prototype.deviceFrame));
    url.searchParams.set('show-proto-sidebar', 'false');
    if (clientId) url.searchParams.set('client-id', clientId);
  }
  return url.toString();
}
export function prototypeElement(url: string, width: number, height: number) {
  return element('prototype', {name: 'Interactive prototype', x: width * .12, y: height * .12, w: width * .76, h: height * .76,
    prototype: PrototypeSchema.parse({url: normalizePrototypeUrl(url)})});
}
