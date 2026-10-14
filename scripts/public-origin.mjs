const official = 'https://decksprig.kens-toolbox.com';

/** @param {string | undefined} value */
export function publicOrigin(value = process.env.DECKSPRIG_PUBLIC_ORIGIN ?? process.env.DECKLEAF_PUBLIC_ORIGIN) {
  if (value === undefined || value === '') return official;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('DECKSPRIG_PUBLIC_ORIGIN must be a bare HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}
