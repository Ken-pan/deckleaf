import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';import {newDeck,blankSlide,element} from '../src/core/model';import {buildPptx} from '../src/core/pptx-export';

function methods(bytes:Uint8Array){
  const data=Buffer.from(bytes),out=new Map<string,number>();
  for(let at=0;at<data.length-46;at++)if(data.readUInt32LE(at)===0x02014b50){
    const name=data.readUInt16LE(at+28),extra=data.readUInt16LE(at+30),comment=data.readUInt16LE(at+32);
    out.set(data.subarray(at+46,at+46+name).toString(),data.readUInt16LE(at+10));at+=45+name+extra+comment;
  }
  return out;
}
test('JPEG bytes remain stored without recompression while editable XML stays compressed',async()=>{
  const jpeg=await readFile('public/examples/template-assets/paper-study.jpg'),slide=blankSlide('Original JPEG');
  slide.notes='Original note';slide.elements=[element('image',{src:'data:image/jpeg;base64,'+jpeg.toString('base64')}),element('text',{text:'Editable source text'})];
  const deck=newDeck('Compressed photo',[slide]),before=JSON.stringify(deck),bytes=await buildPptx(deck,false,async()=>({w:800,h:600})),zip=await JSZip.loadAsync(bytes);
  const images=Object.keys(zip.files).filter(f=>/^ppt\/media\/.*\.jpe?g$/.test(f));assert.equal(images.length,1);assert.deepEqual(Buffer.from(await zip.file(images[0])!.async('uint8array')),jpeg);
  const encoded=methods(bytes);assert.equal(encoded.get(images[0]),0);assert.equal(encoded.get('ppt/slides/slide1.xml'),8);assert.equal(JSON.stringify(deck),before);
  assert((await zip.file('ppt/slides/slide1.xml')!.async('string')).includes('Editable source text'));
});
