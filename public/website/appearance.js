/* Apply the marketing appearance before CSS paints. Editor preferences stay separate. */
(() => {
  let theme;
  try { theme = localStorage.getItem('deck-studio-website-theme'); } catch {}
  document.documentElement.dataset.theme = theme === 'dark' || theme === 'light'
    ? theme
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();
