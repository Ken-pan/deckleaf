/** Resolve literal and theme-linked colors in generated DrawingML. */
export function pptxColors(xml:string,theme:string):Set<string>{
  const scheme=new Map([...theme.matchAll(/<a:(\w+)><a:srgbClr val="([\da-fA-F]{6})"/g)].map(m=>[m[1],m[2].toLowerCase()]));
  const colors=new Set([...xml.matchAll(/<a:srgbClr val="([\da-fA-F]{6})"/g)].map(m=>m[1].toLowerCase()));
  for(const match of xml.matchAll(/<a:schemeClr val="(\w+)"/g)){const color=scheme.get(match[1]);if(color)colors.add(color);}
  return colors;
}
