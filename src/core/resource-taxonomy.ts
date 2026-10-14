import type { ResourceAttribution } from './model';

export type IllustrationType = 'spot' | 'scene' | 'accent';
export type IllustrationView = 'illustrations' | 'graphics';
type BrowseResource = Pick<ResourceAttribution, 'id' | 'kind'> & {category?: string; illustrationType?: IllustrationType};

export const ILLUSTRATION_TYPES = [
  {id: '', label: 'All', title: 'All illustrations'},
  {id: 'spot', label: 'Spots', title: 'Small standalone illustrations'},
  {id: 'scene', label: 'Scenes', title: 'Scene illustrations'},
  {id: 'accent', label: 'Accents', title: 'Decorative illustrations'},
] as const;

// Curated from the bundled originals: settings and environments belong to scenes;
// standalone people, objects and product states remain spot illustrations.
const sceneIllustrations = new Set([
  '102-gym-cycle', '111-coding', '113-workstation', '119-working',
  'day11-blackboard', 'day12-bed', 'day13-it-girl', 'day30-cafe', 'day31-sweet-home',
  'day47-chemistry-lab', 'day48-medical-lab', 'day52-auntum', 'day53-farm', 'day54-building',
  'day55-living-room-interior', 'day56-tv-room', 'day57-reading-room', 'day58-bedroom',
  'day59-kitchen', 'day60-bathroom', 'day65-city-road', 'day66-travel',
  'day93-programing', 'day94-ui-ux', 'day96-camping', 'day98-junk-boat', 'day99-pirate-boat',
]);

export function illustrationTypeOf(item: BrowseResource): IllustrationType | undefined {
  if (item.kind !== 'illustration') return;
  if (item.illustrationType) return item.illustrationType;
  if (item.id.startsWith('deck-graphics:')) return item.category === 'accent' || item.id.startsWith('deck-graphics:accent-') ? 'accent' : undefined;
  // Older published catalogs did not carry the source manifest type.
  if (item.id.startsWith('blue-black:')) return /^blue-black:(?:spot-|person-)/.test(item.id) ? 'spot' : 'scene';
  if (item.id.startsWith('illlustrations:') && sceneIllustrations.has(item.id.slice('illlustrations:'.length))) return 'scene';
  return 'spot';
}

// No view keeps legacy catalog queries intact; the editor explicitly selects a view.
export function matchesIllustrationView(item: BrowseResource, view = '', type = ''): boolean {
  const illustrationType = illustrationTypeOf(item);
  if (view === 'graphics') return item.id.startsWith('deck-graphics:') && !illustrationType;
  if (view === 'illustrations' && !illustrationType) return false;
  return !type || illustrationType === type;
}
