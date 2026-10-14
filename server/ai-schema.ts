import {editSchema} from '../src/core/ai-editing';
// Canonical schema for discovery. Strict tools use small argument envelopes.
export const aiJsonSchema = editSchema();
export function omitNull(value:any):any {
  if(Array.isArray(value))return value.map(omitNull);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==null).map(([k,v])=>[k,omitNull(v)]));
}
