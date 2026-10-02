BusterBuild Sales App — Auto PDF Download for Mobile

Replace these four files in:
Busterbuild1/sales-app/

- index.html
- app.js
- styles.css
- sw.js

Do NOT replace:
- firebase-config.js
- catalogue JSON files
- manifest.webmanifest
- icons

New behaviour:
- On iPhone / iPad / Android, tapping SAVE QUOTATION now:
  1. saves the quotation in the app,
  2. automatically creates the branded PDF,
  3. automatically starts the PDF download.
- Desktop Save Quotation behaviour remains unchanged.
- WhatsApp and Email continue to download the PDF before opening the customer message.
- Download PDF and Share PDF buttons still work.
- Mobile zoom fix and customer QR product-only view are preserved.

Permanent URL remains:
https://mos00000006.github.io/Busterbuild1/sales-app/

Important:
Mobile browsers control the final download destination. On iPhone/iPad the PDF normally appears in Downloads / Files. If iOS blocks an automatic download, the existing Download PDF button remains available as fallback.
