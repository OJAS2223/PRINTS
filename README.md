# Ojas Print Service & e-Services Studio (Modular Edition v4)

## Clean Modular Architecture (छोटी-छोटी अलग-अलग फाइलें)
1. **Root (`/`)**:
   - `index.html` (Main Landing & Tools Studio)
   - `manifest.json`, `sw.js`, `vercel.json`, `package.json`
2. **`/css/` Folder**:
   - `css/theme.css` (Universal Day/Light & Night/Dark Theme Engine + Printable A4 Styles)
3. **`/js/` Folder**:
   - `js/theme.js` (Royal Indigo & Sapphire Theme Palette + Day/Night Switcher)
   - `js/config.js` (Firebase `upeprint` Config, Service Credit Rates, District/Tehsil/SDM Data & Form Helpers)
   - `js/pdf-engine.js` (Template Loader, Auto `m.png` Stamp for Caste/Domicile, e-Voter Processor & 3x HD PDF Export)
   - `js/config-templates.js` (Barrel connector)
   - `js/portal-forms.js` (All Service Forms & Submission Logic)
   - `js/portal-wallet-chat.js` (User Auth, Wallet, Support Chat & History)
   - `js/admin-logic.js` (Separate `/secret-admin` Login, ₹20 Stamp + ₹20 Cert Auto-Deduction & Portal Controls)
   - `js/tools-logic.js` (8 Client-Side PDF & Photo Utilities)
4. **`/pages/` Folder**:
   - `pages/portal.html` (`/portal` User Dashboard)
   - `pages/admin.html` (`/secret-admin` Dedicated Super Admin Panel)
   - `pages/tools.html` (`/tools` Studio)
5. **`/templates/` Folder**:
   - `caste.html`, `domicile.html`, `evoter.html`, and all 9 `annexure-*.html` files.
6. **`/api/` Folder**:
   - `api/create-order.js` & `api/webhook.js`
7. **`/images/` Folder**:
   - Place `m.png` (Auto Stamp for Caste/Domicile), `logo.png`, `sealofup.jpg`, `GOVERNMENT_MONOGRAM.gif`, and city stamps here.

## Updated Pricing (No VIP - All Normal Users)
- **Domicile / Caste / e-Voter ID / DOB Delhi**: ₹10 (10 Credits)
- **Passport Services**: ₹30 (30 Credits)
- **DOB (Minor Birth Certificate)**: ₹50 (50 Credits)
- **Annexures (1 to F)**:
  - Generate Annexure = ₹10 (10 Credits)
  - Admin Stamp Attach = +₹20 (20 Credits) -> Total ₹30
  - Admin Certificate Attach = +₹20 (20 Credits) -> Total ₹50 Complete (Annexure ₹10 + Stamp ₹20 + Cert ₹20)
