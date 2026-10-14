import type { Deck } from './model';
import { adjacentVisibleSlide } from './slide-visibility';

/** Preserve each slide's builds while skipping hidden pages in either direction. */
export function navigatePresentationCue(slides: Deck['slides'], index: number, step: number, direction: number, counts: number[]) {
  if (direction > 0 && step < counts[index]) return {index, step: step + 1};
  if (direction < 0 && step > 0) return {index, step: step - 1};
  const next = adjacentVisibleSlide(slides, index, direction);
  return next === null ? {index, step} : {index: next, step: direction > 0 ? 0 : counts[next]};
}

/** Presentation state is ephemeral: it never enters a document transaction. */
export interface SpeakerSession {
  deck: Deck;
  original: boolean;
  index: number;
  step: number;
  steps: number;
  elapsed: string;
  timerRunning: boolean;
  blackout: boolean;
}

export function formatPresentationTime(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function presentationSlideNumber(value: string, count: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number >= 1 && number <= count ? number - 1 : null;
}

/** A monotonic clock avoids interval drift and excludes time spent paused. */
export function createPresentationClock(now: () => number) {
  let accumulated = 0, started: number | null = now();
  return {
    get running() { return started !== null; },
    elapsed() { return accumulated + (started === null ? 0 : Math.max(0, now() - started)); },
    toggle() {
      if (started === null) started = now();
      else { accumulated += Math.max(0, now() - started); started = null; }
    },
    reset() { accumulated = 0; if (started !== null) started = now(); },
  };
}
