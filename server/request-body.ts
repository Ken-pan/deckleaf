import type {IncomingMessage} from 'node:http';

const tooLarge=()=>Object.assign(new Error('This file exceeds 100 MB. Import it in smaller batches.'),{status:413});
export async function requestBytes(req: IncomingMessage, max=110_000_000): Promise<Buffer> {
  const header=req.headers['content-length'];
  const declared=typeof header==='string'&&/^\d+$/.test(header)?Number(header):undefined;
  if(declared!==undefined&&(!Number.isSafeInteger(declared)||declared>max))throw tooLarge();
  // Browser uploads declare their length. Copy arriving chunks into one bounded
  // allocation instead of retaining every network buffer plus a concatenation.
  const target=declared===undefined?undefined:Buffer.allocUnsafe(declared);
  const parts:Buffer[]=[];let size=0;
  for await(const part of req){
    const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);const end=size+chunk.length;
    if(end>max)throw tooLarge();
    if(target){
      if(end>target.length)throw Object.assign(new Error('The request body does not match its declared length.'),{status:400});
      chunk.copy(target,size);
    }else parts.push(chunk);
    size=end;
  }
  if(target&&size!==target.length)throw Object.assign(new Error('The request body is incomplete.'),{status:400});
  return target??Buffer.concat(parts,size);
}
