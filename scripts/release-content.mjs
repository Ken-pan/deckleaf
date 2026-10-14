// Token-shaped strings trigger review without printing their contents.
/** @param {string} text */
export function containsCredential(text) {
  return /(?:sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|figd_[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{30,}|AIza[A-Za-z0-9_-]{30,}|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text);
}
