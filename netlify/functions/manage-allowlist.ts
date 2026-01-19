import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "./lib/firebase";
import { jsonResponse } from "./lib/response";

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
};

const isAdmin = async (email: string) => {
  const adminDoc = await adminDb.collection("admins").doc(email.toLowerCase()).get();
  return adminDoc.exists;
};

const sendWelcomeEmail = async (recipientEmail: string) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  const resendReplyTo = process.env.RESEND_REPLY_TO || "mdil@goaimex.com";
  const smtpPort = process.env.RESEND_SMTP_PORT || "587";
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:8888";

  if (!resendApiKey || !resendFrom) {
    console.warn("Email configuration missing. Skipping welcome email.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: parseInt(smtpPort, 10),
      secure: smtpPort === "465" || smtpPort === "2465",
      auth: {
        user: "resend",
        pass: resendApiKey,
      },
    });

    const investorUrl = `${siteUrl}/investor`;
    const subject = "Welcome to GoAiMEX Investor Updates";

    await transporter.sendMail({
      from: resendFrom,
      to: recipientEmail,
      replyTo: resendReplyTo,
      subject,
      headers: {
        "Resend-Idempotency-Key": `welcome-${recipientEmail.toLowerCase()}`,
      },
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin-bottom: 16px;">Welcome to GoAiMEX Investor Updates</h2>
          <p style="color: #475569; line-height: 1.6;">
            You have been subscribed to receive investor updates from GoAiMEX. 
            We'll keep you informed about our milestones, metrics, and key developments.
          </p>
          <p style="margin-top: 24px;">
            <a href="${investorUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
              View Investor Portal →
            </a>
          </p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            <p style="margin: 0;">
              If you have any questions, please contact us at 
              <a href="mailto:${resendReplyTo}" style="color: #2563eb; text-decoration: none;">${resendReplyTo}</a>
            </p>
          </div>
        </div>
      `,
      text: `Welcome to GoAiMEX Investor Updates

You have been subscribed to receive investor updates from GoAiMEX. We'll keep you informed about our milestones, metrics, and key developments.

View Investor Portal: ${investorUrl}

If you have any questions, please contact us at ${resendReplyTo}`,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    // Don't throw - email sending failure shouldn't block the operation
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
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
    const type = payload.type; // "email" or "domain"
    const value = payload.value?.trim().toLowerCase();

    if (!type || !value) {
      return jsonResponse(400, { error: "Type and value required." });
    }

    if (type === "email") {
      if (!value.includes("@")) {
        return jsonResponse(400, { error: "Invalid email format." });
      }

      const emailDomain = value.split("@")[1];
      if (!emailDomain) {
        return jsonResponse(400, { error: "Invalid email format." });
      }

      if (event.httpMethod === "DELETE") {
        // Remove email from domain's emails array
        const domainRef = adminDb.collection("approved_domains").doc(emailDomain);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          return jsonResponse(404, { error: "Domain not found." });
        }

        const domainData = domainDoc.data();
        const emails = (domainData?.emails || []).filter((e: string) => e !== value);

        // If no emails remain, delete the domain document to prevent security issue
        // (empty array would mean no approvals, but deleting is cleaner)
        if (emails.length === 0) {
          await domainRef.delete();
        } else {
          await domainRef.update({ emails });
        }

        // Sync user record: mark as not approved if user exists
        const usersSnap = await adminDb
          .collection("users")
          .where("email", "==", value)
          .limit(1)
          .get();
        
        if (!usersSnap.empty) {
          await usersSnap.docs[0].ref.update({ approved: false });
        }

        return jsonResponse(200, { 
          success: true, 
          message: emails.length === 0 
            ? "Email removed. Domain deleted as it had no remaining emails." 
            : "Email removed." 
        });
      } else {
        // Add email to domain's emails array (or create domain if it doesn't exist)
        const domainRef = adminDb.collection("approved_domains").doc(emailDomain);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          // Create new domain document with this email
          await domainRef.set({
            domain: emailDomain,
            emails: [value],
          });
        } else {
          // Add email to existing domain's emails array
          const domainData = domainDoc.data();
          const emails = domainData?.emails || [];

          if (emails.includes(value)) {
            return jsonResponse(409, { error: "Email already exists." });
          }

          await domainRef.update({
            emails: [...emails, value],
          });
        }

        // Update existing user record if it exists (users collection uses uid as doc ID)
        // For new users, create-user will default to subscribed: true when they sign up
        const usersSnap = await adminDb
          .collection("users")
          .where("email", "==", value)
          .limit(1)
          .get();

        if (!usersSnap.empty) {
          // User exists - update to ensure they're approved and subscribed
          await usersSnap.docs[0].ref.update({
            approved: true,
            subscribed: true,
          });
        }
        // If user doesn't exist yet, they'll be created with subscribed: true by default
        // when they sign up (see create-user.ts)

        // Send welcome email (non-blocking - don't fail if email fails)
        await sendWelcomeEmail(value);

        return jsonResponse(200, { success: true, message: "Email added and subscribed." });
      }
    } else if (type === "domain") {
      if (!value.includes(".") || value.startsWith("@")) {
        return jsonResponse(400, { error: "Invalid domain format (e.g., 'example.com')." });
      }

      if (event.httpMethod === "DELETE") {
        // Delete domain document
        const domainRef = adminDb.collection("approved_domains").doc(value);
        const domainDoc = await domainRef.get();

        if (!domainDoc.exists) {
          return jsonResponse(404, { error: "Domain not found." });
        }

        await domainRef.delete();
        return jsonResponse(200, { success: true, message: "Domain removed." });
      } else {
        // Create domain document (or update if exists)
        const domainRef = adminDb.collection("approved_domains").doc(value);
        const domainDoc = await domainRef.get();

        if (domainDoc.exists) {
          return jsonResponse(409, { error: "Domain already exists." });
        }

        await domainRef.set({
          domain: value,
          emails: [],
        });

        return jsonResponse(200, { success: true, message: "Domain added." });
      }
    } else {
      return jsonResponse(400, { error: "Type must be 'email' or 'domain'." });
    }
  } catch (err) {
    console.error("Error in manage-allowlist:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(500, {
      error: "Failed to manage allowlist.",
      details: errorMessage,
    });
  }
};
