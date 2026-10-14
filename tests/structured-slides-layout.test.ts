import { test } from 'node:test';
import assert from 'node:assert/strict';
import { structuredSamples } from './fixtures/structured-slide-samples';
import { importLegacySlides } from '../src/importers/structured';
import { blankSlide, element, newDeck, ElementSchema } from '../src/core/model';
import { createLayoutCandidate, layoutCandidates, layoutProposal } from '../src/core/auto-layout';
import { applyOperations } from '../src/core/operations';
import { scaledTextStyle } from '../src/core/text-sizing';

const corpus = structuredSamples;
test('all 30 synthetic structured pages import exact narration, content, choices and provenance without template copy', () => {
  let count = 0;
  for (const {raw} of corpus) {
    const untouched = JSON.stringify(raw), deck = importLegacySlides(raw); count += deck.slides.length;
    assert.equal(deck.provenance?.provider, 'Structured slides');
    deck.slides.forEach((slide, i) => {
      const original = raw.slides[i], visible = slide.elements.map(e => e.text).join('\n'), complete = visible + '\n' + slide.notes;
      assert.equal(slide.title, undefined); assert(visible.includes(original.title)); assert(visible.includes(original.body));
      assert(slide.notes.includes(original.narration.script)); assert.equal(slide.source?.label, original.id);
      for (const item of original.items ?? []) for (const field of [item.label, item.title, item.body, item.artifact?.src]) if (field) assert(complete.includes(field), `${raw.title}/${original.id}/${field}`);
      for (const choice of original.choices ?? []) {assert(visible.includes(choice.text)); assert(slide.notes.includes(`${choice.label}: ${choice.text}`));}
      for (const meta of original.meta ?? []) {assert(visible.includes(meta.label)); assert(visible.includes(meta.value));}
      assert(!/Record the evidence|Add project details|Add a screenshot|Add screenshots|Source and context/.test(visible));
      assert(slide.elements.every(e => e.sourceId?.startsWith(`portfolio:${original.id}:`)));
    });
    assert.equal(JSON.stringify(raw), untouched);
  }
  assert.equal(count, 30);
});
test('a synthetic gallery keeps all four source images and captions; sequence pages retain their selected evidence', () => {
  const {raw} = corpus[1], deck = importLegacySlides(raw), index = raw.slides.findIndex((s: any) => s.template === 'gallery');
  const original = raw.slides[index], page = deck.slides[index];
  assert.deepEqual(page.elements.filter(e => e.type === 'image').map(e => e.src), original.items.map((i: any) => i.artifact.src));
  assert.equal(page.elements.filter(e => e.type === 'image').length, 4);
  for (const item of original.items) assert(page.elements.some(e => e.text.includes(item.title)));
  const sequenceRaw = corpus[0].raw, sequenceDeck = importLegacySlides(sequenceRaw);
  sequenceRaw.slides.forEach((s: any, i: number) => {if (s.template === 'sequence') assert(sequenceDeck.slides[i].elements.some(e => e.src === s.artifact.src));});
});
test('structured slide transactions preserve source IDs, image crops, grouping, text, notes and untouched inputs', () => {
  for (const {raw} of corpus) {
    const deck = importLegacySlides(raw), original = JSON.stringify(deck);
    const candidates = deck.slides.map(s => layoutCandidates(deck, s.id).find(c => c.recommended)!);
    const after = applyOperations(deck, candidates.flatMap(c => c.operations));
    after.slides.forEach((s, i) => {
      const before = deck.slides[i]; assert.equal(s.notes, before.notes); assert.deepEqual(s.source, before.source);
      s.elements.forEach((e, j) => {for (const key of ['id', 'sourceId', 'text', 'src', 'fit', 'crop', 'group', 'fill', 'fontFamily'] as const) assert.deepEqual(e[key], before.elements[j][key]);});
    });
    assert.equal(JSON.stringify(deck), original);
  }
});
test('short supporting text and an image never share the same story-layout region', () => {
  const s = blankSlide(), title = element('text', {text: 'Headline', fontSize: 64}), body = element('text', {text: 'Brief explanation', fontSize: 32}), image = element('image', {src: 'data:image/png;base64,aA==', w: 600, h: 400});
  s.elements = [title, body, image]; const deck = newDeck('Short content', [s]); const c = createLayoutCandidate(deck, s.id, 'story');
  const a = c.slide.elements[1], b = c.slide.elements[2]; assert(a.y + a.h <= b.y || b.y + b.h <= a.y || a.x + a.w <= b.x || b.x + b.w <= a.x);
});
test('uniform typography can be disabled without rewriting source content', () => {
  const s = blankSlide(); s.elements = [element('text', {name: 'Title', text: 'A clear title', fontSize: 80, w: 1100}), element('text', {name: 'Body', text: 'Supporting evidence', fontSize: 34, y: 400})]; const d = newDeck('Style', [s]);
  const consistent = createLayoutCandidate(d, s.id, 'story', {spacing: 'balanced', fitText: true, consistentType: true});
  const source = createLayoutCandidate(d, s.id, 'story', {spacing: 'balanced', fitText: true, consistentType: false});
  assert.equal(consistent.slide.elements[0].fontSize, 56); assert.equal(consistent.slide.elements[1].fontSize, 28);
  assert.equal(source.slide.elements[0].fontSize, 80); assert.equal(source.slide.elements[1].fontSize, 34);
  assert.equal(source.slide.elements[0].text, s.elements[0].text);
});
test('paragraph, padding, bullet, baseline and mixed-run metrics scale without losing imported semantics', () => {
  const e = element('text', {text: 'Styled content', fontSize: 40, padding: {left: 20, top: 10, right: 20, bottom: 10}, paragraphs: [{align: 'justify', lineSpacing: 50, spaceBefore: 10, spaceAfter: 8, indent: 24, firstLineIndent: -12, bullet: '•', runs: [{text: 'Styled content', fontSize: 30, fontWeight: 600, letterSpacing: 2, baseline: 'super', color: '#26362c'}]}]});
  const patch = scaledTextStyle(e, 20), after = ElementSchema.parse({...e, ...patch});
  assert.deepEqual(after.padding, {left: 10, top: 5, right: 10, bottom: 5});
  const p = after.paragraphs![0]; assert.equal(p.lineSpacing, 25); assert.equal(p.indent, 12); assert.equal(p.firstLineIndent, -6); assert.equal(p.bullet, '•'); assert.equal(p.align, 'justify');
  assert.deepEqual(p.runs[0], {...e.paragraphs![0].runs[0], fontSize: 15, letterSpacing: 1}); assert.equal(e.paragraphs![0].lineSpacing, 50);
});
test('scaled typography remains valid at the model limits', () => {
  const e = element('text', {fontSize: 4, letterSpacing: 50, padding: {left: 2000, right: 2000, top: 2000, bottom: 2000}, runs: [{text: 'Small font', fontSize: 1, letterSpacing: 100}]});
  assert.doesNotThrow(() => ElementSchema.parse({...e, ...scaledTextStyle(e, 500)}));
});
test('unfittable imported portfolio text stays reviewable and blocks applying all layout variants', () => {
  const deck = importLegacySlides(corpus[0].raw), before = JSON.stringify(deck);
  const measure = Object.assign(() => 100, {height: () => Infinity});
  for (const slide of deck.slides) {
    const candidates = layoutCandidates(deck, slide.id, undefined, measure);
    assert.equal(candidates.length, 4);
    for (const candidate of candidates) {
      assert(candidate.issues.length > 0);
      assert(candidate.slide.elements.every(e => [e.x, e.y, e.w, e.h].every(Number.isFinite)));
      assert.throws(() => layoutProposal(deck, [candidate]));
    }
  }
  assert.equal(JSON.stringify(deck), before);
});
