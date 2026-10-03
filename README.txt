BusterBuild Sales App — Smart Measure FIXED TOTAL Update

Replace ONLY:
- index.html
- app.js
- styles.css
- sw.js

inside:
Busterbuild1/sales-app/

Do NOT replace firebase-config.js, catalogue JSON files, manifest or icons.

WHAT IS DIFFERENT NOW

When Smart Measure calculates an Estimated Total, that amount becomes the FIXED price
for the cart line.

Example:
Tile price: R419.99 per m²
Smart Measure required area: 10.08 m²
Recommended boxes: 7
Estimated Total: R4,233.50

After pressing:
ADD ESTIMATED TOTAL TO CART • R4,233.50

The cart will show:
SMART MEASURE: 10.08 m² • 7 boxes
SMART MEASURE TOTAL: R4,233.50
Line total: R4,233.50

It will NOT show the original tile/box price as the cart price.

On the quotation and PDF:
- Qty = 1
- Unit Price = R4,233.50
- Total = R4,233.50
- Product description shows the Smart Measure area and recommended boxes

This removes the confusing base tile price from a Smart Measure quotation line.

All previous features are preserved:
- customer QR product-only view
- mobile zoom fix
- mobile auto PDF
- staff login
- cart/quotation/PDF
- WhatsApp and email
