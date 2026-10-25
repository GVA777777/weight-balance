import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** CacheStorage persists across worker versions, like it does in a browser. */
export async function workerHarness({
  sourceDir = fileURLToPath(new URL('../../dist/', import.meta.url)),
  baseUrl = 'https://balance.test/',
  failInstall = false,
  cacheStorage = new Map([['balance-flight-v0', new Map()], ['unrelated-cache', new Map()]]),
  savedStorage = new Map(),
} = {}) {
  const source = await readFile(path.join(sourceDir, 'sw.js'), 'utf8');
  const version = source.match(/const CACHE = '([^']+)'/)[1];
  const workerUrl = new URL('sw.js', baseUrl);
  const scope = new URL('./', workerUrl);
  const handlers = {}, deleted = [];
  let online = true;
  const resolveUrl = key => new URL(typeof key === 'string' ? key : key.url, workerUrl).href;
  const caches = {
    async open(name) {
      if (!cacheStorage.has(name)) cacheStorage.set(name, new Map());
      const entries = cacheStorage.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) {
            if (failInstall && url.endsWith('app.js')) throw new Error('Missing asset');
            const resolved = resolveUrl(url);
            if (!resolved.startsWith(scope.href)) throw new Error(`Asset escaped app scope: ${resolved}`);
            const file = decodeURIComponent(resolved.slice(scope.href.length)) || 'index.html';
            const content = await readFile(path.join(sourceDir, file));
            entries.set(resolved, new Response(content));
          }
        },
        async match(key) { return entries.get(resolveUrl(key))?.clone(); },
      };
    },
    async keys() { return [...cacheStorage.keys()]; },
    async delete(key) { deleted.push(key); return cacheStorage.delete(key); },
  };
  const self = {
    location: workerUrl,
    registration: { scope: scope.href },
    addEventListener: (name, fn) => handlers[name] = fn,
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  vm.runInNewContext(source, {
    self, caches, URL,
    fetch: async () => { if (!online) throw new Error('Offline'); return new Response('network'); },
    localStorage: {
      getItem: key => savedStorage.get(key) ?? null,
      setItem: (key, value) => savedStorage.set(key, value),
      removeItem: key => savedStorage.delete(key),
      clear: () => savedStorage.clear(),
    },
  });
  return {
    version, handlers, deleted, cacheStorage, savedStorage,
    get entries() { return cacheStorage.get(version) ?? new Map(); },
    offline() { online = false; },
    async dispatch(type, request) {
      let promise;
      handlers[type]({ request, waitUntil: p => promise = p, respondWith: p => promise = p });
      return promise;
    },
  };
}
