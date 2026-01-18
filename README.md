# GoAiMEX Investor Portal

Private, authenticated investor portal powered by Firebase Auth + Firestore and Netlify Functions.

## Folder structure

- `netlify/functions`
  - `check-allowlist.ts` - validates approved email/domain
  - `create-user.ts` - syncs user profile after auth
  - `send-investor-update.ts` - sends update emails via Resend SMTP
  - `unsubscribe.ts` - one-click unsubscribe handler
- `src`
  - `components/auth` - gated auth flow with email link signup
  - `pages/Admin.tsx` - admin update composer
  - `pages/Investor.tsx` - timeline updates from Firestore
- `firestore.rules` - Firestore security rules

## Local setup

1. Install dependencies
   - `npm install`
2. Create `.env` based on `.env.example`
   - Copy `.env.example` to `.env`
   - Replace all `REPLACE_WITH_*` placeholders with your actual values
   - **Important**: Never commit `.env` files with real secrets to the repository
3. Run locally
   - For frontend only: `npm run dev`
   - For full stack (with Netlify functions): `netlify dev`
   
   **Note**: Netlify functions (like `check-allowlist`) require `netlify dev` to work. Without it, email verification will fail with a network error.

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication providers:
   - Email/password (for returning users)
   - Email link (passwordless) for initial signup
3. Create Firestore and add allowlists:
   - `approved_emails` docs with `{ email: string }`
   - `approved_domains` docs with `{ domain: string }`
4. Add Firestore rules from `firestore.rules`.
5. Create a service account and set:
   - `FIREBASE_SERVICE_ACCOUNT` in Netlify env vars (JSON or base64).
6. Set an admin user:
   - Create a document in the `admins` collection with the admin's email as the document ID (lowercase).
   - Example: Collection `admins`, Document ID: `admin@example.com`
   - Document data: `{ email: "admin@example.com" }` (optional fields)
   - The user must sign in once to create their account before they can access admin features.

## Netlify functions

Functions run in `netlify/functions` and use Firebase Admin SDK:

- `check-allowlist`: gate access by exact email or domain.
- `create-user`: syncs user profile and login metadata.
- `send-investor-update`: creates update + sends emails via Resend SMTP.
- `unsubscribe`: updates `subscribed=false` with signed token.

Required Netlify env vars (set in Netlify dashboard → Site settings → Environment variables):

**Firebase Service Account (choose one method):**

**Method 1: Individual variables (recommended - more reliable)**
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email (from service account JSON)
- `FIREBASE_PRIVATE_KEY` - Private key from service account (keep `\n` as literal, Netlify will handle it)
- Optional: `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_CLIENT_ID`, `FIREBASE_CLIENT_X509_CERT_URL`

**Method 2: JSON string (fallback)**
- `FIREBASE_SERVICE_ACCOUNT` - Complete service account JSON as string or base64 encoded

**Other required variables:**
- `RESEND_API_KEY` - Used as SMTP password (username is `resend`)
- `RESEND_FROM` - Email address to send from (must be verified domain)
- `UNSUBSCRIBE_SECRET` - Secret for signing unsubscribe tokens

Optional Netlify env vars:

- `RESEND_SMTP_PORT` - SMTP port (default: `587`). Options: `25`, `465`, `587`, `2465`, `2587`

**Security Note**: Never commit real secret values to the repository. The `.env.example` file contains only placeholders. Set actual values in Netlify's environment variables dashboard.

**Getting Firebase Service Account Credentials:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

## Access request form

The modal uses a Netlify Form named `request-access` with fields:

- `name`
- `firm`
- `email`
- `linkedin`
- `note`

## Firestore collections

- `approved_emails` - Individual approved email addresses
- `approved_domains` - Approved email domains
- `users` - User profiles synced after authentication
- `timeline_updates` - Investor update posts
- `admins` - Admin users (document ID = email address, lowercase)

## Deploy

1. Push to the `cursor/private-investor-portal-956e` branch.
2. Connect the repo to Netlify.
3. Set env vars in Netlify.
4. Deploy.
