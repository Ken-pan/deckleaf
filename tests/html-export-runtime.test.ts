import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createTypography } from '../src/core/typography';
import {createImageRendering} from '../src/core/image-style';
import { element } from '../src/core/model';

test('downloaded HTML typography works in a context with no application imports', () => {
  // tsx adds a function-name helper; the production bundler omits it.
  const factory = runInNewContext(`(${createTypography.toString()})`, {__name: (fn: Function) => fn});
  const styles = factory((family: string) => `"${family}",sans-serif`);
  const text = element('text', {padding: {top: 4, right: 8, bottom: 4, left: 8}});
  assert.match(styles.textBoxStyle(text), /padding:4px 8px 4px 8px/);
  assert.match(styles.runStyle({text: 'Independent export', bold: true, fontFamily: 'Manrope'}), /font-weight:700/);
  assert.match(createImageRendering().imageStyle(element('image', {fit: 'contain'})), /object-fit:contain/);
});

test('portable HTML embeds repeated local evidence once without mutating source documents',async()=>{
 const {buildHtml}=await import('../src/core/export');const {newDeck,blankSlide}=await import('../src/core/model');
 const slide=blankSlide();slide.source={provider:'PDF',render:'/examples/shared.png',warnings:['Original source'],fidelity:'source-render'};
 slide.elements=[element('image',{src:'/examples/shared.png',fontFamily:'Arial'}),element('text',{text:'</script> 中文',fontFamily:'Arial'})];
 const deck=newDeck('Portable',[slide]),before=JSON.stringify(deck),originalFetch=globalThis.fetch,originalReader=globalThis.FileReader;let requests=0;
 globalThis.fetch=async input=>{if(String(input).startsWith('/fonts/'))return new Response(await (await import('node:fs/promises')).readFile('public'+String(input)));requests++;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});};
 class Reader {result='';error=null;onload?:()=>void;onerror?:()=>void;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(data=>{this.result=`data:${blob.type};base64,${Buffer.from(data).toString('base64')}`;this.onload?.();});}}
 globalThis.FileReader=Reader as unknown as typeof FileReader;
 try{
  const blob=await buildHtml(deck);assert.equal(blob.type,'text/html');const html=await blob.text();const json=html.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/)![1];
  assert(!json.includes('<'));const saved=JSON.parse(json);assert.equal(saved.slides[0].source.render,'data:image/png;base64,AQID');assert.equal(saved.slides[0].elements[0].src,saved.slides[0].source.render);assert.equal(saved.slides[0].elements[1].text,'</script> 中文');assert.equal(requests,1);assert.equal(JSON.stringify(deck),before);
 }finally{globalThis.fetch=originalFetch;globalThis.FileReader=originalReader;}
});
