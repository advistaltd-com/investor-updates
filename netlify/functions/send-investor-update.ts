import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import { Resend } from "resend";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
};

const stripMarkdown = (content: string) => {
  return content
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const signUnsubscribeToken = (email: string, secret: string) => {
  const signature = createHmac("sha256", secret).update(email).digest("base64url");
  return Buffer.from(`${email}:${signature}`).toString("base64url");
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
    if (!decoded.admin) {
      return jsonResponse(403, { error: "Admin privileges required." });
    }

    const payload = JSON.parse(event.body || "{}");
    const title = String(payload.title || "").trim();
    const contentMd = String(payload.content_md || "").trim();

    if (!title || contentMd.length < 20) {
      return jsonResponse(400, { error: "Title and content required." });
    }

    const updateRef = adminDb.collection("timeline_updates").doc();
    await updateRef.set({
      title,
      content_md: contentMd,
      created_at: FieldValue.serverTimestamp(),
      email_sent: false,
    });

    const usersSnap = await adminDb
      .collection("users")
      .where("approved", "==", true)
      .where("subscribed", "==", true)
      .get();

    const recipients = usersSnap.docs
      .map((doc) => doc.data().email)
      .filter((email) => typeof email === "string");

    if (recipients.length === 0) {
      await updateRef.update({ email_sent: true });
      return jsonResponse(200, { ok: true, recipients: 0 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;
    const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;

    if (!resendKey || !resendFrom || !unsubscribeSecret) {
      return jsonResponse(500, { error: "Email configuration missing." });
    }

    const resend = new Resend(resendKey);
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:8888";
    const updateUrl = `${siteUrl}/investor?update=${updateRef.id}`;
    const excerpt = stripMarkdown(contentMd).slice(0, 240);
    const subject = `GoAiMEX Update: ${title}`;

    const chunks = chunkArray(recipients, 50);
    for (const chunk of chunks) {
      const personalized = chunk.map((recipient) => {
        const unsubscribeToken = signUnsubscribeToken(recipient, unsubscribeSecret);
        const unsubscribeUrl = `${siteUrl}/.netlify/functions/unsubscribe?token=${unsubscribeToken}`;

        return resend.emails.send({
          from: resendFrom,
          to: recipient,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; color: #0f172a;">
              <h2 style="margin-bottom: 8px;">${title}</h2>
              <p style="margin-top: 0; color: #475569;">${excerpt}</p>
              <p>
                <a href="${updateUrl}" style="color: #2563eb; text-decoration: none;">View full update</a>
              </p>
              <p style="font-size: 12px; color: #94a3b8;">
                <a href="${unsubscribeUrl}" style="color: #94a3b8;">Unsubscribe</a>
              </p>
            </div>
          `,
          text: `${title}\n\n${excerpt}\n\nView full update: ${updateUrl}\nUnsubscribe: ${unsubscribeUrl}`,
        });
      });

      await Promise.all(personalized);
    }

    await updateRef.update({ email_sent: true });

    return jsonResponse(200, { ok: true, recipients: recipients.length });
  } catch (err) {
    return jsonResponse(500, { error: "Failed to send update." });
  }
};
