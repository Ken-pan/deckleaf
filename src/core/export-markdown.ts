import type {Deck} from './model';
import {slideLabel} from './slide-label';
import {resourceCredits} from './resource-credits';

// Markdown is prepared only when requested, from the captured export document.
export function markdownDocument(d:Deck){return `# ${d.title}\n\n${d.slides.map((s, i) => `## ${slideLabel(i)}\n\n${s.elements.filter(e => e.type === 'text').map(e => e.text).join('\n\n')}\n\n### Notes\n\n${s.notes}`).join('\n\n---\n\n')}${resourceCredits(d) ? `\n\n## Sources and licenses\n\n${resourceCredits(d)}` : ''}`;}
