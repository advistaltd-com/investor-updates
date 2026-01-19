# Investor Portal

Open-source, authenticated investor portal powered by Firebase Auth + Firestore and Netlify Functions. Perfect for startups and companies to share private updates with investors.

## Features

- 🔐 **Secure Authentication**: Email link (passwordless) signup with password setup
- 📧 **Email Updates**: Send investor updates via Resend SMTP
- 👥 **Access Control**: Domain-based and email-based approval system
- 🎨 **Modern UI**: Built with React, TypeScript, Tailwind CSS, and shadcn/ui
- 📱 **Responsive**: Works seamlessly on desktop and mobile
- 🔒 **Admin Dashboard**: Manage approved emails/domains and publish updates

## Folder structure

- `netlify/functions`
  - `check-allowlist.ts` - validates approved email/domain
  - `create-user.ts` - syncs user profile after auth
  - `send-investor-update.ts` - sends update emails via Resend SMTP
  - `get-allowlist.ts` - fetches approved emails/domains (admin only)
  - `manage-allowlist.ts` - manages approved emails/domains (admin only)
  - `seed-db.ts` - database seeding function
  - `unsubscribe.ts` - unsubscribe handler (legacy, no longer used in emails)
- `src`
  - `components/auth` - gated auth flow with email link signup
  - `pages/Admin.tsx` - admin update composer and access control
  - `pages/Investor.tsx` - timeline updates from Firestore
- `firestore.rules` - Firestore security rules
- `scripts/seed-db.ts` - local database seeding script

## Local setup

1. Install dependencies
   ```bash
   npm install
   ```

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
   - `approved_domains` collection with domain as document ID
   - Document structure: `{ domain: "example.com", emails: ["user1@example.com"] }`
   - **Note**: Generic email providers (gmail.com, yahoo.com, etc.) require explicit email approval even if domain is added
4. Add Firestore rules from `firestore.rules`.
5. Create a service account and set:
   - `FIREBASE_SERVICE_ACCOUNT` in Netlify env vars (JSON or base64).
6. Set an admin user:
   - **Easy way (recommended)**: Run the seed script:
     ```bash
     ADMIN_EMAIL=your@email.com npm run seed
     ```
     This will add your email to the `approved_domains` collection (in its domain's emails array) and to the `admins` collection.
   
   - **Manual way**: Create a document in the `admins` collection with the admin's email as the document ID (lowercase).
     - Example: Collection `admins`, Document ID: `admin@example.com`
     - Document data: `{ email: "admin@example.com" }` (optional fields)
     - Also add the email to `approved_domains` collection (add to domain's emails array)
   - The user must sign in once to create their account before they can access admin features.

## Netlify functions

Functions run in `netlify/functions` and use Firebase Admin SDK:

- `check-allowlist`: gate access by email/domain with special handling for generic email providers.
- `create-user`: syncs user profile and login metadata.
- `send-investor-update`: creates update + sends emails via Resend SMTP.
- `get-allowlist`: fetches all approved domains and emails with user metadata (admin only).
- `manage-allowlist`: add/remove approved domains and emails (admin only). When adding an email, automatically subscribes the user and sends a welcome email.
- `seed-db`: seed database with admin user and dummy data.
- `unsubscribe`: updates `subscribed=false` with signed token (legacy, no longer used in emails).

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

**Optional email variables:**
- `RESEND_REPLY_TO` - Reply-to email address (defaults to `admin@example.com` if not set)
- `RESEND_SMTP_PORT` - SMTP port (default: `587`). Options: `25`, `465`, `587`, `2465`, `2587`
- `EMAIL_SUBJECT_PREFIX` - Prefix for investor update email subjects (defaults to `GoAiMEX Update`). Example: `EMAIL_SUBJECT_PREFIX="Company Name Update"` will result in subjects like "Company Name Update: {title}"

**Seed function variables (optional):**
- `SEED_SECRET` - Secret key for seed function authentication (defaults to `change-me-in-production`)
- `SEED_ADMIN_EMAIL` - Admin email to seed (required when using seed function)

**Frontend environment variables (set in Netlify Build settings):**
- `VITE_EMAIL_LINK_REDIRECT_URL` - **Required for production!** Set to your production URL (e.g., `https://your-domain.com/auth`). 
  - **Important**: This must be set in Netlify's Build environment variables (not just runtime env vars) because Vite needs it at build time.
  - Without this, email links will redirect to localhost or the wrong URL.
  - Go to: Netlify Dashboard → Site settings → Build & deploy → Environment → Add variable
  - **Note**: After setting this, you must redeploy for it to take effect. Existing email links sent before the fix will still redirect to the old URL - users will need to request a new link.

**Security Note**: Never commit real secret values to the repository. The `.env.example` file contains only placeholders. Set actual values in Netlify's environment variables dashboard.

**Getting Firebase Service Account Credentials:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

## Seeding the database

To quickly set up the initial admin user, use the seed script:

```bash
ADMIN_EMAIL=your@email.com npm run seed
```

This will:
- Add the email in `ADMIN_EMAIL` to the `approved_domains` collection (in its domain's emails array)
- Add the email in `ADMIN_EMAIL` to the `admins` collection
- Add dummy test data (example.com, test.com domains with sample emails)

**Requirements:**
- Your `.env` file must have Firebase credentials configured (see Firebase setup above)
- The script uses Firebase Admin SDK, so you need either:
  - Individual env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - Or a `service-account.json` file in the project root

**Alternative: Netlify Function**
You can also call the seed function after deployment:
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/seed-db \
  -H "x-seed-secret: your-secret-key"
```

Set `SEED_SECRET` and `SEED_ADMIN_EMAIL` in Netlify environment variables for security.

## Access request form

The modal uses a Netlify Form named `request-access` with fields:

- `name`
- `firm`
- `email`
- `linkedin`
- `note`

## Firestore collections

- `approved_domains` - **Single source of truth** for approved emails (document ID = domain name)
  - Structure: `{ domain: "example.com", emails: ["user1@example.com", "user2@example.com"] }`
  - **Generic email providers** (gmail.com, yahoo.com, etc.): Require explicit email approval - only emails in the `emails` array are approved
  - **Other domains**: If domain exists, any email from that domain is automatically approved
  - When users sign up and are approved, their emails are automatically added to this collection
- `users` - User profiles with metadata (subscribed status, last_login, etc.)
  - Structure: `{ email: "user@example.com", approved: boolean, subscribed: boolean, last_login: timestamp, created_at: timestamp }`
  - Emails in this collection should also exist in `approved_domains` for consistency
- `timeline_updates` - Investor update posts
- `admins` - Admin users (document ID = email address, lowercase)

## Deployment

1. Connect your repository to Netlify (or your preferred hosting platform)
2. Set environment variables in Netlify dashboard (see "Netlify functions" section above)
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
