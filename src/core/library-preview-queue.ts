// Per-library scheduling: invisible cards can leave the queue before any I/O.
// A running request keeps its slot until it settles, even when transport ignores
// abort (IndexedDB); this bounds work during rapid scrolling in both editions.
export class LibraryPreviewQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 4) {}
  run<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abortError = () => new DOMException('Preview request cancelled.', 'AbortError');
      const cancel = () => {
        const index = this.waiting.indexOf(start);
        if (index >= 0) { this.waiting.splice(index, 1); signal.removeEventListener('abort', cancel); }
        reject(abortError());
      };
      const start = () => {
        if (signal.aborted) { signal.removeEventListener('abort', cancel); reject(abortError()); return; }
        this.active++;
        Promise.resolve().then(load).then(
          value => signal.aborted ? reject(abortError()) : resolve(value), reject,
        ).finally(() => {
          signal.removeEventListener('abort', cancel);
          this.active--;
          this.waiting.shift()?.();
        });
      };
      if (signal.aborted) { reject(abortError()); return; }
      signal.addEventListener('abort', cancel, {once: true});
      if (this.active < this.limit) start(); else this.waiting.push(start);
    });
  }
}
