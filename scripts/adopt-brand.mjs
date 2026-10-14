import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Adopt the reviewed vector master, rather than tracing it again on each build.
// The source PNG and trace metadata retain the original image's provenance.
const base = new URL('../public/brand/', import.meta.url);
const bytes = readFileSync(new URL('references/approved-logo-source.png', base));
const svg = readFileSync(new URL('references/approved-logo-vector.svg', base), 'utf8');
const metadata = JSON.parse(readFileSync(new URL('references/approved-logo-trace.json', base), 'utf8'));
const hash = createHash('sha256').update(bytes).digest('hex');
if (metadata.sha256 !== hash) throw new Error('Approved vector and source provenance do not match');
if (!svg.includes('viewBox="0 0 100 100"') || !/<path\b/.test(svg)) throw new Error('Expected the reviewed 100-unit vector master');
if (/<(?:image|script|foreignObject)\b|\btransform=|\bfill=""/.test(svg)) throw new Error('Master must contain baked, inheritable vector geometry');
writeFileSync(new URL('logo.svg', base), svg);
console.log(JSON.stringify({ source: metadata.source, sha256: hash, method: metadata.method, contourCount: metadata.contourCount, svgBytes: Buffer.byteLength(svg) }));
