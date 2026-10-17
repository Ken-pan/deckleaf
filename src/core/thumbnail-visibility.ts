// One viewport observer for the rail and document library. Leaving the viewport
// releases thumbnail canvas trees; the host retains its authored aspect ratio.
const subscribers = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | undefined;
export function observeThumbnail(host: Element, update: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') { update(true); return () => {}; }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) subscribers.get(entry.target)?.(entry.isIntersecting);
  }, {rootMargin: '200px'});
  subscribers.set(host, update);
  observer.observe(host);
  return () => {
    subscribers.delete(host);
    observer?.unobserve(host);
    if (!subscribers.size) { observer?.disconnect(); observer = undefined; }
  };
}
