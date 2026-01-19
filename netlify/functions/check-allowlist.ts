import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";
import { isGenericEmailProvider } from "./lib/allowlist";

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
    console.error("Error in check-allowlist:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(500, { 
      error: "Failed to verify allowlist.",
      details: errorMessage,
    });
  }
};
