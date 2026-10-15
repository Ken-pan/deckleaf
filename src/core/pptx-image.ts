/** Embedded raster media is local data; decoding it does not need network access. */
export async function loadPptxImage(src:string,name:string,load:typeof fetch=fetch):Promise<Blob>{
  const embedded=/^data:(image\/[^;,]+);base64,/i.exec(src);
  if(embedded){
    const binary=atob(decodeURIComponent(src.slice(embedded[0].length)));
    return new Blob([Uint8Array.from(binary,char=>char.charCodeAt(0))],{type:embedded[1]});
  }
  const response=await load(src);
  if(!response.ok)throw new Error(`Cannot read image: ${name}`);
  return response.blob();
}
