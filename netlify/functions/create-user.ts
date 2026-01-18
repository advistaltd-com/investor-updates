import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
};

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
    const token = getBearerToken(event.headers.authorization);
    if (!token) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return jsonResponse(400, { error: "Missing email." });
    }

    const approved = await isApproved(email);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const snapshot = await userRef.get();

    const payload = {
      email,
      approved,
      subscribed: snapshot.exists ? snapshot.data()?.subscribed ?? true : true,
      last_login: FieldValue.serverTimestamp(),
    };

    if (snapshot.exists) {
      await userRef.update(payload);
    } else {
      await userRef.set({
        ...payload,
        created_at: FieldValue.serverTimestamp(),
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { error: "Unable to sync user." });
  }
};
