import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";
import { isGenericEmailProvider } from "./lib/allowlist";

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
};

const isApproved = async (email: string) => {
  const domain = email.split("@")[1] || "";
  
  // Check if domain document exists (domain as document ID)
  const domainDoc = await adminDb.collection("approved_domains").doc(domain).get();
  
  if (!domainDoc.exists) {
    return false;
  }

  const domainData = domainDoc.data();
  if (!domainData) {
    return false;
  }

  // For generic email providers (gmail, yahoo, etc.), require explicit email approval
  if (isGenericEmailProvider(domain)) {
    const emails = domainData.emails || [];
    // Only approve if email is explicitly in the emails array
    return emails.includes(email);
  }

  // For non-generic domains, if domain exists, approve any email from that domain
  // This allows companies to approve their entire domain without listing every email
  return true;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
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

    const approved = await isApproved(email);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    // Determine subscribed status:
    // - If user exists, preserve their current subscribed status (they may have unsubscribed)
    // - If user doesn't exist or subscribed is undefined, default to true
    // Note: When admin adds email via manage-allowlist, it sets subscribed: true for existing users
    const existingData = snapshot.exists ? snapshot.data() : null;
    const subscribed = existingData?.subscribed ?? true;

    const payload = {
      email,
      approved,
      subscribed,
      last_login: FieldValue.serverTimestamp(),
    };

    if (snapshot.exists) {
      await userRef.update(payload);
    } else {
      await userRef.set({
        ...payload,
        created_at: FieldValue.serverTimestamp(),
      });
    }

    // If user is approved, ensure their email is in approved_domains collection
    // This keeps approved_domains as the single source of truth
    if (approved) {
      const domain = email.split("@")[1] || "";
      if (domain) {
        const domainRef = adminDb.collection("approved_domains").doc(domain);
        const domainDoc = await domainRef.get();

        if (domainDoc.exists) {
          const domainData = domainDoc.data();
          const emails = domainData?.emails || [];
          
          // Only add email if it's not already in the list
          // For generic providers, email must be explicitly listed
          // For non-generic domains, we still add it for visibility in admin panel
          if (!emails.includes(email)) {
            await domainRef.update({
              emails: [...emails, email],
            });
          }
        } else {
          // Domain doesn't exist, but user is approved (non-generic domain case)
          // Create domain document with this email for admin visibility
          await domainRef.set({
            domain,
            emails: [email],
          });
        }
      }
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error("Error in create-user:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(500, { 
      error: "Unable to sync user.",
      details: errorMessage,
    });
  }
};
