import fallbacks from './font-fallbacks.json';
/** Rendering uses a compact fallback index; catalogue and licenses load with font tools. */
export function fontStack(family:string,category:string|undefined=(fallbacks as Record<string,string>)[family]) {
  return `"${family.replace(/[";{}<>\\]/g,'')}", ${category==='serif'?'"Noto Serif SC", "Songti SC", serif':category==='mono'?'monospace':'"Noto Sans SC", "PingFang SC", sans-serif'}`;
}
