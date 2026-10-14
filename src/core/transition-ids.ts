export const TRANSITION_IDS = ['none','fade','slide','push','zoom','wipe','lift','cover','parallax','diagonal-slide','zoom-through','pullback','soft-focus','orbit','iris','diamond','diagonal','split','blinds','mosaic','pixels','ribbon','flip','cube','stack','hinge','smart'] as const;
export type TransitionEffect = typeof TRANSITION_IDS[number];
