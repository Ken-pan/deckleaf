import type { Deck } from './model';

const downloads=new Map<string,ReturnType<typeof setTimeout>>();
function release(url:string){clearTimeout(downloads.get(url));downloads.delete(url);URL.revokeObjectURL(url);}
let listening=false;

export function download(data: string | Blob, name: string, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], {type});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  try{a.click();}catch(error){URL.revokeObjectURL(url);throw error;}
  // A started browser download owns its stream. Keep a short startup grace
  // period, then release our URL instead of retaining repeated large exports.
  downloads.set(url,setTimeout(()=>release(url),1000));
  if(!listening&&typeof window!=='undefined'){
    listening=true;window.addEventListener('pagehide',()=>{for(const url of downloads.keys())release(url);});
  }
}

export function deckFilename(deck: Deck) {
  return deck.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 90) || 'deck';
}
