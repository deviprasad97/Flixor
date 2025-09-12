export type AppSettings = {
  plexBaseUrl?: string;
  plexToken?: string;
  plexTvToken?: string;
  tmdbBearer?: string;
  traktClientId?: string;
};

const KEY = 'app.settings.v1';

export function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch: Partial<AppSettings>) {
  const curr = loadSettings();
  const next = { ...curr, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
