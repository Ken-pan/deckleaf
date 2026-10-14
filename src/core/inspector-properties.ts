import type {Slide, SlideElement} from './model';
import type {Operation} from './operations';
import {DEFAULT_SHADOW, type ElementShadow} from './shape-schema';
import {hasShapeCorners, isShape, shapePreset, SHAPE_LABELS, type ShapeInsertTool} from './shapes';

/** Only expose a control when it can edit every unlocked object in its scope. */
export function inspectorCapabilities(items: SlideElement[]) {
  const every = (test: (item: SlideElement) => boolean) => items.length > 0 && items.every(test);
  const sameType = every(item => item.type === items[0].type);
  return {
    sameType,
    shapes: every(isShape),
    shapeType: every(item => isShape(item) && item.type !== 'line'),
    fill: every(item => isShape(item) && item.type !== 'line') || sameType && !['image', 'prototype', 'line'].includes(items[0].type),
    stroke: every(isShape) || sameType && items[0].type === 'table',
    radius: every(item => hasShapeCorners(item) || item.type === 'image'),
  };
}

export function dataLabelSize(item: SlideElement) {
  return item.type === 'chart' ? Math.max(18, Math.min(28, item.fontSize)) : item.fontSize;
}

export function shapeTypeOperations(slide: Slide, ids: string[], tool: ShapeInsertTool): Operation[] {
  if (tool === 'line') return [];
  const selected = new Set(ids);
  const preset=shapePreset(tool);
  return slide.elements.filter(item => selected.has(item.id) && !item.locked && isShape(item) && item.type !== 'line' && (item.type!==preset.type||JSON.stringify(item.shape)!==JSON.stringify(preset.shape)||!hasShapeCorners(preset)&&item.radius!==0)).map(item => {
    const patch = shapePreset(tool);
    if (!hasShapeCorners(patch)) patch.radius = 0;
    if (Object.values(SHAPE_LABELS).includes(item.name)) patch.name = SHAPE_LABELS[tool];
    return {op: 'update_element', slideId: slide.id, elementId: item.id, patch};
  });
}

export function shadowPropertyMixed(items: SlideElement[], key: keyof ElementShadow) {
  const first = (items[0]?.shadow ?? DEFAULT_SHADOW)[key];
  return items.some(item => (item.shadow ?? DEFAULT_SHADOW)[key] !== first);
}

/** A batch field edit changes that field, preserving each object's other values. */
export function shadowPatchOperations(slide: Slide, ids: string[], patch: Partial<ElementShadow>): Operation[] {
  const selected = new Set(ids);
  return slide.elements.filter(item => selected.has(item.id) && !item.locked && isShape(item)).map(item => ({
    op: 'update_element', slideId: slide.id, elementId: item.id,
    patch: {shadow: {...(item.shadow ?? DEFAULT_SHADOW), ...patch}},
  }));
}
