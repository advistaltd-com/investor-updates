import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

const isApproved = async (email: string) => {
  const domain = email.split("@")[1] || "";
  const emailSnap = await adminDb
    .collection("approved_emails")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!emailSnap.empty) return true;

  const domainSnap = await adminDb
    .collection("approved_domains")
    .where("domain", "==", domain)
    .limit(1)
    .get();

  return !domainSnap.empty;
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
