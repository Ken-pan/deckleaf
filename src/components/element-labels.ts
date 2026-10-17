import {isDrawingElement} from '../core/drawing-identity';
import type { SlideElement } from '../core/model';
import {isShape, shapeKind, SHAPE_LABELS} from '../core/shapes';

export const elementLabels = {
  text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', line: 'Line',
  image: 'Image', table: 'Table', chart: 'Chart', prototype: 'Prototype',
} satisfies Record<SlideElement['type'], string>;

export const elementLabel = (e: SlideElement) => isDrawingElement(e) ? 'Drawing' : isShape(e) ? SHAPE_LABELS[shapeKind(e)] : elementLabels[e.type];
