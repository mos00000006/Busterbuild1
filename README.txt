BusterBuild Sales App — SMART MEASURE HARD REFRESH FIX

The screenshot proves the phone/browser was still running the OLD cached app.js:
- Boxes to order showed 5
- Quantity stayed 1
- "Use required m² as quantity" was still visible

This package fixes that in two ways:

1. Smart Measure behaviour
   Example:
   Room = 3m × 3m
   Required area = 9.00 m²
   Boxes to order = 5
   Estimated total = R3,239.91

   The app now AUTOMATICALLY changes:
   Quantity (boxes) = 5

   Add button becomes:
   Add 5 boxes to Cart • R3,239.91

   The cart keeps:
   Quantity = 5 boxes
   Smart Measure Total = R3,239.91

   The fixed Smart Measure total is NOT recalculated as 5 × the m² price.

2. Cache fix
   The app now loads:
   app-smartmeasure.js

   This is a NEW filename, so the phone cannot keep using the old cached app.js.

UPLOAD/REPLACE THESE FILES IN:
Busterbuild1/sales-app/

REPLACE:
- index.html
- styles.css
- sw.js
- app.js

ADD NEW FILE:
- app-smartmeasure.js

Do not replace:
- firebase-config.js
- catalogue JSON files
- manifest.webmanifest
- icons

After GitHub Pages finishes deploying:
1. Fully close the installed Sales App.
2. Open it again from the SAME permanent address/app icon.
3. Open a tile and enter length + width.
4. "Boxes to order" and "Quantity (boxes)" must now show the SAME number.

The old "Use required m² as quantity" button is hidden permanently.
