# Ojas Print Service & e-Services Studio (ogasprints.in)

## Complete Modular Architecture
1. **Root (`/`)**:
   - `index.html` & `tools.html` (Main Landing & 8-in-1 PDF/Photo Tools Studio)
   - `portal.html` (`/portal` User Dashboard)
   - `ovi.html` (`/ovi` Dedicated Super Admin Gateway)
   - `Citizen - Portal.html` & `verify.html` (`/verify/:id` QR Verification Portal)
   - `manifest.json`, `sw.js`, `vercel.json`, `package.json`, `firestore.rules`, `.env.example`
2. **`/api/` Backend Serverless Endpoints (100% Server-Locked)**:
   - `api/create-order.js` (Creates Razorpay Order + Dynamic UPI QR + 1-Click Mobile UPI Intent URLs)
   - `api/verify-payment.js` (Verifies Razorpay HMAC-SHA256 Signature, Auto-Credits Wallet & Sends Instant Telegram Bot Alert)
   - `api/webhook.js` (Handles Razorpay & UPI Gateway Webhooks + Instant Telegram Bot Alert)
   - `api/dob-print.js` (Hidden Server-Side BRN API for **DOB Original PDF** with ₹140 / 140 Credits atomic deduction & auto-refund on error)
   - `api/notify-admin.js` (Sends Instant Telegram Bot Alerts for 24–48h Failed Payment Tickets & Password Reset Tickets)
3. **`/css/` & `/js/` Folders**:
   - `css/theme.css`, `js/theme.js`, `js/config.js`, `js/pdf-engine.js`, `js/config-templates.js`, `js/portal-forms.js`, `js/portal-wallet-chat.js`, `js/admin-logic.js`, `js/tools-logic.js`
4. **`/templates/` Folder (All 15 Templates Included)**:
   - `caste.html`, `domicile.html`, `evoter.html`, `dob-delhi.html`, `dob-print.html`, `gazette.html`, and all 9 `annexure-*.html` (`1`, `1a`, `3`, `3a`, `b`, `c`, `d`, `e`, `f`) files.

## Service Credit Rates (Anti-Tamper Server Enforced)
- **Domicile / Caste / e-Voter ID / DOB Delhi**: ₹10 (10 Credits)
- **Passport Services**: ₹30 (30 Credits)
- **DOB (Minor Birth Certificate)**: ₹50 (50 Credits)
- **Gazette Notification**: ₹100 (100 Credits)
- **DOB Original PDF (डेट ऑफ बर्थ PDF ओरिजिनल)**: **₹140 (140 Credits)** (Mandatory for all members except Admin)
- **Annexures (1 to F)**:
  - Generate Annexure = ₹10 (10 Credits)
  - Admin Stamp Attach = +₹20 (20 Credits) -> Total ₹30
  - Admin Certificate Attach = +₹20 (20 Credits) -> Total ₹50 Complete
