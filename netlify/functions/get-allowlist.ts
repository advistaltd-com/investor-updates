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
  return adminDoc.exists();
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

    const [emailsSnap, domainsSnap] = await Promise.all([
      adminDb.collection("approved_emails").get(),
      adminDb.collection("approved_domains").get(),
    ]);

    const emails = emailsSnap.docs.map((doc) => ({
      id: doc.id,
      email: doc.data().email,
    }));

    const domains = domainsSnap.docs.map((doc) => ({
      id: doc.id,
      domain: doc.data().domain,
    }));

    return jsonResponse(200, {
      success: true,
      emails,
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
