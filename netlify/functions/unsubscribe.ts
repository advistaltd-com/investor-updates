import type { Handler } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "crypto";
import { adminDb } from "./lib/firebase";

const verifyToken = (token: string, secret: string) => {
  const decoded = Buffer.from(token, "base64url").toString("utf-8");
  const [email, signature] = decoded.split(":");
  if (!email || !signature) return null;

  const expected = createHmac("sha256", secret).update(email).digest("base64url");
  const valid =
    signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  return valid ? email : null;
};

export const handler: Handler = async (event) => {
  const token = event.queryStringParameters?.token;
  const secret = process.env.UNSUBSCRIBE_SECRET;

  if (!token || !secret) {
    return {
      statusCode: 400,
      body: "Invalid unsubscribe request.",
    };
  }

  const email = verifyToken(token, secret);
  if (!email) {
    return {
      statusCode: 400,
      body: "Invalid or expired unsubscribe token.",
    };
  }

  const userSnap = await adminDb
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!userSnap.empty) {
    await userSnap.docs[0].ref.update({ subscribed: false });
  }

  return {
    statusCode: 200,
    body: "You have been unsubscribed from investor updates.",
  };
};
