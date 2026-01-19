import { adminDb } from "./firebase";
import { FieldValue } from "firebase-admin/firestore";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Minimal rate limiter using Firestore
 * Tracks requests per user and enforces limits
 * Fails open on errors to maintain availability
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // Default: 10 requests per hour
): Promise<RateLimitResult> {
  const { maxRequests, windowMs } = config;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const rateLimitRef = adminDb.collection("rate_limits").doc(userId);
    const rateLimitDoc = await rateLimitRef.get();

    if (!rateLimitDoc.exists) {
      // First request - create entry
      await rateLimitRef.set({
        requests: [now],
        updatedAt: now,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    const data = rateLimitDoc.data();
    if (!data) {
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    const requests: number[] = (data.requests || []).filter((timestamp: number) => timestamp > windowStart);
    
    if (requests.length >= maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...requests);
      const resetAt = oldestRequest + windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request
    requests.push(now);

    // Cleanup old entries (keep only requests within the window)
    const cleanedRequests = requests.filter((timestamp: number) => timestamp > windowStart);

    // Update Firestore
    await rateLimitRef.update({
      requests: cleanedRequests,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Cleanup old rate limit entries (older than 24 hours)
    // This runs occasionally to prevent unbounded growth
    if (Math.random() < 0.01) { // 1% chance to run cleanup
      cleanupOldRateLimits(24 * 60 * 60 * 1000).catch((err) => {
        console.error("Rate limit cleanup error:", err);
      });
    }

    return {
      allowed: true,
      remaining: maxRequests - cleanedRequests.length,
      resetAt: Math.min(...cleanedRequests) + windowMs,
    };
  } catch (error) {
    // Fail open - allow request if rate limiting fails
    console.error("Rate limit check error:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowMs,
    };
  }
}

/**
 * Cleanup rate limit entries older than specified age
 */
async function cleanupOldRateLimits(maxAgeMs: number): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  
  try {
    // Get all rate limit entries and filter by timestamp
    // Note: Firestore doesn't support direct timestamp comparison on serverTimestamp fields,
    // so we fetch all and filter in memory (acceptable for cleanup operation)
    const allEntries = await adminDb
      .collection("rate_limits")
      .limit(500)
      .get();

    const batch = adminDb.batch();
    let deletedCount = 0;
    
    allEntries.docs.forEach((doc) => {
      const data = doc.data();
      const updatedAt = data.updatedAt?.toMillis?.() || data.updatedAt || 0;
      
      // Delete entries older than cutoff
      if (updatedAt < cutoff) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Rate limit cleanup error:", error);
    // Don't throw - cleanup failures shouldn't affect functionality
  }
}
