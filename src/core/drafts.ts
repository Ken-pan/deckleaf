import { validateDeck, type Deck } from './model';
import { cloneDocumentData, sameDocumentData } from './document-data';
import { LatestWriteQueue } from './latest-write-queue';
import {isBrowserEdition} from './runtime';
import {draftDB,writeStoredDraft} from './draft-store';

export type DraftRecord = {schema: 'deck-studio-draft/1'; id: string; deck: Deck; baseRevision: number; recoveries?: Deck[]};
export function draftRecord(deck: Deck, baseRevision: number, recoveries: Deck[] = []): DraftRecord {
  return {schema: 'deck-studio-draft/1', id: deck.id, deck, baseRevision, ...(recoveries.length ? {recoveries} : {})};
}
// Revision numbers order one branch; they do not prove that two branches agree.
export function resolveDraft(value: unknown, disk: Deck): {restore?: Deck; conflicts?: Deck[]} {
  if (!value || typeof value !== 'object') return {};
  if ((value as {schema?:string}).schema === 'deck-studio-drafts/1') {
    const branches=(value as {records:unknown[]}).records.map(record=>resolveDraft(record,disk));
    const restores:Deck[]=[],conflicts:Deck[]=[];
    const add=(into:Deck[],deck:Deck)=>{if(!into.some(candidate=>sameDocumentData(candidate,deck)))into.push(deck);};
    for(const branch of branches){if(branch.restore)add(restores,branch.restore);for(const conflict of branch.conflicts??[])add(conflicts,conflict);}
    if(restores.length===1&&!conflicts.length)return {restore:restores[0]};
    for(const restore of restores)add(conflicts,restore);
    return {conflicts};
  }
  const record = value as Partial<DraftRecord>;
  const deck = validateDeck(record.schema === 'deck-studio-draft/1' ? record.deck : value);
  if (deck.id !== disk.id) throw new Error('The recovery draft does not match this document.');
  const conflicts = (record.recoveries ?? []).map(validateDeck);
  if (conflicts.some(d => d.id !== disk.id)) throw new Error('The recovery draft does not match this document.');
  if (sameDocumentData(deck, disk)) return {conflicts};
  if (record.schema === 'deck-studio-draft/1' && Number.isInteger(record.baseRevision) && record.baseRevision === disk.revision && deck.revision > disk.revision) return {restore: deck, conflicts};
  if (!conflicts.some(d => sameDocumentData(d, deck))) conflicts.unshift(deck);
  return {conflicts};
}

const writes = new LatestWriteQueue<DraftRecord>(async copy => {
  const stored=isBrowserEdition?{...copy,id:`${copy.id}@${browserBranch}`,documentId:copy.id}:copy;
  if(typeof Worker==='undefined')return writeStoredDraft(stored);
  await (await import('./background-draft-save')).saveDraftInBackground(stored);
});
// Separate tab branches keep one tab's successful save from erasing another's
// conflicting recovery draft. Old branches are read together after a reload.
const browserBranch=isBrowserEdition?crypto.randomUUID():'';
export function saveDraft(record: DraftRecord): Promise<void> {
  // Capture the caller's revision before any asynchronous database work.
  return writes.enqueue(record.id, cloneDocumentData(record));
}
// Editor revisions and recovery branches are replacement-based immutable data.
// Their containers need no extra eager clone before the ordered IDB write.
// Mutable import/SDK callers continue to use saveDraft's independent capture.
export function saveImmutableDraft(record: DraftRecord): Promise<void> {
  return writes.enqueue(record.id, record);
}
export async function readDraft(id: string): Promise<unknown> {
  await writes.idle();
  const db = await draftDB();
  return new Promise((ok, no) => {
    const store=db.transaction('drafts').objectStore('drafts'),r=isBrowserEdition?store.getAll():store.get(id);
    r.onsuccess = () => ok(isBrowserEdition?{schema:'deck-studio-drafts/1',records:r.result.filter((record:any)=>(record.documentId??record.id)===id).map((record:any)=>({...record,id}))}:r.result); r.onerror = () => no(r.error);
  });
}
