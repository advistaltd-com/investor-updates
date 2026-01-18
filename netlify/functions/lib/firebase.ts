import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const getServiceAccount = () => {
  // Option 1: Use individual environment variables (recommended)
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // Handle private key: replace escaped newlines with actual newlines
    // Handles both \n (escaped) and actual newlines in the env var
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");

    // Validate private key format
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

  // Option 2: Fallback to JSON string (for backward compatibility)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const json = raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf-8");
      return JSON.parse(json);
    } catch (error) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  throw new Error(
    "Missing Firebase credentials. Set either individual env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) or FIREBASE_SERVICE_ACCOUNT JSON.",
  );
};

if (!getApps().length) {
  try {
    const serviceAccount = getServiceAccount();
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    throw error;
  }
}

const adminAuth = getAuth();
const adminDb = getFirestore();

export { adminAuth, adminDb };
