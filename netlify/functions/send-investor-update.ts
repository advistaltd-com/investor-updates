import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import nodemailer from "nodemailer";
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

const isAdmin = async (email: string) => {
  const adminDoc = await adminDb.collection("admins").doc(email.toLowerCase()).get();
  return adminDoc.exists;
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

    const userIsAdmin = await isAdmin(email);
    if (!userIsAdmin) {
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

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;
    const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;
    const smtpPort = process.env.RESEND_SMTP_PORT || "587";

    if (!resendApiKey || !resendFrom || !unsubscribeSecret) {
      return jsonResponse(500, { error: "Email configuration missing." });
    }

    // Create SMTP transporter using Resend SMTP credentials
    const transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: parseInt(smtpPort, 10),
      secure: smtpPort === "465" || smtpPort === "2465", // true for 465, false for other ports
      auth: {
        user: "resend",
        pass: resendApiKey,
      },
    });

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:8888";
    const updateUrl = `${siteUrl}/investor?update=${updateRef.id}`;
    const excerpt = stripMarkdown(contentMd).slice(0, 240);
    const subject = `GoAiMEX Update: ${title}`;

    // Send emails in chunks to respect rate limits
    const chunks = chunkArray(recipients, 50);
    for (const chunk of chunks) {
      const emailPromises = chunk.map((recipient) => {
        const unsubscribeToken = signUnsubscribeToken(recipient, unsubscribeSecret);
        const unsubscribeUrl = `${siteUrl}/.netlify/functions/unsubscribe?token=${unsubscribeToken}`;

        // Generate idempotency key to prevent duplicate emails
        const idempotencyKey = `update-${updateRef.id}-${recipient}`;

        return transporter.sendMail({
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
              <div style="margin-top: 16px;">
                <a
                  href="${unsubscribeUrl}"
                  style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #e2e8f0; color: #0f172a; text-decoration: none; font-size: 12px;"
                >
                  Unsubscribe
                </a>
              </div>
            </div>
          `,
          text: `${title}\n\n${excerpt}\n\nView full update: ${updateUrl}\nUnsubscribe: ${unsubscribeUrl}`,
          headers: {
            "Resend-Idempotency-Key": idempotencyKey,
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
      });

      await Promise.all(emailPromises);
    }

    await updateRef.update({ email_sent: true });

    return jsonResponse(200, { ok: true, recipients: recipients.length });
  } catch (err) {
    console.error("Error in send-investor-update:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return jsonResponse(500, { 
      error: "Failed to send update.",
      details: errorMessage,
    });
  }
};
