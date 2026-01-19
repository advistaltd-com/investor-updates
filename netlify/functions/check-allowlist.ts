import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

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

  // Check if email is in the domain's emails array
  const emails = domainData.emails || [];
  if (emails.includes(email)) {
    return true;
  }

  // If domain exists but email not in array, check if domain allows all emails
  // (for backward compatibility, if emails array is empty, allow all emails from that domain)
  return emails.length === 0;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const rawEmail = String(payload.email || "").trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes("@")) {
      return jsonResponse(400, { error: "Valid email required." });
    }

    const approved = await isApproved(rawEmail);
    let isExistingUser = false;

    try {
      await adminAuth.getUserByEmail(rawEmail);
      isExistingUser = true;
    } catch (err) {
      isExistingUser = false;
    }

    return jsonResponse(200, { approved, isExistingUser });
  } catch (err) {
    return jsonResponse(500, { error: "Failed to verify allowlist." });
  }
};
