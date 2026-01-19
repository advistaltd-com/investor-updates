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
    
    // Dummy data for testing - organized by domain
    // Note: Empty arrays are not allowed - domains must have at least one email
    const dummyData = {
      "example.com": ["investor1@example.com", "investor2@example.com"],
      "test.com": ["partner@test.com"],
    };
    
    console.log("Starting seed for admin email:", adminEmail);
    
    // 1. Add admin email to its domain's emails array
    const adminDomain = adminEmail.split("@")[1];
    let approvedEmailWasNew = false;
    if (adminDomain) {
      const domainRef = adminDb.collection("approved_domains").doc(adminDomain);
      const domainDoc = await domainRef.get();

      if (domainDoc.exists) {
        const domainData = domainDoc.data();
        const emails = domainData?.emails || [];
        if (!emails.includes(adminEmail)) {
          await domainRef.update({
            emails: [...emails, adminEmail],
          });
          approvedEmailWasNew = true;
        }
      } else {
        await domainRef.set({
          domain: adminDomain,
          emails: [adminEmail],
        });
        approvedEmailWasNew = true;
      }
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

    // Add dummy domains with emails
    let addedDomains = 0;
    let addedEmails = 0;
    for (const [domain, emails] of Object.entries(dummyData)) {
      const domainRef = adminDb.collection("approved_domains").doc(domain);
      const domainDoc = await domainRef.get();

      if (domainDoc.exists) {
        // Update existing domain with new emails
        const existingData = domainDoc.data();
        const existingEmails = existingData?.emails || [];
        const newEmails = emails.filter((e) => !existingEmails.includes(e));
        
        if (newEmails.length > 0) {
          await domainRef.update({
            emails: [...existingEmails, ...newEmails],
          });
          addedEmails += newEmails.length;
        }
      } else {
        // Create new domain document
        await domainRef.set({
          domain,
          emails,
        });
        addedDomains++;
        addedEmails += emails.length;
      }
    }
    
    console.log("Seed completed successfully");
    return jsonResponse(200, {
      success: true,
      message: "Database seeded successfully (idempotent - duplicates skipped)",
      data: {
        adminEmail,
        adminDocId: adminRef.id,
        adminEmailAdded: approvedEmailWasNew,
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
