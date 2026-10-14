export function slideRailScroll(node: HTMLElement, reducedUI: () => boolean) {
  let frame = 0;
  const reveal = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const selected = node.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected || node.closest('[inert]') || !node.clientWidth || !node.clientHeight) return;
      const list = node.getBoundingClientRect(), item = selected.getBoundingClientRect();
      const horizontal = getComputedStyle(node).flexDirection === 'row';
      const start = horizontal ? item.left - list.left : item.top - list.top;
      const end = horizontal ? item.right - list.right : item.bottom - list.bottom;
      const oversized = (horizontal ? item.width > list.width - 16 : item.height > list.height - 16);
      const delta = oversized ? start - 8 : start < 8 ? start - 8 : end > -8 ? end + 8 : 0;
      if (!delta) return;
      node.scrollTo({ [horizontal ? 'left' : 'top']: (horizontal ? node.scrollLeft : node.scrollTop) + delta, behavior: reducedUI() ? 'instant' : 'smooth' });
    });
  };
  const resize = new ResizeObserver(reveal), pane = node.closest('[aria-label="Slides"]');
  const observer = new MutationObserver(reveal);
  resize.observe(node);
  if (pane) observer.observe(pane, { attributes: true, attributeFilter: ['inert'] });
  reveal();
  return { update: reveal, destroy() { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();  } };
}

