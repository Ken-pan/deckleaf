// Token-shaped strings trigger review without printing their contents.
import {createHash} from 'node:crypto';

/** Only byte-identical published image/font inputs may be omitted from text scanning.
 * @param {string} text
 * @param {ReadonlySet<string>} approvedAssetHashes
 */
export function publicationReviewText(text, approvedAssetHashes) {
  return text.replace(/data:(?:image\/(?:png|jpeg|webp)|font\/(?:ttf|otf|woff2?));base64,([A-Za-z0-9+/]+={0,2})/g, (url, payload) => {
    const hash = createHash('sha256').update(Buffer.from(payload, 'base64')).digest('hex');
    return approvedAssetHashes.has(hash) ? '[embedded published asset]' : url;
  });
}

/** @param {string} text */
export function containsCredential(text) {
  return /(?:sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|figd_[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{30,}|AIza[A-Za-z0-9_-]{30,}|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text);
}
