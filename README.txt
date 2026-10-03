BusterBuild Sales App — Smart Measure Auto Box Quantity

This fixes the exact issue shown in the screenshot.

EXAMPLE:
Room length: 3 m
Room width: 2.97 m
Required area: 8.91 m²
Boxes to order: 7
Estimated total: R3,742.11

As soon as Smart Measure calculates 7 boxes:
- Quantity automatically changes from 1 to 7.
- Quantity label changes to "Quantity (boxes)".
- The quantity is locked to the Smart Measure result so it cannot accidentally be changed.
- Add to Cart shows "Add 7 boxes to Cart • R3,742.11".
- Cart shows Quantity: 7 boxes.
- Smart Measure total remains R3,742.11.
- Quotation/PDF shows 7 boxes and keeps the Smart Measure total.

The old "Use required m² as quantity" extra button is no longer needed.

REPLACE ONLY:
- index.html
- app.js
- styles.css
- sw.js

inside:
Busterbuild1/sales-app/

Do NOT replace:
- firebase-config.js
- catalogue JSON files
- manifest
- icons

After pushing to GitHub, fully close and reopen the installed app once.
