import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url),entry=new URL('plugins/figma-export/pptx.ts',root),ui=new URL('plugins/figma-export/ui.html',root);
const result=await build({configFile:false,logLevel:'warn',build:{write:false,minify:'esbuild',lib:{entry:entry.pathname,name:'DeckStudioPptx',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}}}});
const output=(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk');if(!output)throw new Error('The Figma exporter did not build.');
let html=await readFile(ui,'utf8');const script=`<!-- deck-studio-pptx:start --><script>${output.code.replace(/<\/script/gi,'<\\/script')}</script><!-- deck-studio-pptx:end -->`;
html=/<!-- deck-studio-pptx:start -->[\s\S]*?<!-- deck-studio-pptx:end -->/.test(html)?html.replace(/<!-- deck-studio-pptx:start -->[\s\S]*?<!-- deck-studio-pptx:end -->/,()=>script):html.replace('<script>',script+'<script>');
await writeFile(ui,html);console.log(`Built offline Figma PPTX exporter (${(Buffer.byteLength(output.code)/1024).toFixed(1)} KB).`);
