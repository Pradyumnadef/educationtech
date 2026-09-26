// Share concurrent work, never retain a completed or failed result.
export class InFlightReads {
  private pending = new Map<string, Promise<unknown>>();
  async read<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.pending.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = Promise.resolve().then(load);
      this.pending.set(key, pending);
    }
    try {
      // Callers must not be able to mutate another request's snapshot.
      return structuredClone(await pending);
    } finally {
      if (this.pending.get(key) === pending) this.pending.delete(key);
    }
  }
  clear() { this.pending.clear(); }
}
