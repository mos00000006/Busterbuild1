BusterBuild Sales App — Smart Measure Cart Price Fix

Replace ONLY these four files in:
Busterbuild1/sales-app/

- index.html
- app.js
- styles.css
- sw.js

Do NOT replace firebase-config.js, catalogue JSON files, icons, or manifest.

NEW SMART MEASURE BEHAVIOUR
1. Enter room length and width.
2. Smart Measure calculates the required m², recommended boxes and Estimated Total.
3. The tile quantity is automatically set to the exact Smart Measure m².
4. Tap Add Smart Measure to Cart.
5. The cart line total stays EXACTLY the same as the Smart Measure Estimated Total.
6. The same price then carries through to the quotation preview and PDF.

Example:
If Smart Measure shows:
Required area: 10.08 m²
Estimated Total: R4,233.50

The cart will add:
10.08 m²
Total: R4,233.50

The calculator, cart, quotation and PDF all use the same 2-decimal m² value and the same .99 product price.

This update also preserves:
- mobile auto-PDF download
- mobile zoom fix
- customer QR product-only view
- staff login/cart/quotation workflow
- WhatsApp, email, Download PDF and Share PDF

Permanent URL remains:
https://mos00000006.github.io/Busterbuild1/sales-app/
