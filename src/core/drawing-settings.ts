export const DRAWING_BRUSHES = [
  {id: 'pen', label: 'Pen', size: 4},
  {id: 'brush', label: 'Brush', size: 12},
  {id: 'highlighter', label: 'Highlighter', size: 24},
] as const;
export type DrawingBrush = typeof DRAWING_BRUSHES[number]['id'];
export type DrawingSettings = {brush: DrawingBrush; color: string; size: number; mode?: 'draw' | 'erase'};
export type DrawingPoint = {x: number; y: number; pressure: number};
export const DEFAULT_DRAWING: DrawingSettings = {brush: 'pen', color: '#252b29', size: 4};
export const DRAWING_COLORS = [
  {name: 'Ink', value: '#252b29'}, {name: 'White', value: '#ffffff'},
  {name: 'Red', value: '#e5484d'}, {name: 'Orange', value: '#ed8a23'},
  {name: 'Yellow', value: '#f5ce46'}, {name: 'Green', value: '#30a46c'},
  {name: 'Blue', value: '#3e63dd'}, {name: 'Purple', value: '#8e4ec6'},
] as const;
