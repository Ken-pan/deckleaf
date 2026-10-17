import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rename, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {blankSlide, element, newDeck} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {LibraryPreviewQueue} from '../src/core/library-preview-queue';

process.env.DECK_STUDIO_DATA = await mkdtemp(join(tmpdir(), 'deck-library-loading-'));
const store = await import('../server/store');
await store.initStore();

test('summaries survive preview eviction and reflect saves, same-revision external replacements, deletion and corruption', async () => {
  const deck = newDeck('Library fixture', [blankSlide('First')]);
  deck.slides[0].elements = [element('image', {src: 'data:image/png;base64,' + 'A'.repeat(100_000)})];
  for (let n = 0; n < 105; n++) await store.saveDeck({...deck, id: `library-${n}`}, null);
  const initial = await store.listDecks(false);
  assert.equal(initial.length, 105);
  assert(!JSON.stringify(initial).includes('base64'));
  assert(initial.every(item => !('firstSlide' in item)));
  for (const summary of initial) await store.readLibraryPreview(summary.id, summary.revision);
  assert.deepEqual(await store.listDecks(false), initial);
  const selected = {...deck, id: 'library-0'};
  const first = await store.readLibraryPreview(selected.id, 0);
  first.firstSlide!.title = 'Caller mutation';
  assert.equal((await store.readLibraryPreview(selected.id, 0)).firstSlide!.title, 'First');
  const next = applyOperations(selected, [{op: 'rename_deck', title: 'Updated'}]);
  await store.saveDeck(next, 0);
  await assert.rejects(store.readLibraryPreview(selected.id, 0), {status: 409});
  assert.equal((await store.readLibraryPreview(selected.id, 1)).title, 'Updated');
  const path = join(store.DATA, 'decks', selected.id + '.json');
  await writeFile(path + '.replacement', JSON.stringify({...next, title: 'External replacement'}));
  await rename(path + '.replacement', path);
  assert.equal((await store.listDecks(false)).find(item => item.id === selected.id)?.title, 'External replacement');
  assert.equal((await store.readLibraryPreview(selected.id, 1)).title, 'External replacement');
  await writeFile(path, '{preserved broken source');
  assert.equal((await store.listDecks(false)).length, 104);
  await assert.rejects(store.readLibraryPreview(selected.id));
  await unlink(join(store.DATA, 'decks', 'library-1.json'));
  assert.equal((await store.listDecks(false)).length, 103);
  await assert.rejects(store.readLibraryPreview('library-1'), {code: 'ENOENT'});
  await assert.rejects(store.readLibraryPreview('../outside'), /Invalid ID/);
  await assert.rejects(store.readLibraryPreview('library-2', NaN), {status: 422});
});

const turn = () => new Promise<void>(resolve => setImmediate(resolve));
test('preview queue bounds work, skips cancelled cards and rejects late results even when transport ignores abort', async () => {
  const queue = new LibraryPreviewQueue(2);
  const controllers = Array.from({length: 5}, () => new AbortController());
  const started: number[] = [], release: (() => void)[] = [];
  const pending = controllers.map((controller, index) => queue.run(async () => {
    started.push(index);
    await new Promise<void>(resolve => {release[index] = resolve;});
    return index;
  }, controller.signal));
  // Install handlers before cancelling requests.
  const outcomes = pending.map(promise => promise.then(value => value, error => error.name));
  await turn(); assert.deepEqual(started, [0, 1]);
  controllers[0].abort(); controllers[2].abort();
  await turn(); assert.deepEqual(started, [0, 1]);
  release[0](); await turn(); assert.deepEqual(started, [0, 1, 3]);
  release[1](); await turn(); assert.deepEqual(started, [0, 1, 3, 4]);
  release[3](); release[4]();
  assert.deepEqual(await Promise.all(outcomes), ['AbortError', 1, 'AbortError', 3, 4]);
});
