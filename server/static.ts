import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

const mime: Record<string, string> = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain'};
const compressible = new Set(['.js', '.mjs', '.css', '.html', '.json', '.svg', '.txt', '.ttf', '.otf']);

export function preferredEncodings(header = ''): ('br' | 'gzip')[] {
  const weights = new Map(header.toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const q = parameters.find(parameter => parameter.trim().startsWith('q='));
    const weight = q ? Number(q.trim().slice(2)) : 1;
    return [name, Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0];
  }));
  return (['br', 'gzip'] as const).filter(name => (weights.get(name) ?? weights.get('*') ?? 0) > 0)
    .sort((a, b) => (weights.get(b) ?? weights.get('*') ?? 0) - (weights.get(a) ?? weights.get('*') ?? 0));
}

export async function serveStatic(req: IncomingMessage, res: ServerResponse, file: string) {
  const original = await stat(file);
  if (!original.isFile()) throw Object.assign(new Error('Not a file'), {code: 'ENOENT'});
  const extension = extname(file);
  let selected = file, info = original, encoding: 'br' | 'gzip' | undefined;
  if (compressible.has(extension)) {
    for (const candidate of preferredEncodings(req.headers['accept-encoding'])) {
      const path = file + (candidate === 'br' ? '.br' : '.gz');
      const compressed = await stat(path).catch(() => null);
      if (compressed?.isFile() && compressed.mtimeMs >= original.mtimeMs && compressed.size < original.size) {
        selected = path; info = compressed; encoding = candidate; break;
      }
    }
  }
  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}-${encoding || 'identity'}"`;
  res.setHeader('Content-Type', mime[extension] || 'application/octet-stream');
  res.setHeader('Cache-Control', /\/assets\/[^/]+-[\w-]{8,}\.(js|css)$/.test(file)
    ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', original.mtime.toUTCString());
  if (compressible.has(extension)) res.setHeader('Vary', 'Accept-Encoding');
  if (encoding) res.setHeader('Content-Encoding', encoding);
  const noneMatch = req.headers['if-none-match'];
  const modifiedSince = req.headers['if-modified-since'];
  const unchanged = noneMatch ? noneMatch.split(',').map(tag => tag.trim()).some(tag => tag === '*' || tag.replace(/^W\//, '') === etag.replace(/^W\//, ''))
    : modifiedSince && Math.floor(original.mtimeMs / 1000) * 1000 <= Date.parse(modifiedSince);
  if (unchanged) { res.writeHead(304); res.end(); return; }
  res.setHeader('Content-Length', info.size);
  res.writeHead(200);
  if (req.method === 'HEAD') { res.end(); return; }
  await pipeline(createReadStream(selected), res);
}
