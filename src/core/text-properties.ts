import type { SlideElement, TextRun } from './model';

export const textProperties = ['fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'fill', 'letterSpacing', 'align', 'lineHeight'] as const;
export type TextProperty = typeof textProperties[number];

// Read the styles that the renderer inherits, including imported runs/paragraphs.
export function textPropertyValues<K extends TextProperty>(elements: SlideElement[], key: K): SlideElement[K][] {
  const values: SlideElement[K][] = [];
  const text = elements.filter(e => e.type === 'text'), editable = text.filter(e => !e.locked);
  for (const e of editable.length ? editable : text) {
    const paragraphs = e.paragraphs?.length ? e.paragraphs : [{runs: e.runs?.length ? e.runs : [{text: e.text}], align: e.align}];
    for (const p of paragraphs) {
      const runs = p.runs.filter(r => r.text.length);
      if (key === 'align') values.push((p.align ?? e.align) as SlideElement[K]);
      else if (key === 'lineHeight') {
        const size = runs.length ? Math.max(...runs.map(r => r.fontSize ?? e.fontSize)) : e.fontSize;
        const paragraph = p as {lineSpacing?: number; lineHeight?: number};
        values.push((paragraph.lineSpacing ? paragraph.lineSpacing / size : paragraph.lineHeight ?? e.lineHeight) as SlideElement[K]);
      } else for (const r of runs.length ? runs : [{} as TextRun]) {
        const value = key === 'fill' ? r.color ?? e.fill : key === 'fontWeight' ? r.fontWeight ?? (r.bold === undefined ? e.fontWeight : r.bold ? 700 : 400) : r[key as keyof TextRun] ?? e[key];
        values.push(value as SlideElement[K]);
      }
    }
  }
  return values;
}
export function textPropertyState<K extends TextProperty>(elements: SlideElement[], key: K) {
  const values = textPropertyValues(elements, key), value = values[0];
  return {value, mixed: values.some(v => v !== value)};
}
export function textToggleState(elements: SlideElement[], key: 'bold' | 'italic' | 'underline'): boolean | 'mixed' {
  const values = key === 'bold' ? textPropertyValues(elements, 'fontWeight').map(v => v >= 600) : textPropertyValues(elements, key);
  return values.some(v => v !== values[0]) ? 'mixed' : Boolean(values[0]);
}
