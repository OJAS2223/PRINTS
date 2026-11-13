# Ojas Print Service & e-Services Studio (ojasprints.in)

## Modular Directory Structure
1. **Root (`/`)**:
   - `index.html`, `manifest.json`, `sw.js`, `vercel.json`, `package.json`, `firestore.rules`, `.env.example`, `.gitignore`
2. **`/api/` Backend Serverless Endpoints**:
   - `api/create-order.js` — Creates Razorpay Order & records Pending payment in Firestore
   - `api/verify-payment.js` — Verifies Razorpay HMAC-SHA256 Signature / Order Status, atomically credits wallet via Firebase Admin SDK, and sends Telegram alert
   - `api/webhook.js` — Verifies `x-razorpay-signature` on Razorpay webhooks, handles paise-to-rupee conversion accurately, and credits wallet + VIP atomically
   - `api/dob-print.js` — Server-side BRN API for **DOB Original PDF** (₹140 / 140 Credits) with atomic deduction, PDF proxy, and auto-refund
   - `api/notify-admin.js` — Sends Telegram Bot alerts for 24–48h Payment Tickets & Forgot Password Tickets
3. **`/css/` & `/js/` Modular Frontend**:
   - `css/theme.css` & `js/theme.js`
   - `js/config.js`, `js/pdf-engine.js`, `js/config-templates.js`
   - **Portal Forms (3 modules):** `js/portal-forms.js`, `js/portal-forms-services.js`, `js/portal-forms-annexures.js`
   - **Portal Wallet, Chat & History (3 modules):** `js/portal-wallet-chat.js`, `js/portal-wallet-payments.js`, `js/portal-chat-history.js`
   - **Admin Panel (3 modules):** `js/admin-logic.js`, `js/admin-users-chat.js`, `js/admin-payments-history.js`
   - **Tools Studio (3 modules):** `js/tools-logic.js`, `js/tools-photo.js`, `js/tools-pdf-editor.js`
4. **`/pages/`**:
   - `pages/portal.html`, `pages/admin.html`, `pages/tools.html`, `pages/verify.html`
5. **`/templates/`**:
   - `caste.html`, `domicile.html`, `evoter.html`, `dob-delhi.html`, `dob-print.html`, `gazette.html`, `passport.html`, and `annexure-1.html` through `annexure-f.html`

## Required Vercel Environment Variables
Set these in **Vercel Project Settings -> Environment Variables**:
- `FIREBASE_SERVICE_ACCOUNT` (Full JSON string of your Firebase Service Account — **required** for instant server-side wallet auto-crediting and DOB PDF auto-refunds)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `DOB_PRINT_API_URL`, `DOB_PRINT_API_KEY`
