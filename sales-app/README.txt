BusterBuild Sales App — Mobile Zoom Fix

Replace ONLY these four files in:
Busterbuild1/sales-app/

1. index.html
2. app.js
3. styles.css
4. sw.js

Do NOT replace:
- firebase-config.js
- manifest.webmanifest
- icons
- catalogue JSON files

What this update fixes:
- iPhone/iOS form-field auto zoom when typing.
- The screen staying zoomed after entering customer details.
- Horizontal page expansion caused by the wide quotation preview.
- Quotation preview now remains inside its own horizontal scroll area.
- Long customer emails/product names no longer force the whole app wider.
- Preserves the customer QR product-only view from the previous update.
- Preserves staff login, catalogue, scanner, cart, quotations, PDF, WhatsApp and email features.

Permanent Sales App URL remains:
https://mos00000006.github.io/Busterbuild1/sales-app/

After pushing the files to GitHub, wait for Pages to deploy and reload the same URL.
On an installed iPhone PWA, fully close and reopen the app once after the update.
