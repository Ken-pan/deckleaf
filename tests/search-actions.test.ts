import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentSearchActions, findSearchActions, type SearchAction } from '../src/search-actions';
import { templateDeck } from '../src/core/templates';
const action = (id: string, label: string, extra: Partial<SearchAction> = {}): SearchAction => ({id, label, kind: 'command', disabled: false, run() {}, ...extra});

test('search accepts Unicode and spaced queries and prioritizes exact labels over content matches', () => {
  const actions = [action('content', 'Other', {searchText: 'budget 图表'}), action('prefix', 'Budget review'), action('exact', 'Budget')];
  assert.deepEqual(findSearchActions(actions, '  ＢＵＤＧＥＴ ').map(a => a.id), ['exact','prefix','content']);
  assert.deepEqual(findSearchActions(actions, 'budget   图表').map(a => a.id), ['content']);
});
test('quick suggestions do not restrict typed queries or the full command browser', () => {
  const actions = [action('common','Insert text',{suggested:true}),action('more','Insert table'),action('blocked','Export',{disabled:true})];
  assert.deepEqual(findSearchActions(actions,'','all',true).map(a=>a.id),['common']);
  assert.deepEqual(findSearchActions(actions,'insert','all',true).map(a=>a.id),['common','more']);
  assert.equal(findSearchActions(actions,'').length,3);
  assert.equal(findSearchActions(actions,'export')[0].disabled,true);
});
test('duplicate object labels retain distinct slide destinations and navigation does not change documents', () => {
  const deck=templateDeck('portfolio'), calls: string[][]=[];
  deck.slides=deck.slides.slice(0,2);
  deck.slides[0].title='First evidence';deck.slides[1].title='Second evidence';
  deck.slides.forEach(slide=>{slide.elements=slide.elements.filter(e=>e.type==='text').slice(0,1);slide.elements[0].name='Evidence';slide.elements[0].text='Find this evidence';slide.elements[0].hidden=true;});
  deck.slides[0].id='source:slide';deck.slides[1].id='source';
  deck.slides[0].elements[0].id='object';deck.slides[1].elements[0].id='slide:object';
  const before=JSON.stringify(deck), actions=documentSearchActions(deck,(slide,id)=>calls.push([slide,id??'']));
  const objects=findSearchActions(actions,'find this','object');assert.equal(objects.length,2);assert.notEqual(objects[0].id,objects[1].id);
  objects[1].run();assert.deepEqual(calls,[[deck.slides[1].id,deck.slides[1].elements[0].id]]);
  assert.match(objects[1].detail!,/Slide 2 · Hidden/);assert.equal(JSON.stringify(deck),before);
  assert.equal(documentSearchActions(deck,()=>{},true).every(a=>a.disabled),true);
  assert.equal(findSearchActions(actions,'Second evidence').length,0);
  assert.equal(actions.find(a=>a.kind==='slide')!.label,'Slide 1');
});
