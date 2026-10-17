import { intersectRect, positionSelectionToolbar, unionRects, type ScreenRect } from './selection-toolbar-position';
import './selection-toolbar.css';
import {canvasOverlayBounds} from './canvas-overlay-layout';

export interface SelectionToolbarOptions { ids: string[]; editingId: string; revision?: number; scale: number; draft?: boolean; docked?: boolean }

export function selectionToolbar(node: HTMLElement, initial: SelectionToolbarOptions) {
  const stage = node.closest<HTMLElement>('.canvas-stage');
  if (!stage) return;
  let options = initial, frame = 0;
  let lastTextRect: ScreenRect | null = null;
  let textId = initial.editingId;
  const hide = () => {
    if(node.contains(document.activeElement))stage!.focus({preventScroll:true});
    node.style.visibility = 'hidden';
  };

  function layout() {
    frame = 0;
    const render = stage!.querySelector<HTMLElement>('.slide-render.editable');
    if (!render || render.classList.contains('gesturing')) { hide(); return; }
    let boundary = canvasOverlayBounds(stage!);
    if (!boundary) { hide(); return; }
    const surface = stage!.parentElement!;
    const header = surface.querySelector<HTMLElement>('.canvas-overlay-top');
    if (header?.offsetHeight) boundary.top = Math.max(boundary.top, header.getBoundingClientRect().bottom + 8);
    if (options.docked) {
      const clearance = parseFloat(getComputedStyle(stage!).getPropertyValue('--canvas-group-clearance')) || 66;
      boundary.top = Math.max(boundary.top, stage!.getBoundingClientRect().top + clearance);
    }
    const status = surface.querySelector<HTMLElement>('.canvas-overlay-bottom');
    if (status?.offsetHeight) boundary.bottom = Math.min(boundary.bottom, status.getBoundingClientRect().top - 8);
    if (boundary.right - boundary.left < 120 || boundary.bottom - boundary.top < 40) { hide(); return; }
    const elements = Array.from(render.querySelectorAll<HTMLElement>('[data-element-id]')).filter(el => options.ids.includes(el.dataset.elementId!));
    const draft = options.draft ? render.querySelector<HTMLElement>('.insertion-text-draft') : null;
    let anchor = draft?.getBoundingClientRect() ?? unionRects(elements.map(el => el.getBoundingClientRect()));
    const currentTextId = options.draft ? 'insertion-text-draft' : options.editingId;
    if (textId !== currentTextId) { textId = currentTextId; lastTextRect = null; }
    if (options.editingId || options.draft) {
      const text = draft ?? elements.find(el => el.dataset.elementId === options.editingId)?.querySelector<HTMLElement>('[contenteditable="true"]');
      const selection = window.getSelection();
      if (text && selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (text.contains(range.startContainer) && text.contains(range.endContainer)) {
          if(range.collapsed){lastTextRect=null;anchor=unionRects([text.getBoundingClientRect(),...(anchor?[anchor]:[])]);}
          else {const rects=Array.from(range.getClientRects()).filter(r=>r.height>0);lastTextRect=unionRects(rects)??lastTextRect;anchor=lastTextRect??anchor;}
        }
      }
    }
    if (!anchor) { hide(); return; }
    const rotationTargets=!options.editingId&&!options.draft?Array.from(stage!.querySelectorAll<HTMLElement>('.rotation-handle')).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height):[];
    if(rotationTargets.length)anchor=unionRects([anchor,...rotationTargets])!;
    const maxWidth = `${Math.floor(boundary.right - boundary.left - 16)}px`;
    if (node.style.maxWidth !== maxWidth) node.style.maxWidth = maxWidth;
    const rect = node.getBoundingClientRect();
    // Short workspaces reserve a strip above the artwork, independent of the
    // selected object's position. Enlarging the tools also enlarges that strip.
    const space = options.docked ? `${Math.ceil(boundary.top - stage!.getBoundingClientRect().top + rect.height + 48)}px` : '';
    if (stage!.style.getPropertyValue('--canvas-toolbar-space') !== space) {
      if (space) stage!.style.setProperty('--canvas-toolbar-space', space);
      else stage!.style.removeProperty('--canvas-toolbar-space');
    }
    const position = options.docked
      ? intersectRect(anchor, boundary) && rect.height + 16 <= boundary.bottom - boundary.top
        ? {x: boundary.left + (boundary.right - boundary.left - rect.width) / 2, y: boundary.top + 8, placement: 'dock'}
        : null
      : positionSelectionToolbar(anchor, rect, boundary, !rotationTargets.length&&matchMedia('(pointer:coarse)').matches&&!options.editingId&&!options.draft?40:10);
    if (!position) { hide(); return; }
    node.style.left = `${Math.round(position.x)}px`;
    node.style.top = `${Math.round(position.y)}px`;
    node.dataset.placement = position.placement;
    node.dataset.anchor = options.editingId || options.draft ? 'text' : 'object';
    node.style.visibility = 'visible';
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout); }
  hide();
  const resize = new ResizeObserver(schedule);
  resize.observe(stage); resize.observe(node);
  for (const region of stage.parentElement!.querySelectorAll('.canvas-overlay,.canvas-overlay-top,.canvas-overlay-bottom')) resize.observe(region);
  const canvas = stage.querySelector<HTMLElement>('.stage-canvas');
  if (canvas) resize.observe(canvas);
  const mutations = new MutationObserver(records => {
    if (records.some(record => !node.contains(record.target))) schedule();
  });
  mutations.observe(stage.parentElement!, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'contenteditable']});
  const workspace = stage.closest('.workspace');
  if (workspace) mutations.observe(workspace, {attributes: true, attributeFilter: ['class', 'style']});
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  schedule();
  return {
    update(next: SelectionToolbarOptions) { options = next; schedule(); },
    destroy() {
      stage!.style.removeProperty('--canvas-toolbar-space');
      cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect();
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    },
  };
}
