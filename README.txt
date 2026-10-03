BusterBuild Sales App — FINAL m² PRICING SMART MEASURE FIX

The core issue was the quantity basis.

For tiles, the customer is paying the PRICE PER m² calculation.
Therefore Smart Measure must use REQUIRED AREA as the sales quantity.
"Boxes to order" is only an operational recommendation.

EXAMPLE
Room: 3m × 3m
Required area: 9.00 m²
Boxes to order: 5
Covers: 10.80 m²
Tile price: R359.99/m²
Estimated total: R3,239.91

THE APP NOW AUTOMATICALLY CHANGES:
Quantity (m²): 9.00

The Add button becomes:
Add 9.00 m² to Cart • R3,239.91

THE CART SHOWS:
9.00 m² × R359.99/m² = R3,239.91
5 boxes recommended • covers 10.80 m²

THE QUOTATION / PDF SHOWS:
QTY: 9.00 m²
UNIT: R359.99/m²
TOTAL: R3,239.91

IMPORTANT:
The app does NOT charge 5 × the tile price.
It does NOT use the covered 10.80 m² as the chargeable quantity.
It charges the exact required area from Smart Measure.

CACHE FIX:
index.html now loads a new file:
app-m2pricing.js

This prevents phones from continuing to use the old cached JavaScript.

UPLOAD TO:
Busterbuild1/sales-app/

REPLACE:
- index.html
- app.js
- styles.css
- sw.js

ADD:
- app-m2pricing.js

Do NOT replace:
- firebase-config.js
- catalogue JSON files
- manifest
- icons

After GitHub Pages deploys:
1. Fully close the installed app.
2. Reopen it.
3. Remove any old test cart line once.
4. Calculate a tile again.
5. Quantity must automatically equal Required area in m².
