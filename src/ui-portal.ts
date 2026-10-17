/** Editor chrome must inherit the application theme, outside authored slide styles. */
export function portalToBody(node:HTMLElement) {
  document.body.append(node);
  return {destroy(){node.remove();}};
}
