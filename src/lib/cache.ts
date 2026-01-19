/**
 * Minimal in-memory cache for fetch requests
 * Provides TTL-based expiration and automatic cleanup
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class FetchCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: number | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  set<T>(key: string, data: T, ttlMs: number) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Invalidate cache entries matching a pattern
  invalidate(pattern: string | RegExp) {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
const cache = new FetchCache();

/**
 * Cached fetch wrapper
 * Only caches GET requests and safe POST requests (like check-allowlist)
 */
export async function cachedFetch(
  url: string,
  options: RequestInit = {},
  ttlMs: number = 2 * 60 * 1000, // Default 2 minutes
): Promise<Response> {
  const method = options.method || "GET";
  const isCacheable = method === "GET" || (method === "POST" && url.includes("check-allowlist"));

  if (!isCacheable) {
    return fetch(url, options);
  }

  // Create cache key from URL and body
  const bodyKey = options.body ? JSON.stringify(options.body) : "";
  const cacheKey = `${method}:${url}:${bodyKey}`;

  // Check cache
  const cached = cache.get<{ status: number; statusText: string; body: string; headers: Record<string, string> }>(cacheKey);
  if (cached) {
    // Return cached response
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers),
    });
  }

  // Make request
  const response = await fetch(url, options);
  
  // Only cache successful responses
  if (response.ok) {
    // Clone response to cache it (Response can only be read once)
    const clonedResponse = response.clone();
    const body = await clonedResponse.text();
    const headers: Record<string, string> = {};
    clonedResponse.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    cache.set(cacheKey, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      body,
      headers,
    }, ttlMs);
  }

  return response;
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern: string | RegExp) {
  cache.invalidate(pattern);
}

/**
 * Clear all cache entries
 */
export function clearCache() {
  cache.clear();
}
