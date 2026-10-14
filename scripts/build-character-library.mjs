import {readFile,writeFile,readdir,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {CharacterLibrarySourceSchema,CharacterManifestSchema,CharacterReviewSchema,characterReviewApproved,measureCharacterPalette} from '../src/core/characters.ts';
const root='public/resources/characters-v1',source=CharacterLibrarySourceSchema.parse(JSON.parse(await readFile(`${root}/library-source.json`,'utf8')));
const reviews=CharacterReviewSchema.parse(JSON.parse(await readFile(`${root}/reviews.json`,'utf8'))),characters=source.characters;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),pendingMasks=new Map();
function components(png,eligible){
 const seen=new Uint8Array(png.width*png.height),result=[];
 for(let start=0;start<seen.length;start++){if(seen[start]||!eligible(start))continue;const stack=[start],indices=[];seen[start]=1;let minX=png.width,minY=png.height,maxX=0,maxY=0,sx=0,sy=0;
  while(stack.length){const p=stack.pop(),x=p%png.width,y=Math.floor(p/png.width);indices.push(p);sx+=x;sy+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   for(const q of [x? p-1:-1,x<png.width-1?p+1:-1,y?p-png.width:-1,y<png.height-1?p+png.width:-1])if(q>=0&&!seen[q]&&eligible(q)){seen[q]=1;stack.push(q);}}
  result.push({indices,count:indices.length,cx:sx/indices.length,cy:sy/indices.length,minX,minY,maxX,maxY});}
 return result;
}
const variants=[],audit=[];
for(const receiptName of (await readdir(`${root}/receipts`)).filter(n=>n.endsWith('.json')).sort()){
 const receipt=JSON.parse(await readFile(`${root}/receipts/${receiptName}`,'utf8')),id=receiptName.slice(0,-5),file=`png/${id}.png`;
 const bytes=await readFile(`${root}/${file}`),png=PNG.sync.read(bytes),labels=new Uint8Array(png.width*png.height),profile=source.autoMasks[receipt.characterId],override=source.variants[id];
 if(png.width*png.height>20_000_000)throw new Error(`${id}: image too large`);
 if(!override&&(!profile||!profile.handSeeds[receipt.scene]))throw new Error(`${id}: missing authored masks or auto-mask profile`);
 const masks={},maskSha256={},counts={};let selectedWhites=[];
 if(override){
  for(const [region,label]of [['skin',1],['clothes',2],['hair',3]]){
   const maskFile=override.masks[region],maskBytes=await readFile(`${root}/${maskFile}`),mask=PNG.sync.read(maskBytes);let count=0;
   if(mask.width!==png.width||mask.height!==png.height)throw new Error(`${id}: authored mask dimensions differ`);
   for(let p=0;p<labels.length;p++)if(mask.data[p*4+3]){if(labels[p]||!png.data[p*4+3])throw new Error(`${id}: authored mask overlap or background leak`);labels[p]=label;count++;}
   if(count<100)throw new Error(`${id}: empty authored ${region} mask`);masks[region]=maskFile;maskSha256[region]=hash(maskBytes);counts[region]=count;
  }
 }else{
 const rect=profile.headRect;
 const blue=components(png,p=>{const i=p*4;return png.data[i+3]>200&&png.data[i+2]-png.data[i]>30&&png.data[i+2]-png.data[i+1]>20&&p%png.width<png.width*profile.clothesBounds.maxX;}).sort((a,b)=>b.count-a.count);
 if(!blue[0]||blue[0].count<1000)throw new Error(`${id}: no clothing region`);
 for(const component of blue.filter(c=>c.count>100&&c.cy>png.height*profile.clothesBounds.minY&&c.cy<png.height*profile.clothesBounds.maxY))for(const p of component.indices)labels[p]=2;
 const whites=components(png,p=>{const i=p*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2];return png.data[i+3]>200&&Math.min(r,g,b)>170&&Math.max(r,g,b)-Math.min(r,g,b)<35;});
 selectedWhites=whites.filter(c=>c.count>180&&c.cx/png.width>rect[0]&&c.cx/png.width<rect[2]&&c.cy/png.height>rect[1]&&c.cy/png.height<rect[3]);
 for(const [sx,sy]of profile.handSeeds[receipt.scene]){
  const x=sx*png.width,y=sy*png.height;
  const distances=whites.filter(c=>c.count>100).map(c=>{let distance=Infinity;for(const p of c.indices){const dx=p%png.width-x,dy=Math.floor(p/png.width)-y;distance=Math.min(distance,dx*dx+dy*dy);}return {c,distance};}).sort((a,b)=>a.distance-b.distance);
  if(!distances[0]||distances[0].distance>35*35)throw new Error(`${id}: hand seed needs inspection at ${sx},${sy}`);
  if(!selectedWhites.includes(distances[0].c))selectedWhites.push(distances[0].c);
 }
 for(const c of selectedWhites)for(const p of c.indices)if(!labels[p])labels[p]=1;
 const dark=new Uint8Array(labels.length),eroded=new Uint8Array(labels.length);
 for(let p=0;p<labels.length;p++){const i=p*4,x=p%png.width/png.width,y=Math.floor(p/png.width)/png.height;if(!labels[p]&&png.data[i+3]>230&&Math.max(png.data[i],png.data[i+1],png.data[i+2])<75&&x>rect[0]-.07&&x<rect[2]+.03&&y>.025&&y<rect[3]+.015)dark[p]=1;}
 const radius=Math.max(4,Math.round(7*png.width/1536));
 for(let p=0;p<labels.length;p++)if(dark[p]){const x=p%png.width,y=Math.floor(p/png.width);let interior=true;for(const [dx,dy]of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius+2,-radius+2],[radius-2,radius-2]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=png.width||yy>=png.height||!dark[yy*png.width+xx])interior=false;}if(interior)eroded[p]=1;}
 const hairCore=components(png,p=>Boolean(eroded[p])).sort((a,b)=>b.count-a.count)[0];
 if(!hairCore||hairCore.count<500)throw new Error(`${id}: no separate hair interior`);
 for(const p of hairCore.indices){const x=p%png.width,y=Math.floor(p/png.width);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy,q=yy*png.width+xx;if(xx>=0&&yy>=0&&xx<png.width&&yy<png.height&&dark[q]&&!labels[q])labels[q]=3;}}
 for(const [region,label]of [['skin',1],['clothes',2],['hair',3]]){
  const mask=new PNG({width:png.width,height:png.height});let count=0;for(let p=0;p<labels.length;p++)if(labels[p]===label){mask.data.fill(255,p*4,p*4+4);count++;}
  if(count<100)throw new Error(`${id}: empty ${region} mask`);const maskFile=`masks/${id}-${region}.png`,maskBytes=PNG.sync.write(mask);pendingMasks.set(maskFile,maskBytes);masks[region]=maskFile;maskSha256[region]=hash(maskBytes);counts[region]=count;
 }
 }
 const variant={id,characterId:receipt.characterId,sceneId:receipt.scene,expression:receipt.expression,outfit:receipt.outfit,accessory:receipt.accessory??profile?.defaultAccessory??'none',file,sha256:hash(bytes),width:png.width,height:png.height,masks,maskSha256,palette:override?.palette??source.palette,...(override?{}:{calibration:measureCharacterPalette(png.data,labels)}),approved:false};
 // Construction success is not visual approval. Changed pixels revoke the review.
 variant.approved=characterReviewApproved(reviews.variants[id],variant);variants.push(variant);
 audit.push({id,counts,skinComponents:selectedWhites.map(({count,cx,cy,minX,minY,maxX,maxY})=>({count,cx:Math.round(cx),cy:Math.round(cy),bounds:[minX,minY,maxX,maxY]})),transparentPixels:[...png.data.filter((_,i)=>i%4===3)].filter(a=>a===0).length});
}
const manifest=CharacterManifestSchema.parse({schema:'deck-studio/characters/1',characters,scenes:source.scenes,variants});
await mkdir(`${root}/masks`,{recursive:true});
for(const [path,bytes]of pendingMasks){let current;try{current=await readFile(`${root}/${path}`);}catch(error){if(error.code!=='ENOENT')throw error;}if(!current||!current.equals(bytes))await writeFile(`${root}/${path}`,bytes);}
const temporary=`${root}/manifest.json.tmp`;
try{await writeFile(temporary,JSON.stringify(manifest,null,2));await rename(temporary,`${root}/manifest.json`);}finally{await rm(temporary,{force:true});}
await writeFile(`${root}/mask-audit.json`,JSON.stringify(audit,null,2));
await writeFile(`${root}/prompts.json`,JSON.stringify({tool:'built-in imagegen',assets:await Promise.all((await readdir(`${root}/receipts`)).filter(n=>n.endsWith('.json')).sort().map(async file=>({id:file.slice(0,-5),...JSON.parse(await readFile(`${root}/receipts/${file}`,'utf8'))})))},null,2));
console.log(`Built ${characters.length} identities, ${variants.length} raster variants; ${variants.filter(v=>v.approved).length} reviewed, ${variants.filter(v=>!v.approved).length} pending review`);
