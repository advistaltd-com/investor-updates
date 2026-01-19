/**
 * Seed script to initialize the database with admin user
 * 
 * Usage:
 *   npx tsx scripts/seed-db.ts
 * 
 * Or with custom email:
 *   ADMIN_EMAIL=your@email.com npx tsx scripts/seed-db.ts
 *
 * Make sure your .env file has Firebase credentials set up.
 * ADMIN_EMAIL is required (no hardcoded default).
 *
 * This script is idempotent - running it multiple times won't create duplicates.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Simple env file loader
const loadEnv = () => {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^["']|["']$/g, "");
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
};

loadEnv();

const getServiceAccount = () => {
  // Option 1: Use individual environment variables
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");

    if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
      throw new Error(
        "FIREBASE_PRIVATE_KEY appears to be invalid. It should include 'BEGIN PRIVATE KEY' and 'END PRIVATE KEY' markers.",
      );
    }

    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || "",
    };
  }

  // Option 2: Try to load from service account JSON file
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "service-account.json";
  try {
    const serviceAccountJson = readFileSync(serviceAccountPath, "utf-8");
    return JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error(
      `Failed to load Firebase credentials. Set env vars or provide ${serviceAccountPath} file.`,
    );
  }
};

const seedDatabase = async () => {
  // Initialize Firebase Admin
  if (!getApps().length) {
    try {
      const serviceAccount = getServiceAccount();
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } catch (error) {
      console.error("Failed to initialize Firebase Admin:", error);
      process.exit(1);
    }
  }

  const db = getFirestore();
  const adminEmailRaw = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmailRaw) {
    console.error("Missing ADMIN_EMAIL. Set it in your .env or inline before running the script.");
    process.exit(1);
  }
  const adminEmail = adminEmailRaw.toLowerCase();

  console.log(`\n🌱 Seeding database with admin email: ${adminEmail}\n`);

  // Dummy data for testing - organized by domain
  // Note: Empty arrays are not allowed - domains must have at least one email
  const dummyData = {
    "example.com": ["investor1@example.com", "investor2@example.com"],
    "test.com": ["partner@test.com"],
  };

  try {
    // 1. Add admin email to its domain's emails array
    console.log("📧 Adding admin email to approved domains...");
    const adminDomain = adminEmail.split("@")[1];
    if (adminDomain) {
      const domainRef = db.collection("approved_domains").doc(adminDomain);
      const domainDoc = await domainRef.get();

      if (domainDoc.exists) {
        const domainData = domainDoc.data();
        const emails = domainData?.emails || [];
        if (!emails.includes(adminEmail)) {
          await domainRef.update({
            emails: [...emails, adminEmail],
          });
          console.log(`   ✅ Added admin email to existing domain ${adminDomain}`);
        } else {
          console.log(`   ⚠️  Admin email already exists in domain ${adminDomain} (skipping)`);
        }
      } else {
        await domainRef.set({
          domain: adminDomain,
          emails: [adminEmail],
        });
        console.log(`   ✅ Created domain ${adminDomain} with admin email`);
      }
    }

    // Add dummy domains with emails
    console.log("🌐 Adding dummy domains with emails...");
    for (const [domain, emails] of Object.entries(dummyData)) {
      const domainRef = db.collection("approved_domains").doc(domain);
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
          console.log(`   ✅ Updated domain ${domain} with ${newEmails.length} new emails`);
        } else {
          console.log(`   ⚠️  Domain ${domain} already exists with all emails (skipping)`);
        }
      } else {
        // Create new domain document
        await domainRef.set({
          domain,
          emails,
        });
        console.log(`   ✅ Added domain ${domain} with ${emails.length} emails`);
      }
    }

    // 2. Add to admins collection (document ID = email, so duplicates are prevented)
    console.log("👤 Checking admins collection...");
    const adminRef = db.collection("admins").doc(adminEmail);
    const adminDoc = await adminRef.get();
    
    if (adminDoc.exists) {
      console.log(`   ⚠️  Admin document already exists for ${adminEmail} (skipping)`);
    } else {
      await adminRef.set({ email: adminEmail });
      console.log(`   ✅ Added admin (ID: ${adminRef.id})`);
    }


    console.log(`\n✨ Database seeded successfully! (idempotent - safe to run multiple times)\n`);
    console.log(`Next steps:`);
    console.log(`1. Have ${adminEmail} sign in at your site`);
    console.log(`2. They will be able to access /admin after signing in\n`);
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
