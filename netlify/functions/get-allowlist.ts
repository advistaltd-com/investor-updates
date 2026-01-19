import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
};

const isAdmin = async (email: string) => {
  const adminDoc = await adminDb.collection("admins").doc(email.toLowerCase()).get();
  return adminDoc.exists;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(event.headers.authorization);
    if (!token) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return jsonResponse(400, { error: "Missing email." });
    }

    const userIsAdmin = await isAdmin(email);
    if (!userIsAdmin) {
      return jsonResponse(403, { error: "Admin privileges required." });
    }

    // Get all domains from approved_domains (single source of truth)
    const domainsSnap = await adminDb.collection("approved_domains").get();
    
    // Get all users to merge metadata (subscribed, last_login, etc.)
    const usersSnap = await adminDb.collection("users").get();
    const emailUserMap = new Map<string, { subscribed: boolean; last_login?: any; created_at?: any }>();
    
    usersSnap.docs.forEach((doc) => {
      const userData = doc.data();
      const userEmail = userData.email?.toLowerCase();
      if (userEmail && typeof userEmail === "string") {
        emailUserMap.set(userEmail, {
          subscribed: userData.subscribed ?? true,
          last_login: userData.last_login,
          created_at: userData.created_at,
        });
      }
    });

    // Merge domain emails with user metadata
    const domains = domainsSnap.docs.map((doc) => {
      const data = doc.data();
      const emails = data.emails || [];
      
      // Enrich each email with user metadata if available
      const enrichedEmails = emails.map((email: string) => {
        const userData = emailUserMap.get(email.toLowerCase());
        return {
          email,
          subscribed: userData?.subscribed ?? true,
          last_login: userData?.last_login || null,
          created_at: userData?.created_at || null,
        };
      });

      return {
        id: doc.id, // domain name
        domain: data.domain || doc.id,
        emails: enrichedEmails,
      };
    });

    return jsonResponse(200, {
      success: true,
      domains,
    });
  } catch (err) {
    console.error("Error in get-allowlist:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(500, {
      error: "Failed to fetch allowlist.",
      details: errorMessage,
    });
  }
};
