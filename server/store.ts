import { readFile, writeFile, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDeck, type Deck } from '../src/core/model';
import { ProposalSchema, applyOperations, type Proposal } from '../src/core/operations';
import {writeDocumentJsonFile} from './document-json-file';

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
function deckSummary(d: Deck) {
  return {id: d.id, title: d.title, revision: d.revision, width: d.width, height: d.height,
    updatedAt: d.updatedAt, count: d.slides.length, provider: d.provenance?.provider};
}
type LibraryEntry = ReturnType<typeof deckSummary> & {firstSlide?: Deck['slides'][number]};
const libraryCache = new Map<string, {signature: string; entry: LibraryEntry; bytes: number}>();
const CACHE_BYTES = 32_000_000;
function cacheLibraryEntry(id: string, signature: string, entry: LibraryEntry) {
  const bytes = Buffer.byteLength(JSON.stringify(entry));
  libraryCache.delete(id);
  if (bytes > CACHE_BYTES) return;
  libraryCache.set(id, {signature, entry, bytes});
  let total = [...libraryCache.values()].reduce((sum, cached) => sum + cached.bytes, 0);
  while (libraryCache.size > 64 || total > CACHE_BYTES) {
    const oldest = libraryCache.keys().next().value!;
    total -= libraryCache.get(oldest)!.bytes; libraryCache.delete(oldest);
  }
}
export async function listDecks(includePreview = true): Promise<LibraryEntry[]> {
  const files = (await readdir(resolve(DATA, 'decks'))).filter(f => f.endsWith('.json'));
  const ids = new Set(files.map(f => f.slice(0, -5)));
  for (const id of libraryCache.keys()) if (!ids.has(id)) libraryCache.delete(id);
  const entries: LibraryEntry[] = [];
  let cursor = 0;
  // Bound reads and validation when a library contains many large documents.
  await Promise.all(Array.from({length: Math.min(4, files.length)}, async () => {
    while (cursor < files.length) {
      const id = files[cursor++].slice(0, -5);
      try {
        const info = await stat(resolve(DATA, 'decks', `${safeId(id)}.json`), {bigint: true});
        const signature = `${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
        let cached = libraryCache.get(id);
        if (!cached || cached.signature !== signature) {
          const deck = await readDeck(id);
          const entry = {...deckSummary(deck), firstSlide: deck.slides[0]};
          cacheLibraryEntry(id, signature, entry);
          cached = {signature, entry, bytes: 0};
        }
        const {firstSlide, ...summary} = cached.entry;
        // Never expose mutable cached objects to SDK callers.
        entries.push(includePreview ? structuredClone(cached.entry) : summary);
      } catch { libraryCache.delete(id); }
    }
  }));
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    libraryCache.delete(d.id);
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
