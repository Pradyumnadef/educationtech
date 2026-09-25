// Share only a pending request; never cache a user's session after it resolves.
// This avoids duplicate checks while allowing logout/revocation to take effect.
export function createSessionRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 15000,
) {
  let pending: Promise<T> | undefined;
  return () => {
    if (pending) return pending;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Your connection is taking too long. Please try again."));
        controller.abort();
      }, timeoutMs);
    });
    pending = Promise.race([Promise.resolve().then(() => load(controller.signal)), timeout])
      .finally(() => {
        clearTimeout(timer);
        pending = undefined;
      });
    return pending;
  };
}
