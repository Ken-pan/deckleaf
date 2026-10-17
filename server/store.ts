import { readFile, writeFile, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDeck, type Deck } from '../src/core/model';
import { ProposalSchema, applyOperations, type Proposal } from '../src/core/operations';
import {writeDocumentJsonFile} from './document-json-file';
import {summarizeDeck, requirePreviewRevision, type LibrarySummary, type LibraryPreview} from '../src/core/library-summary';

export const DATA = resolve(process.env.DECK_STUDIO_DATA || '.data');
const safeId = (id: string) => { if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(id)) throw new Error('Invalid ID'); return id; };
export async function initStore() {
  await Promise.all(['decks', 'history', 'imports', 'proposals'].map(n => mkdir(resolve(DATA, n), {recursive: true})));
}
async function atomic(path: string, data: unknown) {
  if((data as Deck)?.schema==='deck-studio/1')return writeDocumentJsonFile(path,data as Deck);
  const temp = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data), {mode: 0o600});
  await rename(temp, path);
}
export async function readDeck(id: string): Promise<Deck> {
  return validateDeck(JSON.parse(await readFile(resolve(DATA, 'decks', `${safeId(id)}.json`), 'utf8')));
}
// Boot only needs one valid document; listing every embedded preview can wait
// until the user opens the library. Malformed source files remain untouched.
export async function hasSavedDeck(): Promise<boolean> {
  const files = (await readdir(resolve(DATA, 'decks'))).filter(file => file.endsWith('.json'));
  for (const file of files) {
    try { await readDeck(file.slice(0, -5)); return true; } catch { /* Match library validation. */ }
  }
  return false;
}
// Summaries live independently of the bounded, media-bearing preview LRU.
const summaries = new Map<string, {signature: string; entry: LibrarySummary}>();
const previews = new Map<string, {signature: string; entry: LibraryPreview; bytes: number}>();
const pendingLibraryReads = new Map<string, Promise<LibraryPreview>>();
const CACHE_BYTES = 32_000_000;
let previewBytes = 0;
function forgetPreview(id: string) {
  const cached = previews.get(id);
  if (cached) { previewBytes -= cached.bytes; previews.delete(id); }
}
function forgetLibraryEntry(id: string) { summaries.delete(id); forgetPreview(id); }
function cachePreview(id: string, signature: string, entry: LibraryPreview) {
  forgetPreview(id);
  const bytes = Buffer.byteLength(JSON.stringify(entry));
  if (bytes > CACHE_BYTES) return;
  previews.set(id, {signature, entry, bytes}); previewBytes += bytes;
  while (previews.size > 64 || previewBytes > CACHE_BYTES) forgetPreview(previews.keys().next().value!);
}
async function fileSignature(id: string) {
  const info = await stat(resolve(DATA, 'decks', `${safeId(id)}.json`), {bigint: true});
  return `${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}
async function libraryEntry(id: string, withPreview: boolean): Promise<LibraryPreview> {
  const signature = await fileSignature(id);
  const cached = withPreview ? previews.get(id) : summaries.get(id);
  if (cached?.signature === signature) {
    if (withPreview) { const entry = previews.get(id)!; previews.delete(id); previews.set(id, entry); }
    return cached.entry;
  }
  const key = `${id}/${signature}/${withPreview}`;
  let loading = pendingLibraryReads.get(key);
  if (!loading) {
    loading = (async () => {
      // An external atomic replacement during a read must never associate old
      // content with the new file signature. Retry without touching the source.
      let before = signature;
      for (let attempt = 0; attempt < 3; attempt++) {
        const deck = await readDeck(id), after = await fileSignature(id);
        if (before !== after) { before = after; continue; }
        const entry = summarizeDeck(deck);
        summaries.set(id, {signature: after, entry});
        if (!withPreview) return entry;
        const preview = {...entry, firstSlide: deck.slides[0]};
        cachePreview(id, after, preview);
        return preview;
      }
      throw Object.assign(new Error('This document is changing. Try again.'), {status: 409});
    })();
    pendingLibraryReads.set(key, loading);
  }
  try { return await loading; }
  finally { if (pendingLibraryReads.get(key) === loading) pendingLibraryReads.delete(key); }
}
export async function readLibraryPreview(id: string, expectedRevision?: number): Promise<LibraryPreview> {
  try {
    const entry = await libraryEntry(safeId(id), true);
    requirePreviewRevision(entry.revision, expectedRevision);
    // SDK callers must not mutate the cached revision.
    return structuredClone(entry);
  } catch (error) { forgetLibraryEntry(id); throw error; }
}
export async function listDecks(includePreview = true): Promise<LibraryPreview[]> {
  const files = (await readdir(resolve(DATA, 'decks'))).filter(f => f.endsWith('.json'));
  const ids = new Set(files.map(f => f.slice(0, -5)));
  for (const id of summaries.keys()) if (!ids.has(id)) forgetLibraryEntry(id);
  for (const id of previews.keys()) if (!ids.has(id)) forgetPreview(id);
  const entries: LibraryPreview[] = [];
  let cursor = 0;
  await Promise.all(Array.from({length: Math.min(4, files.length)}, async () => {
    while (cursor < files.length) {
      const id = files[cursor++].slice(0, -5);
      try { entries.push(structuredClone(await libraryEntry(id, includePreview))); }
      catch { forgetLibraryEntry(id); }
    }
  }));
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
const queues = new Map<string, Promise<unknown>>();
export async function saveDeck(deck: Deck, expectedRevision: number | null) {
  const d = validateDeck(deck);
  safeId(d.id);
  const previous = queues.get(d.id) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    let old: Deck | undefined;
    try { old = await readDeck(d.id); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (old && (expectedRevision === null || old.revision !== expectedRevision || d.revision <= old.revision)) throw Object.assign(new Error('This document was updated in another window. Your current changes are preserved. Export a copy before continuing.'), {status: 409});
    if (!old && expectedRevision !== null) throw Object.assign(new Error('This document no longer exists.'), {status: 409});
    if (old) await atomic(resolve(DATA, 'history', `${d.id}-${old.revision}.json`), old);
    await atomic(resolve(DATA, 'decks', `${d.id}.json`), d);
    forgetLibraryEntry(d.id);
    return d;
  });
  queues.set(d.id, run);
  try { return await run; } finally { if (queues.get(d.id) === run) queues.delete(d.id); }
}
export async function storeProposal(deckId: string, raw: unknown) {
  const previous=queues.get(deckId)??Promise.resolve();
  const run=previous.catch(()=>{}).then(async()=>{
    const deck = await readDeck(deckId);
    const proposal = ProposalSchema.parse(raw);
    applyOperations(deck,proposal.operations,proposal.baseRevision,'ai');
    // A repeated response/retry returns the same pending proposal instead of
    // cluttering the editor with duplicate writes.
    const existing=(await proposals(deckId)).find(p=>JSON.stringify(p.proposal)===JSON.stringify(proposal));
    if(existing)return {id:existing.id,deckId,proposal};
    const id = crypto.randomUUID();
    await atomic(resolve(DATA, 'proposals', `${id}.json`), {id, deckId, proposal, status: 'pending', createdAt: new Date().toISOString()});
    return {id, deckId, proposal};
  });
  queues.set(deckId,run);
  try{return await run;}finally{if(queues.get(deckId)===run)queues.delete(deckId);}
}
export async function proposals(deckId: string): Promise<{id: string; deckId: string; proposal: Proposal}[]> {
  safeId(deckId);
  const list = await readdir(resolve(DATA, 'proposals'));
  const all = await Promise.all(list.filter(f => f.endsWith('.json')).map(async f => JSON.parse(await readFile(resolve(DATA, 'proposals', f), 'utf8'))));
  return all.filter(x => x.deckId === deckId && x.status === 'pending');
}
export async function resolveProposal(id: string, status: 'applied' | 'dismissed') {
  const path = resolve(DATA, 'proposals', `${safeId(id)}.json`);
  const p = JSON.parse(await readFile(path, 'utf8'));
  await atomic(path, {...p, status});
}

async function historyVersion(deckId: string, revision: number): Promise<Deck> {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision');
  return validateDeck(JSON.parse(await readFile(resolve(DATA, 'history', `${deckId}-${revision}.json`), 'utf8')));
}
export async function readHistory(deckId: string, revision: number): Promise<Deck> {
  safeId(deckId); await readDeck(deckId);
  return historyVersion(deckId, revision);
}
export async function listHistory(deckId: string) {
  safeId(deckId); await readDeck(deckId);
  const prefix = `${deckId}-`;
  const revisions = (await readdir(resolve(DATA, 'history'))).filter(name => name.startsWith(prefix) && /^\d+\.json$/.test(name.slice(prefix.length))).map(name => Number(name.slice(prefix.length, -5))).sort((a,b) => b-a).slice(0,50);
  const entries = [];
  for (const revision of revisions) { const deck = await historyVersion(deckId, revision); entries.push({revision, title: deck.title, updatedAt: deck.updatedAt, count: deck.slides.length}); }
  return entries;
}
