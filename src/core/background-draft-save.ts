import {BackgroundDocumentSaver} from './background-document-save';
import {packDraft} from './draft-media-transport';
import {writeStoredDraft,type StoredDraftRecord} from './draft-store';

const saver=new BackgroundDocumentSaver(()=>new Worker(new URL('./draft-save.worker.ts',import.meta.url),{type:'module'}),1500,'Could not finish writing the browser recovery draft. Retry saving.');
export function saveDraftInBackground(record: StoredDraftRecord): Promise<void> {
  const packed=packDraft(record);
  // Unique assets would create another full string graph in a worker. Keep the
  // original path when transport factoring cannot offset that extra ownership.
  const avoided=packed.media.reduce((total,item)=>total+item.references.reduce((sum,ref)=>sum+item.assets[ref.asset].length,0)-item.assets.reduce((sum,asset)=>sum+asset.length,0),0);
  if(avoided<4*1024*1024)return writeStoredDraft(record);
  return saver.save('drafts',packed,()=>writeStoredDraft(record));
}
