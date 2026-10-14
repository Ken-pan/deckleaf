import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide, element, newDeck, validateDeck, type Deck, type PageElements} from '../src/core/model';
import {applyOperations} from '../src/core/operations';
import {COLLECTIONS, templateDeck, templateLibraryDeck, createLayout, scaleTemplateSlide} from '../src/core/templates';
import {DEFAULT_PAGE_ELEMENTS, setSlidePageElements} from '../src/core/page-elements';
import {pageElementFitIssues} from '../src/core/page-element-fit';
import {layoutObjectRole} from '../src/core/layout-content';
import {buildHtml} from '../src/core/export';
import {buildPptx} from '../src/core/pptx-export';
import JSZip from 'jszip';
import {PNG} from 'pngjs';

const settings: PageElements = {...DEFAULT_PAGE_ELEMENTS, header: '{title} · {section}', footer: 'Atlas · Confidential', date: 'October 2026', numberFormat: 'total', divider: true, hideOnCover: false, hideOnBreaks: false};
const field = (deck: Deck, index: number, kind: string) => deck.slides[index].elements.find(e => e.pageElement?.kind === kind)!;

test('all six stories and every current template retain content while adding editable page elements', () => {
  for (const collection of COLLECTIONS) {
    const deck = templateLibraryDeck(collection.id), before = JSON.stringify(deck);
    const next = applyOperations(deck, [{op: 'set_page_elements', settings}]);
    assert.equal(JSON.stringify(deck), before); assert.equal(next.revision, deck.revision + 1);
    for (let i = 0; i < deck.slides.length; i++) {
      assert.equal(field(next, i, 'page-number').text, `${i + 1} / ${deck.slides.length}`);
      assert.equal(field(next, i, 'header').text, `${deck.title} · ${deck.slides[i].pageSection}`);
      assert.equal(field(next, i, 'footer').text, settings.footer);
      assert.equal(field(next, i, 'date').text, settings.date);
      assert.equal(next.slides[i].elements.filter(e => e.pageElement?.kind === 'header').length, 1);
      assert.deepEqual(next.slides[i].elements.filter(e => !e.pageElement), deck.slides[i].elements.filter(e => !e.pageElement));
      assert.deepEqual(next.slides[i].autoLayouts, deck.slides[i].autoLayouts);
      for (const e of next.slides[i].elements.filter(e => e.pageElement)) {
        assert.equal(e.locked, false); assert.equal(layoutObjectRole(e, next), 'auxiliary');
        assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= next.width + .1 && e.y + e.h <= next.height + .1, `${collection.id}/${i}/${e.name} stays in page bounds`);
      }
      const footer = field(next, i, 'footer'), date = field(next, i, 'date'), number = field(next, i, 'page-number');
      assert.ok(footer.x + footer.w <= date.x); assert.ok(date.x + date.w <= number.x);
    }
    const again = applyOperations(next, [{op: 'set_page_elements', settings}]);
    assert.deepEqual(again.slides, next.slides);
    assert.equal(validateDeck(JSON.parse(JSON.stringify(next))).slides.length, deck.slides.length);
  }
});

test('numbering and title fields follow reorder, insertion, deletion and rename', () => {
  let deck = applyOperations(templateDeck('minimal'), [{op: 'set_page_elements', settings: {...settings, startAt: 0, hideOnCover: true}}]);
  const total = deck.slides.length, cover = deck.slides[0], second = deck.slides[1];
  assert.ok(field(deck, 0, 'page-number').hidden);
  deck = applyOperations(deck, [{op: 'reorder_slides', ids: [second.id, cover.id, ...deck.slides.slice(2).map(s => s.id)]}]);
  assert.equal(field(deck, 0, 'page-number').text, `0 / ${total}`); assert.equal(field(deck, 0, 'page-number').hidden, false);
  assert.equal(field(deck, 1, 'page-number').text, `1 / ${total}`); assert.equal(field(deck, 1, 'page-number').hidden, true);
  const added = blankSlide();
  deck = applyOperations(deck, [{op: 'add_slide', slide: added, afterId: second.id}, {op: 'rename_deck', title: 'New deck title'}]);
  assert.equal(field(deck, 1, 'page-number').text, `1 / ${total + 1}`); assert.equal(field(deck, 1, 'footer').text, settings.footer);
  assert.ok(field(deck, 0, 'header').text.startsWith('New deck title ·'));
  deck = applyOperations(deck, [{op: 'delete_slide', slideId: added.id}]);
  assert.equal(field(deck, 1, 'page-number').text, `1 / ${total}`);
});

test('this-slide overrides do not change defaults or source objects; direct text edits persist', () => {
  const source = blankSlide(), caption = element('text', {text: 'Original imported footer', y: 742});
  source.source = {provider: 'PPTX', fidelity: 'converted', warnings: ['Source preserved']}; source.elements = [caption];
  const deck = newDeck('Imported', [source, blankSlide()]), before = JSON.stringify(deck);
  const next = applyOperations(deck, [{op: 'set_page_elements', settings, slideIds: [source.id]}]);
  assert.equal(JSON.stringify(deck), before); assert.equal(next.pageElements, undefined);
  assert.deepEqual(next.slides[1], deck.slides[1]); assert.deepEqual(next.slides[0].elements[0], caption); assert.deepEqual(next.slides[0].source, source.source);
  const footer = field(next, 0, 'footer');
  const edited = applyOperations(next, [{op: 'update_element', slideId: source.id, elementId: footer.id, patch: {text: 'My own footer'}}]);
  const renamed = applyOperations(edited, [{op: 'rename_deck', title: 'Renamed'}]);
  assert.equal(field(renamed, 0, 'footer').text, 'My own footer');
});

test('locked layers and stale proposals reject the whole change atomically', () => {
  const deck = templateDeck('portfolio'); field(deck, 1, 'page-number').locked = true;
  const before = JSON.stringify(deck);
  assert.throws(() => applyOperations(deck, [{op: 'set_page_elements', settings}]), /Unlock/);
  assert.equal(JSON.stringify(deck), before);
  assert.throws(() => applyOperations(deck, [{op: 'set_page_elements', settings}], 999, 'ai'), /document has changed/);
  assert.throws(() => applyOperations(deck, [{op: 'set_page_elements', settings, slideIds: ['missing']}]), /Slide no longer exists/);
});

test('manually hidden page elements stay hidden during unrelated edits', () => {
  const deck = applyOperations(templateDeck('minimal'), [{op: 'set_page_elements', settings}]);
  const footer = field(deck, 1, 'footer'), slide = deck.slides[1];
  const hidden = applyOperations(deck, [{op: 'update_element', slideId: slide.id, elementId: footer.id, patch: {hidden: true, x: 140}}]);
  const renamed = applyOperations(hidden, [{op: 'rename_deck', title: 'A new title'}]);
  assert.equal(field(renamed, 1, 'footer').hidden, true); assert.equal(field(renamed, 1, 'footer').x, 140);
});

test('cover footers replace existing brand labels and stay clear of full-height artwork', () => {
  for (const collection of ['portfolio','proposal']) {
    const deck=templateDeck(collection), cover=deck.slides[0];
    assert.equal(cover.elements.filter(e=>e.pageElement?.kind==='footer').length,0);
    const next=applyOperations(deck,[{op:'set_page_elements',settings}]),updated=next.slides[0];
    assert.equal(updated.elements.filter(e=>e.pageElement?.kind==='footer').length,1);
    assert.ok(!updated.elements.some(e=>['RESEARCH / STRATEGY / DESIGN','DIRECTION / SCOPE / DELIVERY'].includes(e.text)));
    for(const image of updated.elements.filter(e=>e.type==='image'&&e.y===0&&e.h===next.height))
      for(const e of updated.elements.filter(e=>e.pageElement&&e.pageElement.kind!=='header'&&e.pageElement.kind!=='logo'))assert.ok(e.x+e.w<image.x);
  }
});

test('square and wide logos and all text fields stay inside the cover paper panel', () => {
  const logo=element('image',{src:'data:image/png;base64,YQ==',name:'Logo'}),deck=templateDeck('portfolio');
  const next=applyOperations(deck,[{op:'set_page_elements',settings:{...settings,logo}}]);
  const cover=next.slides[0],photo=cover.elements.find(e=>e.type==='image'&&!e.pageElement&&e.y===0)!;
  for(const field of cover.elements.filter(e=>e.pageElement))assert.ok(field.x+field.w<photo.x);
  assert.ok(cover.elements.find(e=>e.pageElement?.kind==='logo')!.x+cover.elements.find(e=>e.pageElement?.kind==='logo')!.w<cover.elements.find(e=>e.pageElement?.kind==='header')!.x);
});

test('fixed page bands cannot wrap into body content and legacy divider positions update together', () => {
  let deck=applyOperations(templateDeck('report'),[{op:'set_page_elements',settings}]);
  const divider=field(deck,0,'divider');divider.y=738;
  deck=applyOperations(deck,[{op:'set_page_elements',settings}]);
  for(const s of deck.slides)for(const e of s.elements.filter(e=>e.pageElement&&e.type==='text')){
    assert.equal(e.textSizing,'fixed');assert.equal(e.wrap,false);assert.equal(e.maxLines,1);assert.equal(e.h,30);assert.ok(e.lineHeight>=1.6);
    assert.equal(e.y,764);
  }
  assert.equal(field(deck,0,'divider').y,752);
});

test('fit validation measures full text, including hidden overflow, and ignores fields hidden on the cover', () => {
  const deck=applyOperations(templateDeck('portfolio'),[{op:'set_page_elements',settings}]),s=deck.slides[0];
  assert.equal(pageElementFitIssues(deck,s,e=>({w:e.w,h:e.h})).length,0);
  const issues=pageElementFitIssues(deck,s,e=>({w:e.w+100,h:e.h}));
  assert.ok(issues.some(e=>e.kind==='header'));assert.ok(issues.some(e=>e.kind==='footer'));
  const hidden=applyOperations(deck,[{op:'set_page_elements',settings:{...settings,hideOnCover:true}}]);
  assert.equal(pageElementFitIssues(hidden,hidden.slides[0],e=>({w:e.w+100,h:e.h+100})).length,0);
});

test('scaled templates, logos and HTML/PPTX exports use ordinary editable elements', async () => {
  const bitmap = new PNG({width: 80, height: 24}); bitmap.data.fill(128);
  const logo = element('image', {name: 'User image', src: 'data:image/png;base64,'+PNG.sync.write(bitmap).toString('base64'), w: 80, h: 24});
  const source = scaleTemplateSlide(createLayout('agenda', 1, 'report'), 960, 540);
  const deck = newDeck('Report', [source], 960, 540);
  const next = applyOperations(deck, [{op: 'set_page_elements', settings: {...settings, logo}}]);
  assert.equal(field(next, 0, 'logo').src, logo.src); assert.equal(field(next, 0, 'logo').fit, 'contain');
  assert.ok(field(next, 0, 'logo').x + field(next, 0, 'logo').w < field(next, 0, 'header').x);
  const portable = {...next, designSystem: undefined, slides: [{...next.slides[0], groups: undefined, autoLayouts: undefined, elements: next.slides[0].elements.filter(e => e.pageElement).map(e => ({...e, fontFamily: 'Arial', design: undefined}))}]};
  const html = await (await buildHtml(portable)).text();
  assert.ok(html.includes('Atlas · Confidential')); assert.ok(html.includes('October 2026')); assert.ok(html.includes('1 / 1'));
  const zip=await JSZip.loadAsync(await buildPptx(portable,false,async()=>({w:128,h:128})));
  const xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.ok(xml.includes('Atlas · Confidential'));assert.ok(xml.includes('October 2026'));assert.ok(xml.includes('1 / 1'));assert.ok(xml.includes('<p:pic>'));
  const cleared = setSlidePageElements(next, next.slides[0], {...settings, header: '', footer: '', date: '', pageNumbers: false, divider: false}, 0);
  assert.equal(cleared.elements.filter(e => e.pageElement).length, 0);
  assert.deepEqual(cleared.elements, source.elements.filter(e => !e.pageElement));
});

test('native decks contain only quiet folios, with no repeated brand, labels or rules', () => {
  for (const collection of COLLECTIONS) {
    const deck = templateLibraryDeck(collection.id);
    assert.deepEqual(deck.pageElements, DEFAULT_PAGE_ELEMENTS);
    for (const slide of deck.slides) {
      const details = slide.elements.filter(e => e.pageElement);
      assert.equal(details.length, 1);
      assert.equal(details[0].pageElement?.kind, 'page-number');
      assert.equal(details[0].fontSize, 16);
      assert.ok(!slide.elements.some(e => e.src?.includes('/brand/')));
      const clean = ['cover','section','statement','close','q-and-a'].includes(slide.template!.prototype);
      assert.equal(details[0].hidden, clean);
    }
  }
});

test('content-only visibility survives reordering and new slides; all-slide visibility is explicit', () => {
  let deck = applyOperations(templateDeck('portfolio'), [{op:'set_page_elements',settings:{...DEFAULT_PAGE_ELEMENTS,header:'{section}'}}]);
  const section = deck.slides.find(s => s.template?.prototype === 'section')!;
  assert.ok(section.elements.filter(e => e.pageElement).every(e => e.hidden));
  const second=deck.slides[1];
  deck=applyOperations(deck,[{op:'reorder_slides',ids:[second.id,...deck.slides.filter(s=>s.id!==second.id).map(s=>s.id)]}]);
  assert.equal(field(deck,0,'page-number').hidden,false);
  assert.equal(field(deck,1,'page-number').hidden,true);
  const chapter=createLayout('section',1,'portfolio');
  deck=applyOperations(deck,[{op:'add_slide',slide:chapter}]);
  assert.ok(deck.slides.at(-1)!.elements.filter(e=>e.pageElement).every(e=>e.hidden));
  deck=applyOperations(deck,[{op:'set_page_elements',settings:{...DEFAULT_PAGE_ELEMENTS,hideOnCover:false,hideOnBreaks:false}}]);
  assert.ok(deck.slides.every(s=>s.elements.filter(e=>e.pageElement).every(e=>!e.hidden)));
});
