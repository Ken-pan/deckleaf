const numbers = new Intl.NumberFormat('en-US');

export function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${numbers.format(value)} ${value === 1 ? singular : plural}`;
}

/** Present document validation failures without exposing the schema's JSON. */
export function workspaceOpenError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  let issues: unknown = error && typeof error === 'object' ? (error as {issues?: unknown}).issues : undefined;
  if (!issues && message.trim().startsWith('[')) {
    try { issues = JSON.parse(message); } catch { /* Keep ordinary error messages intact. */ }
  }
  if (Array.isArray(issues) && issues.length && issues.every(issue =>
    issue && typeof issue === 'object' && typeof issue.code === 'string' &&
    typeof issue.message === 'string' && Array.isArray(issue.path))) {
    return 'This document contains invalid or unsupported content.';
  }
  return message || 'Try again or open another document.';
}
