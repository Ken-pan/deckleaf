// The selection marker must remain legible on both light and dark swatches.
export function swatchInk(hex:string) {
  const linear=(value:number)=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
  const channel=(offset:number)=>linear(parseInt(hex.slice(offset,offset+2),16));
  const luminance=.2126*channel(1)+.7152*channel(3)+.0722*channel(5);
  return luminance>.179?'#000000':'#ffffff';
}
