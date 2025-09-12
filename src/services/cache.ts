type Entry<T> = { t: number; v: T };

const CACHE_NS = 'app.cache.v1';

function now() { return Date.now(); }

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  try {
    const raw = localStorage.getItem(CACHE_NS + ':' + key);
    if (raw) {
      const e: Entry<T> = JSON.parse(raw);
      if (now() - e.t < ttlMs) return e.v;
    }
  } catch {}
  const v = await loader();
  try { localStorage.setItem(CACHE_NS + ':' + key, JSON.stringify({ t: now(), v } as Entry<T>)); } catch {}
  return v;
}

export function forget(keyPrefix: string) {
  const p = CACHE_NS + ':' + keyPrefix;
  Object.keys(localStorage).forEach(k => { if (k.startsWith(p)) localStorage.removeItem(k); });
}

