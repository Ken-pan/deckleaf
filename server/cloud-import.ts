function encodeBase64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
import { needsRasterGroup } from '../src/importers/figma-raster';
const checked = async (url: string, token: string, kind: 'figma' | 'google') => {
  const response = await fetch(url, {headers: kind === 'figma' ? {'X-Figma-Token': token} : {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`${kind === 'figma' ? 'Figma' : 'Google'} returned ${response.status}. Check viewing access and your token.`);
  return response.json() as Promise<any>;
};
async function embed(url: string) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !(/(^|\.)(figma\.com|amazonaws\.com|googleusercontent\.com|googleapis\.com)$/.test(u.hostname))) throw new Error('Untrusted render host');
  const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error('Could not download the source render.');
  const type = response.headers.get('content-type') || 'image/png';
  if (!/^image\/(png|jpeg|webp)/.test(type)) throw new Error('Unexpected render format');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 25_000_000) throw new Error('The source render is too large.');
  return `data:${type};base64,${encodeBase64(bytes)}`;
}
export async function figmaImport(url: string, token: string) {
  const u = new URL(url);
  if (!['www.figma.com', 'figma.com'].includes(u.hostname)) throw new Error('Enter a Figma file link.');
  const key = u.pathname.match(/^\/(?:slides|design|file)\/([\w-]+)/)?.[1];
  if (!key || !token.trim()) throw new Error('Enter a Figma file link and a read-only personal access token.');
  const requestedId = u.searchParams.get('node-id')?.replace(/-/g, ':');
  const file = await checked(`https://api.figma.com/v1/files/${key}?geometry=paths${requestedId ? `&ids=${encodeURIComponent(requestedId)}` : ''}`, token, 'figma');
  const slides: any[] = [];
  const visit = (n: any) => { if (n.visible === false) return; if (n.type === 'SLIDE') slides.push(n); else (n.children ?? []).forEach(visit); };
  visit(file.document);
  if (!slides.length) {
    for (const p of file.document.children ?? []) for (const n of p.children ?? []) if (n.type === 'FRAME' && n.visible !== false) slides.push(n);
  }
  if (!slides.length) throw new Error('No slides found. You can also import a .deck.json file from the Figma export plugin.');
  if (slides.length > 100) throw new Error('Import up to 100 slides at a time.');
  const renders: Record<string, string> = {};
  for (let i = 0; i < slides.length; i += 20) {
    const ids = slides.slice(i, i + 20).map(n => n.id).join(',');
    const images = await checked(`https://api.figma.com/v1/images/${key}?ids=${encodeURIComponent(ids)}&format=png&scale=2`, token, 'figma');
    for (const n of slides.slice(i, i + 20)) {
      if (images.images?.[n.id]) renders[n.id] = await embed(images.images[n.id]);
    }
  }
  const refs = new Set<string>();
  const imageRefs = (n: any) => { for (const fill of n.fills ?? []) if (fill.imageRef) refs.add(fill.imageRef); (n.children ?? []).forEach(imageRefs); };
  slides.forEach(imageRefs);
  const assets: Record<string, string> = {};
  if (refs.size) {
    const fills = await checked(`https://api.figma.com/v1/files/${key}/images`, token, 'figma');
    for (const ref of refs) if (fills.meta?.images?.[ref] || fills.images?.[ref]) assets[ref] = await embed(fills.meta?.images?.[ref] || fills.images[ref]);
  }
  const rasterNodes: any[] = [], nodeRenders: Record<string, string> = {}, nodeRenderBounds: Record<string, any> = {};
  const gather = (n: any) => {
    if (n.visible === false || n.isMask) return;
    if (needsRasterGroup(n) || (!n.children?.length && n.type !== 'TEXT')) rasterNodes.push(n);
    else (n.children ?? []).forEach(gather);
  };
  slides.forEach(n => (n.children ?? []).forEach(gather));
  if (rasterNodes.length > 500) throw new Error('This import contains more than 500 visual objects. Import fewer slides at a time.');
  for (let i = 0; i < rasterNodes.length; i += 30) {
    const batch = rasterNodes.slice(i, i + 30);
    const images = await checked(`https://api.figma.com/v1/images/${key}?ids=${encodeURIComponent(batch.map(n => n.id).join(','))}&format=png&scale=2`, token, 'figma');
    for (const n of batch) if (images.images?.[n.id]) { nodeRenders[n.id] = await embed(images.images[n.id]); nodeRenderBounds[n.id] = n.absoluteRenderBounds ?? n.absoluteBoundingBox; }
  }
  return {kind: 'figma-rest', title: file.name, slides, renders, assets, nodeRenders, nodeRenderBounds, url};
}
export async function googleImport(url: string, token: string) {
  const u = new URL(url);
  if (u.hostname !== 'docs.google.com') throw new Error('Enter a Google Slides link.');
  const id = u.pathname.match(/^\/presentation\/d\/([\w-]+)/)?.[1];
  if (!id || !token.trim()) throw new Error('Enter a Google Slides link and a read-only OAuth access token.');
  const file = await checked(`https://slides.googleapis.com/v1/presentations/${id}`, token, 'google');
  if (file.slides?.length > 100) throw new Error('Import up to 100 slides at a time.');
  const renders: Record<string, string> = {};
  for (const s of file.slides ?? []) {
    const thumb = await checked(`https://slides.googleapis.com/v1/presentations/${id}/pages/${s.objectId}/thumbnail?thumbnailProperties.thumbnailSize=LARGE`, token, 'google');
    renders[s.objectId] = await embed(thumb.contentUrl);
  }
  const assets: Record<string, string> = {};
  const downloadImages = async (elements: any[]) => {
    for (const e of elements) {
      if (e.elementGroup) await downloadImages(e.elementGroup.children ?? []);
      if (e.image?.contentUrl) assets[e.objectId] = await embed(e.image.contentUrl);
      if (e.sheetsChart?.contentUrl) assets[e.objectId] = await embed(e.sheetsChart.contentUrl);
    }
  };
  for (const s of [...(file.slides ?? []),...(file.layouts ?? []),...(file.masters ?? [])]) await downloadImages(s.pageElements ?? []);
  let nativePptx:string|undefined, nativeExportWarning:string|undefined;
  try {
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.presentationml.presentation`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new Error(String(response.status));
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>100_000_000)throw new Error('too large');
    nativePptx=encodeBase64(bytes);
  } catch {
    nativeExportWarning='The native Google PPTX export could not be read. Using API conversion, which omits exact text box margins and some masks. You can import a PPTX downloaded from Google instead.';
  }
  return {kind: 'google-rest', presentation: file, renders, assets, nativePptx, nativeExportWarning, url};
}
