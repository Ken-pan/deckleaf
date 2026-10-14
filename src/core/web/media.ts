export const sha256=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes))),b=>b.toString(16).padStart(2,'0')).join('');
export const dataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
export async function imagePixels(blob:Blob){
  const bitmap=await createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  if(bitmap.width*bitmap.height>20_000_000){bitmap.close();throw new Error('This image exceeds the pixel limit.');}
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d',{willReadFrequently:true})!;
  context.drawImage(bitmap,0,0);bitmap.close();return {canvas,context,pixels:context.getImageData(0,0,canvas.width,canvas.height)};
}
export async function checkedBlob(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('The image could not be loaded. Download it from its source and upload it here.');const blob=await response.blob();if(blob.size>12_000_000)throw new Error('Choose an image smaller than 12 MB.');return blob;}
