type Waiter = {resolve: () => void; reject: (error: unknown) => void};
type Job<T> = {value: T; waiters: Waiter[]};

// In-flight writes complete in order. Only waiting snapshots for the same
// document coalesce; every caller waits for the snapshot that supersedes it.
export class LatestWriteQueue<T> {
  private pending = new Map<string, Job<T>>();
  private running = false;
  private idleWaiters: (() => void)[] = [];
  constructor(private write: (value: T) => Promise<void>) {}

  enqueue(key: string, value: T): Promise<void> {
    const result = new Promise<void>((resolve, reject) => {
      const waiting = this.pending.get(key);
      if (waiting) { waiting.value = value; waiting.waiters.push({resolve, reject}); }
      else this.pending.set(key, {value, waiters: [{resolve, reject}]});
    });
    if (!this.running) { this.running = true; queueMicrotask(() => void this.drain()); }
    return result;
  }

  idle(): Promise<void> {
    return this.running ? new Promise(resolve => this.idleWaiters.push(resolve)) : Promise.resolve();
  }

  private async drain() {
    while (this.pending.size) {
      const [key, job] = this.pending.entries().next().value!;
      this.pending.delete(key);
      try { await this.write(job.value); for (const waiter of job.waiters) waiter.resolve(); }
      catch (error) { for (const waiter of job.waiters) waiter.reject(error); }
    }
    this.running = false;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }
}
