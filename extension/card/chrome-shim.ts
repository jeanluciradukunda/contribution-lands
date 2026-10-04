type Area = 'local' | 'sync';
type Listener = (changes: Record<string, { newValue: unknown }>, area: Area) => void;

export interface ShimOptions {
  themeUrl: (path: string) => string;
  initial?: Partial<Record<Area, Record<string, unknown>>>;
  persist?: boolean;
}

/** Just enough of `chrome.*` for the content script to run outside the extension. */
export function installChromeShim({ themeUrl, initial = {}, persist = false }: ShimOptions) {
  const load = (name: Area) => (persist ? JSON.parse(localStorage.getItem(`cl-${name}`) ?? 'null') : null) ?? initial[name] ?? {};
  const store: Record<Area, Record<string, unknown>> = { local: load('local'), sync: load('sync') };
  const listeners: Listener[] = [];

  const area = (name: Area) => ({
    async get(keys: string | string[]) {
      const list = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(list.filter((k) => k in store[name]).map((k) => [k, store[name][k]]));
    },
    async set(values: Record<string, unknown>) {
      Object.assign(store[name], values);
      if (persist) localStorage.setItem(`cl-${name}`, JSON.stringify(store[name]));
      const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]));
      for (const fn of listeners) fn(changes, name);
    },
  });

  const areas = { local: area('local'), sync: area('sync') };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { getURL: themeUrl },
    storage: { ...areas, onChanged: { addListener: (fn: Listener) => listeners.push(fn) } },
  };
  return { store, areas };
}
