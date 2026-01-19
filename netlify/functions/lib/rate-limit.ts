import { adminDb } from "./firebase";

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

  try {
    const rateLimitRef = adminDb.collection("rate_limits").doc(userId);

    // Use transaction to make rate limiting atomic (prevents race conditions)
    return await adminDb.runTransaction(async (transaction) => {
      const rateLimitDoc = await transaction.get(rateLimitRef);

      if (!rateLimitDoc.exists) {
        // First request - create entry
        transaction.set(rateLimitRef, {
          count: 1,
          windowStart: now,
          lastRequest: now,
        });
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetAt: now + windowMs,
        };
      }

      const data = rateLimitDoc.data();
      if (!data) {
        transaction.set(rateLimitRef, {
          count: 1,
          windowStart: now,
          lastRequest: now,
        });
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetAt: now + windowMs,
        };
      }

      const windowStartTime = data.windowStart || now;
      const count = data.count || 0;

      // Check if we're still in the same window
      if (now - windowStartTime < windowMs) {
        // Still in window - check count
        if (count >= maxRequests) {
          const resetAt = windowStartTime + windowMs;
          return {
            allowed: false,
            remaining: 0,
            resetAt,
          };
        }

        const newCount = count + 1;
        transaction.update(rateLimitRef, {
          count: newCount,
          lastRequest: now,
        });

        return {
          allowed: true,
          remaining: maxRequests - newCount,
          resetAt: windowStartTime + windowMs,
        };
      }

      // New window - reset
      transaction.set(rateLimitRef, {
        count: 1,
        windowStart: now,
        lastRequest: now,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    });
  } catch (error) {
    // Fail open - allow request if rate limiting fails
    console.error("Rate limit check error:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowMs,
    };
  } finally {
    // Cleanup old rate limit entries (older than 24 hours)
    // This runs occasionally to prevent unbounded growth
    if (Math.random() < 0.01) { // 1% chance to run cleanup
      cleanupOldRateLimits(24 * 60 * 60 * 1000).catch((err) => {
        console.error("Rate limit cleanup error:", err);
      });
    }
  }
}

/**
 * Cleanup rate limit entries older than specified age
 */
/**
 * Cleanup rate limit entries older than specified age
 * Note: This is called periodically (1% of requests) to prevent unbounded growth
 */
async function cleanupOldRateLimits(maxAgeMs: number): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  
  try {
    // Get all rate limit entries and filter by timestamp
    // Note: We use lastRequest field (numeric timestamp) for easier comparison
    const allEntries = await adminDb
      .collection("rate_limits")
      .limit(500)
      .get();

    const batch = adminDb.batch();
    let deletedCount = 0;
    
    allEntries.docs.forEach((doc) => {
      const data = doc.data();
      const lastRequest = data.lastRequest || 0;
      
      // Delete entries older than cutoff
      if (lastRequest < cutoff) {
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
