import type { TextRange } from './core/text-range-format';

const block = (node: Node) => node instanceof Element && /^(DIV|P|LI)$/.test(node.tagName);
function children(node: Node): Node[] {
  const nodes = Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE || child.nodeType === Node.ELEMENT_NODE);
  const blocks = nodes.some(block);
  // Svelte's control-flow comments and indentation are not editable characters.
  return nodes.filter(child => !(blocks && child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()));
}
// Match the editable paragraph structure, including the newline between divs.
function content(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof Element && node.tagName === 'BR') return '\n';
  let text = '', previous: Node | null = null;
  for (const child of children(node)) {
    if (previous && (block(previous) || block(child))) text += '\n';
    text += content(child); previous = child;
  }
  return text;
}
function offsetAt(root: HTMLElement, node: Node, offset: number) {
  const prefix = document.createRange(); prefix.selectNodeContents(root); prefix.setEnd(node, offset);
  return content(prefix.cloneContents()).length;
}
export function readTextRange(root: HTMLElement): TextRange | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return {start: offsetAt(root, range.startContainer, range.startOffset), end: offsetAt(root, range.endContainer, range.endOffset)};
}
export function restoreTextRange(root: HTMLElement, range: TextRange) {
  const texts: {node: Text; start: number; end: number}[] = [];
  let offset = 0;
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) { const end = offset + (node.textContent?.length ?? 0); texts.push({node: node as Text, start: offset, end}); offset = end; return; }
    if (node instanceof Element && node.tagName === 'BR') { offset++; return; }
    let previous: Node | null = null;
    for (const child of children(node)) { if (previous && (block(previous) || block(child))) offset++; visit(child); previous = child; }
  }
  visit(root);
  function point(value: number) { const entry = texts.find(t => value <= t.end) ?? texts.at(-1); return entry ? {node: entry.node, offset: Math.max(0, Math.min(entry.end - entry.start, value - entry.start))} : {node: root, offset: 0}; }
  const a = point(range.start), b = point(range.end), native = document.createRange();
  native.setStart(a.node, a.offset); native.setEnd(b.node, b.offset);
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(native);
}
