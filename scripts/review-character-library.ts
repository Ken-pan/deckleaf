import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {PNG} from 'pngjs';
import {CharacterManifestSchema,CharacterReviewSchema,REGION_NAMES} from '../src/core/characters';

const {values}=parseArgs({options:{variants:{type:'string'},reviewer:{type:'string'},evidence:{type:'string'},checks:{type:'string'},decision:{type:'string',default:'approved'}}});
if(!values.variants||!values.reviewer||!values.evidence||!values.checks)throw new Error('Provide --variants=id,id --reviewer=name --evidence=artifact --checks=identity,anatomy,alpha,regions. This records an already completed visual review; it does not perform one.');
const root='public/resources/characters-v1',hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const manifest=CharacterManifestSchema.parse(JSON.parse(await readFile(`${root}/manifest.json`,'utf8')));
const reviews=CharacterReviewSchema.parse(JSON.parse(await readFile(`${root}/reviews.json`,'utf8')));
const completed=new Set(values.checks.split(','));
for(const id of values.variants.split(',')){
  const variant=manifest.variants.find(v=>v.id===id);if(!variant)throw new Error(`Unknown variant: ${id}`);
  const original=await readFile(`${root}/${variant.file}`),image=PNG.sync.read(original),labels=new Uint8Array(image.width*image.height);
  if(hash(original)!==variant.sha256)throw new Error(`${id}: source changed since build`);
  const maskSha256={} as Record<typeof REGION_NAMES[number],string>;
  for(const region of REGION_NAMES){
    const bytes=await readFile(`${root}/${variant.masks[region]}`),mask=PNG.sync.read(bytes);maskSha256[region]=hash(bytes);
    if(mask.width!==image.width||mask.height!==image.height)throw new Error(`${id}: mask dimensions differ`);
    for(let p=0;p<labels.length;p++)if(mask.data[p*4+3]){if(labels[p]||!image.data[p*4+3])throw new Error(`${id}: mask overlap/background leak`);labels[p]=1;}
    if(variant.maskSha256&&variant.maskSha256[region]!==maskSha256[region])throw new Error(`${id}: masks changed since build`);
  }
  if(values.decision==='approved'&&!['identity','anatomy','alpha','regions'].every(check=>completed.has(check)))throw new Error(`${id}: all four visual checks are required for approval`);
  reviews.variants[id]=CharacterReviewSchema.shape.variants.element.parse({decision:values.decision,sourceSha256:variant.sha256,maskSha256,reviewer:values.reviewer,evidence:values.evidence,reviewedAt:new Date().toISOString(),checks:{identity:completed.has('identity'),anatomy:completed.has('anatomy'),alpha:completed.has('alpha'),regions:completed.has('regions')}});
}
const temporary=`${root}/reviews.json.${randomUUID()}.tmp`;
try{await writeFile(temporary,JSON.stringify(reviews,null,2),{flag:'wx'});await rename(temporary,`${root}/reviews.json`);}finally{await rm(temporary,{force:true});}
console.log(`Recorded ${values.variants.split(',').length} explicit reviews. Run characters:build to publish matching assets.`);
