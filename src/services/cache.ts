type Entry<T> = { t: number; v: T };

const CACHE_NS = 'app.cache.v1';
const mem = new Map<string, Entry<any>>();

function now() { return Date.now(); }

function getStore(): Storage | null {
  try { return sessionStorage; } catch { return null; }
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const full = CACHE_NS + ':' + key;
  const store = getStore();
  try {
    const raw = store?.getItem(full);
    if (raw) {
      const e: Entry<T> = JSON.parse(raw);
      if (now() - e.t < ttlMs) return e.v;
    }
  } catch {}
  if (mem.has(full)) {
    const e = mem.get(full)! as Entry<T>;
    if (now() - e.t < ttlMs) return e.v;
  }
  const v = await loader();
  const e: Entry<T> = { t: now(), v };
  mem.set(full, e);
  try { store?.setItem(full, JSON.stringify(e)); } catch { /* ignore quota */ }
  return v;
}

export function forget(prefix: string) {
  const p = CACHE_NS + ':' + prefix;
  const store = getStore();
  if (store) {
    Object.keys(store).forEach(k => { if (k.startsWith(p)) store.removeItem(k); });
  }
  Array.from(mem.keys()).forEach(k => { if (k.startsWith(p)) mem.delete(k); });
}
