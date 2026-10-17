import type { SlideElement } from './model';
import type { ShapeVariant } from './shape-schema';

export const SHAPE_TOOLS = ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'pentagon', 'hexagon', 'star', 'arrow', 'chevron', 'line'] as const;
export type ShapeInsertTool = typeof SHAPE_TOOLS[number];
export const SHAPE_LABELS: Record<ShapeInsertTool, string> = {
  rect: 'Rectangle', roundrect: 'Rounded rectangle', ellipse: 'Ellipse', diamond: 'Diamond',
  triangle: 'Triangle', pentagon: 'Pentagon', hexagon: 'Hexagon', star: 'Star', arrow: 'Arrow', chevron: 'Chevron', line: 'Line',
};
export function isShapeTool(value: string | null | undefined): value is ShapeInsertTool {
  return SHAPE_TOOLS.includes(value as ShapeInsertTool);
}
export function isShape(e?: Pick<SlideElement, 'type'>): boolean { return Boolean(e && ['rect', 'ellipse', 'diamond', 'line'].includes(e.type)); }
export function hasShapeCorners(e: Pick<SlideElement, 'type'>): boolean { return e.type === 'rect' || e.type === 'diamond'; }
export function shapeKind(e: Pick<SlideElement, 'type' | 'shape'>): ShapeInsertTool {
  return e.type === 'rect' ? e.shape ?? 'rect' : e.type as ShapeInsertTool;
}
export function shapePreset(tool: ShapeInsertTool): Partial<SlideElement> & {type: SlideElement['type']} {
  if (['rect', 'ellipse', 'diamond', 'line'].includes(tool)) return {type: tool as SlideElement['type'], shape: undefined};
  return {type: 'rect', shape: tool === 'roundrect' ? undefined : tool as ShapeVariant, ...(tool === 'roundrect' ? {radius: 24} : {})};
}


export function canEditText(e?: Pick<SlideElement, 'type' | 'designPattern' | 'sourceRegion'>): boolean {
  return Boolean(e && !e.designPattern && (e.type === 'text' || ['rect', 'ellipse', 'diamond', 'line'].includes(e.type) && !e.sourceRegion));
}
