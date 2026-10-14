import { blankSlide, element, newDeck, uid, type Deck, type SlideElement } from '../core/model';
import { PALETTE } from '../core/template-collections';

type Artifact = {src?: string; alt?: string; caption?: string; fit?: SlideElement['fit']};
type Item = {id?: string; label?: string; title?: string; body?: string; artifact?: Artifact; emphasis?: boolean};
type Choice = {label?: string; text?: string; chosen?: boolean};

/** Import user-supplied structured slides without inserting template placeholder copy. */
export function importPortfolioDeck(raw: any): Deck {
  const source = Array.isArray(raw) ? raw : raw.slides;
  if (!Array.isArray(source) || !source.length) throw new Error('No slides available to import.');
  const slides = source.map((legacy: any, index: number) => {
    const heading=String(legacy.title || `Slide ${index + 1}`),slide = blankSlide();
    const sourceId = String(legacy.id || `page-${index + 1}`);
    const dark = ['statement', 'takeaway'].includes(legacy.template);
    slide.background = dark ? PALETTE.dark : PALETTE.paper;
    const ink = dark ? PALETTE.onDark : PALETTE.ink, muted = dark ? '#c9d2c6' : PALETTE.muted;
    const text = (value: unknown, role: string, attrs: Partial<SlideElement>) => {
      const content = String(value ?? ''); if (!content.trim()) return;
      slide.elements.push(element('text', {text: content, name: role, sourceId: `portfolio:${sourceId}:${role}`, fill: ink, lineHeight: 1.3, ...attrs}));
    };
    text(legacy.kicker || 'CASE STUDY', 'Page header', {x: 96, y: 52, w: 1160, h: 36, fontSize: 16, fill: muted, letterSpacing: 1.2});
    text(heading, 'Display', {x: 96, y: 132, w: 1248, h: 170, fontSize: 56, fontFamily: 'Bodoni Moda', lineHeight: 1.16});
    text(legacy.body, 'Body text', {x: 96, y: 316, w: 1248, h: 114, fontSize: 28, fill: muted});

    const items: Item[] = Array.isArray(legacy.items) ? legacy.items : [];
    const choices: Choice[] = Array.isArray(legacy.choices) ? legacy.choices : [];
    const sequence = legacy.template === 'sequence';
    const primary: Artifact | undefined = legacy.artifact?.src ? legacy.artifact : sequence ? items[Number(legacy.activeItemIndex) || 0]?.artifact : undefined;
    const artifacts: {artifact: Artifact; item?: Item}[] = [];
    if (primary?.src) artifacts.push({artifact: primary});
    if (!sequence) for (const item of items) if (item.artifact?.src && !artifacts.some(a => a.artifact.src === item.artifact!.src)) artifacts.push({artifact: item.artifact, item});

    const cards = choices.length ? choices.map((choice, i) => ({label: String(choice.label || String(i + 1)), title: String(choice.text || ''), body: '', emphasis: choice.chosen, role: 'Design'}))
      : sequence ? [] : items.filter(item => !item.artifact?.src).map(item => ({label: item.label, title: item.title, body: item.body, emphasis: item.emphasis, role: 'Key point'}));
    const meta = Array.isArray(legacy.meta) ? legacy.meta : [];
    for (const entry of meta) cards.push({label: String(entry.label ?? ''), title: String(entry.value ?? ''), body: '', emphasis: false, role: 'Project details'});

    cards.forEach((card, i) => {
      const group = uid('reading'), columns = artifacts.length ? 1 : Math.min(4, Math.max(1, cards.length)), rows = Math.ceil(cards.length / columns);
      const areaW = artifacts.length ? 520 : 1248, w = (areaW - (columns - 1) * 28) / columns, h = 248 / rows;
      const x = 96 + i % columns * (w + 28), y = 442 + Math.floor(i / columns) * h;
      const label = `${card.emphasis && choices.length ? '✓ ' : ''}${card.label || ''}`;
      text(label, `${card.role}Label`, {x, y, w, h: 26, fontSize: 18, fontWeight: card.emphasis ? 700 : 500, fill: muted, group});
      text(card.title, `${card.role}Display`, {x, y: y + 32, w, h: card.body ? 68 : Math.max(30, h - 34), fontSize: card.role === 'Key point' ? 28 : 24, fontWeight: card.emphasis ? 700 : 500, group});
      text(card.body, `${card.role}Description`, {x, y: y + 108, w, h: Math.max(42, h - 116), fontSize: 22, fill: muted, group});
    });

    artifacts.forEach(({artifact, item}, i) => {
      const group = item ? uid('evidence') : undefined;
      const cols = artifacts.length === 1 ? 1 : 2, rows = Math.ceil(artifacts.length / cols);
      const areaX = cards.length ? 660 : 96, areaW = cards.length ? 684 : 1248;
      const w = (areaW - (cols - 1) * 28) / cols, h = 248 / rows;
      const x = areaX + i % cols * (w + 28), y = 440 + Math.floor(i / cols) * h;
      slide.elements.push(element('image', {src: artifact.src!, name: artifact.alt || item?.title || 'Project evidence', x, y, w, h: Math.max(50, h - (item ? 46 : 0)), fit: artifact.fit || 'contain', group, sourceId: `portfolio:${sourceId}:证据:${i}`}));
      if (item) text([item.label, item.title, item.body].filter(Boolean).join(' · '), 'Evidence caption', {x, y: y + h - 42, w, h: 40, fontSize: 18, fill: muted, group});
    });
    if (primary?.caption) text(primary.caption, 'Source note', {x: 96, y: 704, w: 1120, h: 48, fontSize: 16, fill: muted});
    text(String(index + 1).padStart(2, '0'), 'Page number', {x: 1280, y: 746, w: 64, h: 28, fontSize: 16, fill: muted, align: 'right'});

    slide.notes = [legacy.note, legacy.narration?.script,
      ...items.map(item => [item.label, item.title, item.body, item.artifact?.caption, item.artifact?.src].filter(Boolean).join('\n')),
      ...meta.map((entry: any) => `${entry.label ?? ''}: ${entry.value ?? ''}`),
      ...choices.map(choice => `${choice.chosen ? 'Chosen: ' : ''}${choice.label ?? ''}: ${choice.text ?? ''}`),
      primary?.caption, legacy.sourceRefs ? `Source references: ${JSON.stringify(legacy.sourceRefs)}` : '',
    ].filter(Boolean).join('\n\n');
    slide.source = {provider: 'Structured slides', fidelity: 'converted', label: sourceId, warnings: ['Imported from structured slide content. Text, images, and speaker notes are preserved. Interactive scenes show their current state; original player fidelity has not been verified.']};
    return slide;
  });
  const deck = newDeck(raw.title || 'Portfolio Deck', slides);
  deck.provenance = {provider: 'Structured slides', importedAt: new Date().toISOString()};
  return deck;
}
