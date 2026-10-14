import type {Deck} from './model';
import {deckDesignSystem} from './deck-design-system';
export {isThemedIllustration} from './resource-purpose';
export function defaultIllustrationColor(deck: Pick<Deck,'designSystem'> & Partial<Pick<Deck,'illustrationAccent'|'slides'>>) {
  return (deck.illustrationAccent || deckDesignSystem(deck).colors.accent).toLowerCase();
}
