import type { Deck } from './model';
export type FontAudit = {family: string; pages: number[]; status: 'embedded'|'loaded'|'local'|'missing'|'partial'; weights: number[]; missingWeights?: number[]};
export function fontInventory(deck: Deck) {
  const fonts = new Map<string, FontAudit>();
  deck.slides.forEach((s, i) => s.elements.filter(e=>!e.hidden && ['text','table'].includes(e.type)).forEach(e => {
    for (const r of [{fontFamily:e.fontFamily,fontWeight:e.fontWeight}, ...(e.runs ?? []).filter(r=>r.text.length), ...(e.paragraphs?.flatMap(p=>p.runs) ?? []).filter(r=>r.text.length), ...(e.paragraphs?.flatMap(p=>p.endStyle?[p.endStyle]:[]) ?? [])]) {
      const family = r.fontFamily ?? e.fontFamily, weight = r.fontWeight ?? ('bold' in r && r.bold ? 700 : e.fontWeight);
      const record = fonts.get(family) ?? {family,pages:[],status:'missing' as const,weights:[]};
      if (!record.pages.includes(i+1)) record.pages.push(i+1);
      if (!record.weights.includes(weight)) record.weights.push(weight);
      fonts.set(family, record);
    }
  }));
  return [...fonts.values()];
}
export async function auditFonts(deck: Deck): Promise<FontAudit[]> {
  await document.fonts.ready;
  return Promise.all(fontInventory(deck).map(async f => {
    const family = f.family.replace(/["\\]/g,'');
    const embedded = deck.fonts?.filter(v=>v.family===f.family) ?? [];
    if (embedded.length) {
      const missingWeights = f.weights.filter(weight=>!embedded.some(v=>{
        const [min,max=min]=v.weight.trim().split(/\s+/).map(Number); return weight>=min && weight<=max;
      }));
      return {...f,status:missingWeights.length?'partial':'embedded',missingWeights};
    }
    if ([...document.fonts].some(face=>face.family.replace(/["']/g,'')===f.family && face.status==='loaded')) return {...f,status:'loaded'};
    try { await new FontFace(`deck-audit-${crypto.randomUUID()}`, `local("${family}")`).load(); return {...f,status:'local'}; }
    catch { return {...f,status:'missing'}; }
  }));
}
