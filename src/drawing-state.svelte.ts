import {DEFAULT_DRAWING, type DrawingSettings} from './core/drawing-settings';

// Tool preferences outlive individual strokes and canvas mounts.
export const drawingState = $state<{settings: DrawingSettings}>({settings: {...DEFAULT_DRAWING}});
