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
  if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
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

    const payload = JSON.parse(event.body || "{}");
    const type = payload.type; // "email" or "domain"
    const value = payload.value?.trim().toLowerCase();

    if (!type || !value) {
      return jsonResponse(400, { error: "Type and value required." });
    }

    if (type === "email") {
      if (!value.includes("@")) {
        return jsonResponse(400, { error: "Invalid email format." });
      }

      if (event.httpMethod === "DELETE") {
        // Delete email
        const emailSnap = await adminDb
          .collection("approved_emails")
          .where("email", "==", value)
          .limit(1)
          .get();

        if (emailSnap.empty) {
          return jsonResponse(404, { error: "Email not found." });
        }

        await emailSnap.docs[0].ref.delete();
        return jsonResponse(200, { success: true, message: "Email removed." });
      } else {
        // Add email
        const existing = await adminDb
          .collection("approved_emails")
          .where("email", "==", value)
          .limit(1)
          .get();

        if (!existing.empty) {
          return jsonResponse(409, { error: "Email already exists." });
        }

        await adminDb.collection("approved_emails").add({ email: value });
        return jsonResponse(200, { success: true, message: "Email added." });
      }
    } else if (type === "domain") {
      if (!value.includes(".") || value.startsWith("@")) {
        return jsonResponse(400, { error: "Invalid domain format (e.g., 'example.com')." });
      }

      if (event.httpMethod === "DELETE") {
        // Delete domain
        const domainSnap = await adminDb
          .collection("approved_domains")
          .where("domain", "==", value)
          .limit(1)
          .get();

        if (domainSnap.empty) {
          return jsonResponse(404, { error: "Domain not found." });
        }

        await domainSnap.docs[0].ref.delete();
        return jsonResponse(200, { success: true, message: "Domain removed." });
      } else {
        // Add domain
        const existing = await adminDb
          .collection("approved_domains")
          .where("domain", "==", value)
          .limit(1)
          .get();

        if (!existing.empty) {
          return jsonResponse(409, { error: "Domain already exists." });
        }

        await adminDb.collection("approved_domains").add({ domain: value });
        return jsonResponse(200, { success: true, message: "Domain added." });
      }
    } else {
      return jsonResponse(400, { error: "Type must be 'email' or 'domain'." });
    }
  } catch (err) {
    console.error("Error in manage-allowlist:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(500, {
      error: "Failed to manage allowlist.",
      details: errorMessage,
    });
  }
};
