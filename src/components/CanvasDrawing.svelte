<script lang="ts">
  import {onMount} from 'svelte';
  import {drawingElement, drawingMarkup, type DrawingSettings, type DrawingPoint} from '../core/drawing';
  import {prepareDrawingStroke, drawingStrokeHit, type DrawingStroke} from '../core/drawing-eraser';
  import type {SlideElement} from '../core/model';
  let {width, height, revision, slideId, settings, elements = [], oncomplete, onerase, onerasepreview}: {
    width: number; height: number; revision: number; slideId: string; settings: DrawingSettings;
    elements?: SlideElement[];
    oncomplete: (element: SlideElement, revision: number, slideId: string) => void;
    onerase?: (ids: string[], revision: number, slideId: string) => void;
    onerasepreview?: (ids: string[]) => void;
  } = $props();
  let surface: HTMLDivElement;
  let points = $state.raw<DrawingPoint[]>([]);
  let stroke: {id: number; revision: number; slideId: string; settings: DrawingSettings; targets: DrawingStroke[]; erased: Set<string>; radius: number} | null = null;
  let frame = 0, pending: DrawingPoint[] = [];
  let strokeSettings = $state<DrawingSettings | null>(null);
  let cursor = $state<DrawingPoint | null>(null);
  let eraserRadius = $state(8);
  const markup = $derived((strokeSettings ?? settings).mode === 'erase' ? '' : drawingMarkup(points, strokeSettings ?? settings));
  function erase(from: DrawingPoint, to: DrawingPoint) {
    if (!stroke || stroke.settings.mode !== 'erase') return;
    let changed = false;
    for (const target of stroke.targets) if (!stroke.erased.has(target.id) && drawingStrokeHit(target, from, to, stroke.radius)) {stroke.erased.add(target.id); changed = true;}
    if (changed) onerasepreview?.([...stroke.erased]);
  }
  function point(event: PointerEvent): DrawingPoint {
    const bounds = surface.getBoundingClientRect();
    return {x: Math.max(0, Math.min(width, (event.clientX - bounds.left) * width / bounds.width)), y: Math.max(0, Math.min(height, (event.clientY - bounds.top) * height / bounds.height)), pressure: event.pointerType === 'pen' ? event.pressure || .1 : .7};
  }
  function flush() {cancelAnimationFrame(frame); frame = 0; points = [...pending];}
  export function cancel() {
    const id = stroke?.id; stroke = null; strokeSettings = null; pending = []; points = []; cancelAnimationFrame(frame); frame = 0;
    onerasepreview?.([]);
    if (id !== undefined && surface?.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  function start(event: PointerEvent) {
    if (event.button !== 0 || stroke || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation();
    eraserRadius = 8 * width / surface.getBoundingClientRect().width;
    stroke = {id: event.pointerId, revision, slideId, settings: {...settings}, targets: settings.mode === 'erase' ? elements.map(prepareDrawingStroke).filter((target): target is DrawingStroke => Boolean(target)) : [], erased: new Set(), radius: eraserRadius};
    strokeSettings = {...settings};
    pending = [point(event)]; cursor = pending[0]; erase(pending[0], pending[0]); flush(); surface.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (settings.mode === 'erase') {cursor = point(event); eraserRadius = 8 * width / surface.getBoundingClientRect().width;}
    if (!stroke || stroke.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    for (const sample of event.getCoalescedEvents?.().length ? event.getCoalescedEvents() : [event]) {
      const next = point(sample), previous = pending.at(-1)!;
      if (pending.length < 12000 && Math.hypot(next.x - previous.x, next.y - previous.y) >= .5) {erase(previous, next); pending.push(next);}
    }
    if (!frame) frame = requestAnimationFrame(flush);
  }
  function finish(event: PointerEvent) {
    if (!stroke || stroke.id !== event.pointerId) return;
    move(event);
    const current = stroke, completed = pending;
    cancel();
    if (current.revision === revision && current.slideId === slideId) {
      if (current.settings.mode === 'erase') {if (current.erased.size) onerase?.([...current.erased], current.revision, current.slideId);}
      else oncomplete(drawingElement(completed, current.settings, {width, height}), current.revision, current.slideId);
    }
  }
  $effect(() => {revision; slideId; width; height; cancel();});
  $effect(() => {settings.mode; cancel(); cursor = null;});
  onMount(() => {
    window.addEventListener('blur', cancel);
    const visibility = () => {if (document.hidden) cancel();};
    document.addEventListener('visibilitychange', visibility);
    return () => {cancel(); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibility);};
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="drawing-surface" class:erasing={settings.mode === 'erase'} bind:this={surface} onpointerdown={start} onpointermove={move} onpointerleave={() => {if (!stroke) cursor = null;}} onpointerup={finish} onpointercancel={cancel} onlostpointercapture={event => {if (stroke?.id === event.pointerId) cancel();}}>
  <svg viewBox="0 0 {width} {height}" aria-hidden="true">{@html markup}{#if settings.mode === 'erase' && cursor}<circle class="eraser-cursor" cx={cursor.x} cy={cursor.y} r={eraserRadius}/>{/if}</svg>
</div>

<style>
  .drawing-surface {position: absolute; inset: 0; z-index: 60; cursor: crosshair; touch-action: none; user-select: none;}
  svg {display: block; width: 100%; height: 100%; pointer-events: none;}
  .erasing {cursor: none;}
  .eraser-cursor {fill: var(--surface-overlay); fill-opacity: .5; stroke: var(--text-primary); stroke-width: 1; vector-effect: non-scaling-stroke;}
</style>
