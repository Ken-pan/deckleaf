import {isBrowserEdition} from './runtime';
import type {DraftRecord} from './drafts';

export type StoredDraftRecord = DraftRecord & {documentId?: string};
let connection: Promise<IDBDatabase> | undefined;
export function draftDB(): Promise<IDBDatabase> {
  if (connection) return connection;
  const opened = new Promise<IDBDatabase>((ok, no) => {
    const r = indexedDB.open(isBrowserEdition ? 'deck-studio-web-recovery' : 'deck-studio-local', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('drafts', {keyPath: 'id'});
    r.onsuccess = () => {
      const db = r.result;
      const clear = () => { if (connection === opened) connection = undefined; };
      db.onversionchange = () => { db.close(); clear(); };
      db.onclose = clear;
      ok(db);
    };
    r.onerror = () => { if (connection === opened) connection = undefined; no(r.error); };
  });
  connection = opened;
  return opened;
}

// Persist the canonical record, including its already assigned tab branch key.
// Acknowledgement means the transaction committed, not merely that put returned.
export async function writeStoredDraft(record: StoredDraftRecord): Promise<void> {
  const db = await draftDB();
  await new Promise<void>((ok, no) => {
    const t = db.transaction('drafts', 'readwrite');
    t.objectStore('drafts').put(record);
    t.oncomplete = () => ok(); t.onerror = () => no(t.error); t.onabort = () => no(t.error);
  });
}
