export type DocumentJsonOptions = {space?:number;escapeHtml?:boolean};

// Canonical documents are plain JSON. Keep large assets in individual parts so
// downloads and disk writes need not allocate one complete document string.
export function* documentJsonParts(value:unknown,options:DocumentJsonOptions={},depth=0):Generator<string> {
  const space=Math.min(10,Math.max(0,options.space??0)),unit=' '.repeat(space);
  const pad=unit.repeat(depth),childPad=pad+unit,newline=space?'\n':'';
  const encode=(input:unknown)=>{const json=JSON.stringify(input,null,space);return options.escapeHtml?json.replace(/</g,'\\u003c'):json;};
  if(Array.isArray(value)){
    yield '[';
    for(let i=0;i<value.length;i++){yield (i?',':'')+newline+childPad;yield* documentJsonParts(value[i]??null,options,depth+1);}
    yield (value.length?newline+pad:'')+']';
  }else if(value&&typeof value==='object'&&depth<4){
    const record=value as Record<string,unknown>,keys=Object.keys(record).filter(key=>record[key]!==undefined);
    yield '{';
    for(let i=0;i<keys.length;i++){const key=keys[i];yield (i?',':'')+newline+childPad+encode(key)+':'+(space?' ':'');yield* documentJsonParts(record[key],options,depth+1);}
    yield (keys.length?newline+pad:'')+'}';
  }else{const json=encode(value);yield space?json.replace(/\n/g,'\n'+pad):json;}
}

// Batch small syntax fragments without joining the complete document. The
// largest single embedded object is the only part allowed beyond this budget.
export function* boundedDocumentJsonParts(value:unknown):Generator<string>{
  let parts:string[]=[],characters=0;
  for(const part of documentJsonParts(value)){
    parts.push(part);characters+=part.length;
    if(characters>=262_144){yield parts.join('');parts=[];characters=0;}
  }
  if(parts.length)yield parts.join('');
}
