import api from './api';

/**
 * Tiny stale-while-revalidate cache for public GET requests (listings, property details).
 * - peek(url): the last response we have, if any, so a page can render instantly.
 * - getCached(url): returns the cached response if it's fresh, otherwise fetches (deduplicating
 *   concurrent requests for the same URL).
 * - prefetch(url): warm the cache in the background (e.g. when hovering a listing card).
 * Entries live for the browser session only.
 */
const store = new Map();     // url -> { data, at }
const inflight = new Map();  // url -> Promise
const FRESH_MS = 30_000;

export const peek = (url) => store.get(url)?.data;

export function getCached(url, { maxAge = FRESH_MS } = {}) {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < maxAge) return Promise.resolve(hit.data);
  if (inflight.has(url)) return inflight.get(url);

  const request = api.get(url)
    .then((res) => {
      store.set(url, { data: res.data, at: Date.now() });
      return res.data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
}

export function prefetch(url) {
  getCached(url).catch(() => { /* prefetch is best-effort */ });
}

/** Drop cached entries whose URL starts with a prefix (e.g. after creating a listing). */
export function invalidate(prefix) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
