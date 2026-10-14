import {themedIllustrationSvg,standaloneIllustrationSvg} from '../../../public/resources/illustration-engine.js';
import {getIconData,iconToSVG} from '@iconify/utils';
import {ICON_SETS,resourceMatches,resourceMetadata,attributionText,isStockPhotoSource,type ResourceItem} from '../resources';
import {normalizeAccent,ORIGINAL_ACCENT,recolorAccentPixels} from '../../../public/resources/accent-engine.js';
import {checkedBlob,dataUrl,imagePixels} from './media';
import {customizeGraphic,graphicInfo,graphicDetailSvg,graphicSearchScore,graphicFacets,normalizeGraphicRecipe} from '../../../public/resources/graphic-engine.js';
import {GraphicRecipeSchema} from '../graphic-recipe';
import {matchesIllustrationView} from '../resource-taxonomy';
type PublishedItem=ResourceItem&{file:string};
type Catalog={catalog:any;items:PublishedItem[];icons:Record<string,{author:string;license:string;licenseUrl:string;notice:string}>};
let catalogPromise:Promise<Catalog>|undefined;
const libraries=new Map<string,Promise<any>>();
const unavailableStock = () => { throw new Error('This photo provider is not enabled on this host. Browse its website and upload a licensed image, or use open collections.'); };
async function catalog():Promise<Catalog>{return catalogPromise??=fetch('/resources/catalog.json').then(r=>{if(!r.ok)throw new Error('The resource catalog could not load. Reload to try again.');return r.json();}).then((data:Catalog)=>({...data,items:data.items.map(item=>item.id.startsWith('illlustrations:')?{...item,colorable:true}:item)}));}
async function icons(prefix:string){if(!ICON_SETS.some(s=>s.id===prefix))throw new Error('Unsupported icon collection.');if(!libraries.has(prefix))libraries.set(prefix,fetch(`/resources/icons/${prefix}.json`).then(r=>r.json()));return libraries.get(prefix)!;}
async function iconItem(id:string):Promise<ResourceItem>{const [prefix,name]=id.split(':');const info=(await catalog()).icons[prefix];if(!info)throw new Error('Unknown icon collection.');const resource={id:'iconify:'+id,kind:'icon' as const,provider:ICON_SETS.find(s=>s.id===prefix)!.label,title:name.replaceAll('-',' '),creator:info.author,sourceUrl:`https://icon-sets.iconify.design/${prefix}/${name}/`,license:prefix==='lucide'?'ISC / MIT (Feather)':info.license,licenseUrl:info.licenseUrl,licenseNotice:info.notice,attributionRequired:false,attribution:''};return {...resource,attribution:attributionText(resource),colorable:true,collection:prefix,previewUrl:`/api/resources/preview?id=${encodeURIComponent(resource.id)}`};}
const iconStyle=(prefix:string,name:string)=>/duotone/.test(name)?'duotone':/fill(ed)?$|solid$/.test(name)||(prefix==='material-symbols'&&!name.includes('outline'))?'solid':'outline';
async function photoApi(params:URLSearchParams){const r=await fetch(`/.netlify/functions/open-resources?${params}`,{signal:AbortSignal.timeout(30000)});if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(b.error||'The photo source is unavailable. Upload a photo from your device.');}return r;}
async function search(params:URLSearchParams){
  const kind=params.get('kind')||'photo',page=Math.max(1,Math.min(1000,Number(params.get('page'))||1)),query=params.get('q')||'';
  if(kind==='photo'){const source=params.get('source')||'';if(isStockPhotoSource(source))return unavailableStock();return (await photoApi(params)).json();}
  if(kind==='illustration'){
    const view=params.get('view')||'',illustrationType=params.get('illustrationType')||'';
    const collection=params.get('collection')||'all',category=params.get('category')||'',family=params.get('family')||'',items=(await catalog()).items;
    const all=items.filter(item=>matchesIllustrationView(item,view,illustrationType)&&(collection==='all'||item.collection===collection)&&(!category||category===item.category)&&(!family||(item.collection==='deck-graphics'&&graphicInfo(item).family===family))&&(item.collection==='deck-graphics'?Number.isFinite(graphicSearchScore(item,query)):resourceMatches(`${item.title} ${item.id} ${item.tags?.join(' ')}`,query)));
    if(collection==='deck-graphics')all.sort((a,b)=>graphicSearchScore(a,query)-graphicSearchScore(b,query));
    return {items:all.slice((page-1)*48,page*48),page,total:all.length,hasMore:page*48<all.length,...(collection==='deck-graphics'?{facets:{families:graphicFacets(items.filter(i=>i.collection==='deck-graphics'&&matchesIllustrationView(i,view,illustrationType)),query,category)}}:{})};
  }
  if(kind!=='icon')throw new Error('Unsupported resource type.');
  const set=params.get('set')||'lucide',style=params.get('style')||'all';
  const ids=(await Promise.all(ICON_SETS.filter(s=>set==='all'||s.id===set).map(async s=>{const data=await icons(s.id);return [...Object.keys(data.icons),...Object.keys(data.aliases||{})].filter(name=>resourceMatches(name,query)&&(style==='all'||iconStyle(s.id,name)===style)).map(name=>s.id+':'+name);}))).flat();
  const q=query.toLowerCase().replaceAll(' ','-'),rank=(name:string)=>name===q?0:name.startsWith(q)?1:2;
  ids.sort((a,b)=>{const an=a.split(':')[1],bn=b.split(':')[1];return rank(an)-rank(bn)||an.length-bn.length||a.localeCompare(b);});
  return {items:await Promise.all(ids.slice((page-1)*64,page*64).map(iconItem)),page,total:ids.length,hasMore:page*64<ids.length};
}
async function resourceBlob(id:string,requestedColor?:string,preview=false,raw?:unknown,detail=false):Promise<{blob:Blob;item:ResourceItem}>{
  if(raw!==undefined&&!id.startsWith('deck-graphics:'))throw new Error('Graphic settings apply to graphics only.');
  const color=normalizeAccent(requestedColor||(id.startsWith('blue-black:')?ORIGINAL_ACCENT:'#26362c'));
  if(id.startsWith('openverse:')){const response=await photoApi(new URLSearchParams({action:preview?'preview':'import',id}));if(preview)return {blob:await response.blob(),item:{} as ResourceItem};const data=await response.json();return {blob:await fetch(data.src).then(r=>r.blob()),item:data.resource};}
  if(id.startsWith('pexels:')||id.startsWith('unsplash:'))return unavailableStock();
  if(id.startsWith('character:')||id.startsWith('character-saved:'))return (await import('./characters')).characterResource(id);
  if(id.startsWith('iconify:')){
    const key=id.slice(8),[prefix,name]=key.split(':'),icon=getIconData(await icons(prefix),name);if(!icon)throw new Error('This icon does not exist.');
    const built=iconToSVG(icon,{width:icon.width||24,height:icon.height||24}),item=await iconItem(key);
    const attributes=Object.entries(built.attributes).map(([k,v])=>`${k}="${String(v).replaceAll('"','&quot;')}"`).join(' ');
    const svg=`<!-- ${item.licenseNotice?.replaceAll('--','—')} -->\n<svg xmlns="http://www.w3.org/2000/svg" ${attributes} color="${color}">${built.body.replaceAll('currentColor',color)}</svg>`;
    return {blob:new Blob([svg],{type:'image/svg+xml'}),item:{...item,color}};
  }
  const found=(await catalog()).items.find(item=>item.id===id);if(!found)throw new Error('This resource does not exist.');
  const item={...found};
  let blob=await checkedBlob(id==='illlustrations:day34-ticket'?'/resources/illlustrations/day34-ticket.svg':item.file);
  if(id.startsWith('illlustrations:')&&blob.type==='image/svg+xml')blob=new Blob([themedIllustrationSvg(standaloneIllustrationSvg(await blob.text(),id),color,id)],{type:'image/svg+xml'});
  if(id.startsWith('doodles:'))blob=new Blob([(await blob.text()).replace(/#FF5678/gi,color)],{type:'image/svg+xml'});
  if(id.startsWith('deck-graphics:')){
    const recipe=normalizeGraphicRecipe(GraphicRecipeSchema.parse(raw===undefined?{}:raw)),info=graphicInfo(item),svg=customizeGraphic(await blob.text(),color,recipe,info.repeatable);
    blob=new Blob([detail?graphicDetailSvg(svg,info,item.width,item.height):svg],{type:'image/svg+xml'});
    if(raw!==undefined)item.graphicRecipe=recipe;
  }
  if(id.startsWith('blue-black:')&&(color!==ORIGINAL_ACCENT||preview)){
    const {canvas,context,pixels}=await imagePixels(blob);if(color!==ORIGINAL_ACCENT)recolorAccentPixels(pixels.data,color);context.putImageData(pixels,0,0);
    if(preview&&Math.max(canvas.width,canvas.height)>480){const scale=480/Math.max(canvas.width,canvas.height),small=new OffscreenCanvas(Math.round(canvas.width*scale),Math.round(canvas.height*scale));small.getContext('2d')!.drawImage(canvas,0,0,small.width,small.height);blob=await small.convertToBlob({type:'image/png'});}else blob=await canvas.convertToBlob({type:'image/png'});
  }
  return {blob,item:item.colorable?{...item,color}:item};
}
export async function browserResourceJson(path:string,params:URLSearchParams,method:string,body:any){
  if(path.endsWith('/catalog'))return (await catalog()).catalog;
  if(path.endsWith('/search'))return search(params);
  if(path.endsWith('/providers')){if(method!=='GET')return unavailableStock();return [{id:'unsplash',label:'Unsplash',configured:false,configuration:'none'},{id:'pexels',label:'Pexels',configured:false,configuration:'none'}];}
  if(path.endsWith('/import')){
    if(String(body.id).startsWith('unsplash:'))return unavailableStock();
    if(body.characterRecipe&&String(body.id).startsWith('character:'))return (await import('./characters')).characterEmbedded(body.characterRecipe);
    const {blob,item}=await resourceBlob(body.id,body.color,false,body.graphicRecipe);return {src:await dataUrl(blob),resource:resourceMetadata(item)};
  }
  throw new Error('Unsupported resource action.');
}
export async function browserResourcePreview(params:URLSearchParams){const raw=params.get('recipe');const {blob}=await resourceBlob(params.get('id')||'',params.get('color')||undefined,true,raw?JSON.parse(raw):undefined,params.get('detail')==='1');return new Response(blob,{headers:{'Content-Type':blob.type}});}
