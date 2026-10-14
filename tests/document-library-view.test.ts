import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryDocuments, releaseLibraryPreviews, type LibraryDocument } from '../src/core/document-library-view';
import {blankSlide,element} from '../src/core/model';

const documents: LibraryDocument[] = [
  {id:'older', title:'Project 10', updatedAt:'2026-10-11T18:00:00.000Z', width:1440, height:810, count:8},
  {id:'newer', title:'Project 2', updatedAt:'2026-10-13T18:00:00.000Z', width:1440, height:810, count:10},
  {id:'unicode', title:'作品集 · Recovery draft', updatedAt:'2026-10-12T18:00:00.000Z', width:1440, height:810, count:8},
];

test('library sorts copies, preserving documents and ordering numbered titles naturally', () => {
  const before = structuredClone(documents);
  assert.deepEqual(libraryDocuments(documents, '', 'recent').map(d => d.id), ['newer', 'unicode', 'older']);
  assert.deepEqual(libraryDocuments(documents, '', 'oldest').map(d => d.id), ['older', 'unicode', 'newer']);
  assert.deepEqual(libraryDocuments(documents, 'PROJECT', 'title').map(d => d.id), ['newer', 'older']);
  assert.deepEqual(documents, before);
});

test('library search trims whitespace, supports user titles and empty results without losing documents', () => {
  assert.deepEqual(libraryDocuments(documents, '  作品集  ', 'recent').map(d => d.id), ['unicode']);
  assert.deepEqual(libraryDocuments(documents, 'no such title', 'recent'), []);
  assert.equal(libraryDocuments(documents, '  ', 'recent').length, documents.length);
});

test('closing the library drops embedded previews while preserving every summary and its input', () => {
  const preview=blankSlide();preview.elements=[element('image',{src:'data:image/png;base64,'+'A'.repeat(100_000)})];
  const loaded=[{...documents[0],firstSlide:preview},documents[1]];
  const released=releaseLibraryPreviews(loaded);
  assert.deepEqual(released,[documents[0],documents[1]]);
  assert.equal(loaded[0].firstSlide,preview);
  assert(!released.some(document=>'firstSlide' in document));
  assert.equal(releaseLibraryPreviews(released),released);
  assert.equal(libraryDocuments(released,'Project','title')[0].id,'newer');
});
