import type { Handler } from "@netlify/functions";
import { adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

export const handler: Handler = async (event) => {
  console.log("Seed function called:", {
    method: event.httpMethod,
    hasBody: !!event.body,
    headers: Object.keys(event.headers),
  });

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    console.log("Method not allowed:", event.httpMethod);
    return jsonResponse(405, { error: "Method not allowed. Use POST." });
  }

  // Check for secret key (case-insensitive header lookup)
  const secretKey = 
    event.headers["x-seed-secret"] || 
    event.headers["X-Seed-Secret"] ||
    event.queryStringParameters?.secret;
  const expectedSecret = process.env.SEED_SECRET || "change-me-in-production";
  
  console.log("Secret check:", {
    hasSecretKey: !!secretKey,
    hasExpectedSecret: !!expectedSecret,
    secretMatches: secretKey === expectedSecret,
  });
  
  if (secretKey !== expectedSecret) {
    console.log("Unauthorized - secret mismatch");
    return jsonResponse(401, { 
      error: "Unauthorized. Provide valid x-seed-secret header or secret query param.",
      hint: "Set SEED_SECRET env var and include it in the request."
    });
  }

  try {
    const adminEmailRaw = process.env.SEED_ADMIN_EMAIL?.trim();
    if (!adminEmailRaw) {
      console.error("Missing SEED_ADMIN_EMAIL environment variable");
      return jsonResponse(400, { 
        error: "Missing SEED_ADMIN_EMAIL env var.",
        hint: "Set SEED_ADMIN_EMAIL in Netlify environment variables."
      });
    }
    const adminEmail = adminEmailRaw.toLowerCase();
    
    // Dummy data for testing
    const dummyEmails = [
      "investor1@example.com",
      "investor2@example.com",
      "partner@test.com",
    ];

    const dummyDomains = [
      "example.com",
      "test.com",
      "demo.org",
    ];
    
    console.log("Starting seed for admin email:", adminEmail);
    
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
      console.log("Created admin document for:", adminEmail);
    } else {
      console.log("Admin document already exists for:", adminEmail);
    }

    // Add dummy emails
    let addedEmails = 0;
    for (const email of dummyEmails) {
      const existing = await adminDb
        .collection("approved_emails")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (existing.empty) {
        await adminDb.collection("approved_emails").add({ email });
        addedEmails++;
      }
    }

    // Add dummy domains
    let addedDomains = 0;
    for (const domain of dummyDomains) {
      const existing = await adminDb
        .collection("approved_domains")
        .where("domain", "==", domain)
        .limit(1)
        .get();

      if (existing.empty) {
        await adminDb.collection("approved_domains").add({ domain });
        addedDomains++;
      }
    }
    
    console.log("Seed completed successfully");
    return jsonResponse(200, {
      success: true,
      message: "Database seeded successfully (idempotent - duplicates skipped)",
      data: {
        adminEmail,
        approvedEmailId,
        adminDocId: adminRef.id,
        approvedEmailExisted: !approvedEmailWasNew,
        adminExisted: !adminWasNew,
        dummyEmailsAdded: addedEmails,
        dummyDomainsAdded: addedDomains,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return jsonResponse(500, {
      error: "Failed to seed database",
      details: errorMessage,
    });
  }
};
