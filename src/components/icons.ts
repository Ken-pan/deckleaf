import { AppWindow, ChartColumn, Circle, Diamond, Image, Layers, Minus, Sticker, SwatchBook, Palette, Shapes, Square, SquareArrowRightEnter, SquareArrowRightExit, Table2, Type } from '@lucide/svelte';
import type { SlideElement } from '../core/model';
import type { ResourceKind } from '../core/resources';
import {SquareRoundCorner, Triangle, Pentagon, Hexagon, Star, ArrowBigRight, ChevronRight} from '@lucide/svelte';
import {isShape, shapeKind, type ShapeInsertTool} from '../core/shapes';

// Reuse these meanings in insertion menus, the resource library and layers.
export const elementIcons = {
  text: Type, image: Image, rect: Square, ellipse: Circle, diamond: Diamond,
  line: Minus, prototype: AppWindow, table: Table2, chart: ChartColumn,
} satisfies Record<SlideElement['type'], typeof Type>;

export const shapeToolIcons = {rect:Square, roundrect:SquareRoundCorner, ellipse:Circle, diamond:Diamond, triangle:Triangle, pentagon:Pentagon, hexagon:Hexagon, star:Star, arrow:ArrowBigRight, chevron:ChevronRight, line:Minus} satisfies Record<ShapeInsertTool, typeof Type>;
export const elementIcon = (e: SlideElement) => isShape(e) ? shapeToolIcons[shapeKind(e)] : elementIcons[e.type];

export const resourceIcons = {
  photo: Image, icon: Shapes, illustration: Sticker, graphics: SwatchBook, used: Layers,
} satisfies Record<ResourceKind | 'graphics' | 'used', typeof Type>;
