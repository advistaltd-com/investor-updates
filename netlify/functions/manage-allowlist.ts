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

      const emailDomain = value.split("@")[1];
      if (!emailDomain) {
        return jsonResponse(400, { error: "Invalid email format." });
      }

      if (event.httpMethod === "DELETE") {
        // Remove email from domain's emails array
        const domainRef = adminDb.collection("approved_domains").doc(emailDomain);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          return jsonResponse(404, { error: "Domain not found." });
        }

        const domainData = domainDoc.data();
        const emails = (domainData?.emails || []).filter((e: string) => e !== value);

        await domainRef.update({ emails });
        return jsonResponse(200, { success: true, message: "Email removed." });
      } else {
        // Add email to domain's emails array (or create domain if it doesn't exist)
        const domainRef = adminDb.collection("approved_domains").doc(emailDomain);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          // Create new domain document with this email
          await domainRef.set({
            domain: emailDomain,
            emails: [value],
          });
        } else {
          // Add email to existing domain's emails array
          const domainData = domainDoc.data();
          const emails = domainData?.emails || [];

          if (emails.includes(value)) {
            return jsonResponse(409, { error: "Email already exists." });
          }

          await domainRef.update({
            emails: [...emails, value],
          });
        }

        return jsonResponse(200, { success: true, message: "Email added." });
      }
    } else if (type === "domain") {
      if (!value.includes(".") || value.startsWith("@")) {
        return jsonResponse(400, { error: "Invalid domain format (e.g., 'example.com')." });
      }

      if (event.httpMethod === "DELETE") {
        // Delete domain document
        const domainRef = adminDb.collection("approved_domains").doc(value);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          return jsonResponse(404, { error: "Domain not found." });
        }

        await domainRef.delete();
        return jsonResponse(200, { success: true, message: "Domain removed." });
      } else {
        // Create domain document (or update if exists)
        const domainRef = adminDb.collection("approved_domains").doc(value);
        const domainDoc = await domainRef.get();

        if (domainDoc.exists) {
          return jsonResponse(409, { error: "Domain already exists." });
        }

        await domainRef.set({
          domain: value,
          emails: [],
        });

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
