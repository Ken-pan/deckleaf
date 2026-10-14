import { test } from 'node:test';
import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { importPptx } from '../src/importers/pptx';

test('PPTX imports preserve presentation relationship order, images, table cells and notes', async () => {
  const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE';
  const a = p.addSlide(); a.addText('FIRST original text', {x: 1, y: 1, w: 5, h: .8, fontSize: 32, fontFace: 'Arial', color: '123456'}); a.addNotes('Exact notes');
  a.addShape(p.ShapeType.rect, {x: 1, y: 3, w: 2, h: 1, fill: {color: 'ABCDEF'}});
  a.addTable([[{text: 'Column A'}, {text: 'Column B'}], [{text: 'One'}, {text: 'Two'}]], {x: 5, y: 3, w: 5, h: 2, fontSize: 18});
  a.addImage({data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', x: 8, y: 1, w: 1, h: 1});
  a.addText('OVERLAY last layer', {x: 8, y: 1, w: 3, h: 1});
  const b = p.addSlide(); b.addText('SECOND original text', {x: 1, y: 1, w: 6, h: 1});
  const zip = await JSZip.loadAsync(await p.write({outputType: 'uint8array'}) as Uint8Array);
  let xml = await zip.file('ppt/presentation.xml')!.async('string');
  const ids = xml.match(/<p:sldId [^>]+\/>/g)!;
  xml = xml.replace(ids[0], '__FIRST__').replace(ids[1], ids[0]).replace('__FIRST__', ids[1]); zip.file('ppt/presentation.xml', xml);
  const d = await importPptx(await zip.generateAsync({type: 'uint8array'}), 'fixture.pptx');
  assert.equal(d.slides.length, 2); assert(d.slides[0].elements.some(e => e.text.includes('SECOND')));
  const first = d.slides[1]; assert.equal(first.notes, 'Exact notes');
  assert(first.elements.some(e => e.type === 'image' && e.src?.startsWith('data:image/png')));
  assert.deepEqual(first.elements.find(e => e.type === 'table')?.cells, [['Column A', 'Column B'], ['One', 'Two']]);
  assert.equal(first.elements.find(e => e.text === 'FIRST original text')?.fill, '#123456');
  assert(first.elements.findIndex(e => e.type === 'image') < first.elements.findIndex(e => e.text === 'OVERLAY last layer'), 'XML layer order must survive interleaved object types');
});
