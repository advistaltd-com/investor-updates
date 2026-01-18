import type { Handler } from "@netlify/functions";
import { adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Optional: Add a secret key check for security
  const secretKey = event.headers["x-seed-secret"] || event.queryStringParameters?.secret;
  const expectedSecret = process.env.SEED_SECRET || "change-me-in-production";
  
  if (secretKey !== expectedSecret) {
    return jsonResponse(401, { error: "Unauthorized. Provide valid x-seed-secret header or secret query param." });
  }

  try {
    const adminEmailRaw = process.env.SEED_ADMIN_EMAIL?.trim();
    if (!adminEmailRaw) {
      return jsonResponse(400, { error: "Missing SEED_ADMIN_EMAIL env var." });
    }
    const adminEmail = adminEmailRaw.toLowerCase();
    
    // 1. Add to approved_emails collection (check for duplicates first)
    const existingApprovedEmail = await adminDb
      .collection("approved_emails")
      .where("email", "==", adminEmail)
      .limit(1)
      .get();
    
    let approvedEmailId: string;
    let approvedEmailWasNew = false;
    if (!existingApprovedEmail.empty) {
      approvedEmailId = existingApprovedEmail.docs[0].id;
    } else {
      const approvedEmailRef = adminDb.collection("approved_emails").doc();
      await approvedEmailRef.set({ email: adminEmail });
      approvedEmailId = approvedEmailRef.id;
      approvedEmailWasNew = true;
    }
    
    // 2. Add to admins collection (document ID = email, so duplicates are prevented)
    const adminRef = adminDb.collection("admins").doc(adminEmail);
    const adminDoc = await adminRef.get();
    const adminWasNew = !adminDoc.exists;
    
    if (!adminDoc.exists) {
      await adminRef.set({ email: adminEmail });
    }
    
    return jsonResponse(200, {
      success: true,
      message: "Database seeded successfully (idempotent - duplicates skipped)",
      data: {
        adminEmail,
        approvedEmailId,
        adminDocId: adminRef.id,
        approvedEmailExisted: !approvedEmailWasNew,
        adminExisted: !adminWasNew,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return jsonResponse(500, {
      error: "Failed to seed database",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
