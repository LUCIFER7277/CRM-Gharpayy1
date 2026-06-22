// Bounded retry with jittered backoff. Used inside the command bus to swallow
// transient WriteConflict / E11000 races on the per-aggregate `seq` index.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number; jitterMs?: number; isRetriable: (e: unknown) => boolean } = {
    isRetriable: () => false,
  },
): Promise<T> {
  const tries = opts.tries ?? 3;
  const base = opts.baseMs ?? 10;
  const jitter = opts.jitterMs ?? 30;
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!opts.isRetriable(e) || i === tries - 1) throw e;
      const wait = base + Math.floor(Math.random() * jitter);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export function isMongoConflict(e: unknown): boolean {
  const err = e as { code?: number | string; codeName?: string; message?: string; errmsg?: string };
  if (!err) return false;
  const codeNum = typeof err.code === "string" ? Number(err.code) : err.code;
  if (codeNum === 11000) return true; // duplicate key (unique seq race)
  if (err.code === 112) return true;   // WriteConflict (transactions)
  if (err.codeName === "WriteConflict") return true;
  if (err.codeName === "DuplicateKey") return true;
  const msg = `${err.message ?? ""} ${err.errmsg ?? ""}`;
  if (/\bE11000\b|duplicate key/i.test(msg)) return true;
  return false;
}
