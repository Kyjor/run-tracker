import type { FeedItem } from '../types';

const CACHE_KEY = 'runny_feed_cache';
const STALE_MS = 2 * 60 * 1000; // 2 min — show cached while revalidating

interface CacheEntry {
  items: FeedItem[];
  ts: number;
}

export function getCachedFeed(): FeedItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    return entry.items;
  } catch {
    return null;
  }
}

export function isFeedStale(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const entry: CacheEntry = JSON.parse(raw);
    return Date.now() - entry.ts > STALE_MS;
  } catch {
    return true;
  }
}

export function setCachedFeed(items: FeedItem[]): void {
  try {
    // Strip route_points before caching to keep storage small
    const slim = items.map(({ route_points: _, ...rest }) => rest);
    const entry: CacheEntry = { items: slim as FeedItem[], ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function clearFeedCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
