import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";
import { checkRateLimit } from "./lib/rate-limit";

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

    // Rate limiting: 10 requests per hour per admin
    const rateLimit = await checkRateLimit(decoded.uid, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    if (!rateLimit.allowed) {
      return jsonResponse(429, {
        error: "Rate limit exceeded",
        message: "Too many update requests. Please try again later.",
        resetAt: rateLimit.resetAt,
        type: "RateLimit",
      });
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

    // Get all approved emails from approved_domains (single source of truth)
    const domainsSnap = await adminDb.collection("approved_domains").get();
    const allApprovedEmails = new Set<string>();
    
    domainsSnap.docs.forEach((doc) => {
      const domainData = doc.data();
      const emails = domainData.emails || [];
      emails.forEach((email: string) => {
        if (typeof email === "string" && email.includes("@")) {
          allApprovedEmails.add(email.toLowerCase());
        }
      });
    });

    // Get subscribed status from users collection
    // Build a map of email -> subscribed status
    const usersSnap = await adminDb.collection("users").get();
    const emailSubscribedMap = new Map<string, boolean>();
    
    usersSnap.docs.forEach((doc) => {
      const userData = doc.data();
      const userEmail = userData.email?.toLowerCase();
      if (userEmail && typeof userEmail === "string") {
        // Default to true if not set (backward compatibility)
        emailSubscribedMap.set(userEmail, userData.subscribed ?? true);
      }
    });

    // Filter to only subscribed emails that are in approved_domains
    const recipients = Array.from(allApprovedEmails).filter((email) => {
      return emailSubscribedMap.get(email) !== false; // Include if subscribed is true or undefined
    });

    if (recipients.length === 0) {
      await updateRef.update({ email_sent: true });
      return jsonResponse(200, { ok: true, recipients: 0 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;
    const resendReplyTo = process.env.RESEND_REPLY_TO || "mdil@goaimex.com";
    const smtpPort = process.env.RESEND_SMTP_PORT || "587";

    if (!resendApiKey || !resendFrom) {
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
    const subjectPrefix = process.env.EMAIL_SUBJECT_PREFIX || "GoAiMEX Update";
    const subject = `${subjectPrefix}: ${title}`;

    // Send emails in chunks to respect rate limits
    const chunks = chunkArray(recipients, 50);
    let sentCount = 0;
    let failedCount = 0;
    const failedRecipients: Array<{ email: string; error: string }> = [];

    for (const chunk of chunks) {
      const emailPromises = chunk.map(async (recipient) => {
        // Generate idempotency key to prevent duplicate emails
        const idempotencyKey = `update-${updateRef.id}-${recipient}`;

        try {
          await transporter.sendMail({
            from: resendFrom,
            to: recipient,
            replyTo: resendReplyTo,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; color: #0f172a;">
                <h2 style="margin-bottom: 8px;">${title}</h2>
                <p style="margin-top: 0; color: #475569;">${excerpt}</p>
                <p>
                  <a href="${updateUrl}" style="color: #2563eb; text-decoration: none;">View full update</a>
                </p>
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                  <p style="margin: 0;">
                    If you do not wish to receive these updates, please email us at 
                    <a href="mailto:${resendReplyTo}" style="color: #2563eb; text-decoration: none;">${resendReplyTo}</a>
                  </p>
                </div>
              </div>
            `,
            text: `${title}\n\n${excerpt}\n\nView full update: ${updateUrl}\n\nIf you do not wish to receive these updates, please email us at ${resendReplyTo}`,
            headers: {
              "Resend-Idempotency-Key": idempotencyKey,
            },
          });
          sentCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          failedRecipients.push({ email: recipient, error: errorMessage });
          console.error(`Failed to send email to ${recipient}:`, errorMessage);
        }
      });

      await Promise.all(emailPromises);
    }

    // Update document with send status
    await updateRef.update({ 
      email_sent: failedCount === 0,
      sent_count: sentCount,
      failed_count: failedCount,
    });

    // If all emails failed, delete the update document
    if (sentCount === 0 && failedCount > 0) {
      await updateRef.delete();
      return jsonResponse(500, {
        error: "Failed to send update",
        type: "Network",
        message: "All emails failed to send. Please check your email configuration and try again.",
        details: process.env.NODE_ENV === "development" ? failedRecipients : undefined,
        sent: 0,
        failed: failedCount,
      });
    }

    // Partial success or full success
    const statusCode = failedCount > 0 ? 207 : 200; // 207 Multi-Status for partial success
    return jsonResponse(statusCode, {
      ok: true,
      recipients: recipients.length,
      sent: sentCount,
      failed: failedCount,
      failedRecipients: failedCount > 0 ? failedRecipients : undefined,
      message: failedCount > 0 
        ? `Update sent to ${sentCount} recipients. ${failedCount} failed.`
        : `Update sent successfully to ${sentCount} recipients.`,
    });
  } catch (err) {
    console.error("Error in send-investor-update:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });

    // Determine error type
    let errorType = "Server";
    let userMessage = "An unexpected error occurred. Please try again.";

    if (err instanceof TypeError && errorMessage.includes("fetch")) {
      errorType = "Network";
      userMessage = "Network error: Unable to connect to email service.";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      errorType = "Timeout";
      userMessage = "Request timed out. Please try again.";
    } else if (errorMessage.includes("auth") || errorMessage.includes("token")) {
      errorType = "Authentication";
      userMessage = "Authentication error. Please sign in again.";
    }

    return jsonResponse(500, {
      error: "Failed to send update",
      type: errorType,
      message: userMessage,
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    });
  }
};
