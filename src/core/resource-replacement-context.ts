import type {ResourceAttribution} from './model';

// The selected object owns replacement context; remembered browsing is for insertion.
export function resourceReplacementContext(resource?: ResourceAttribution) {
  const kind=resource?.kind ?? 'photo';
  const prefix=resource?.id.split(':')[0];
  return {
    kind,
    collection: kind==='illustration' && ['blue-black','doodles','deck-graphics','illlustrations'].includes(prefix ?? '') ? prefix! : 'all',
    iconSet: kind==='icon' && prefix==='iconify' ? resource?.id.split(':')[1] || 'lucide' : 'lucide',
    photoSource: kind==='photo' && (prefix==='unsplash'||prefix==='pexels') ? prefix : '',
  };
}
