BusterBuild Sales App — FINAL SMART MEASURE FIX

Your screenshot showed the exact issue:
Smart Measure = 4.00 m² and R1,679.96,
but the cart was still adding 1 × R419.99.

This build changes that workflow completely.

NEW BEHAVIOUR
Example:
Tile price: R419.99/m²
Room: 2m × 2m
Required area: 4.00 m²
Boxes recommended: 3
Estimated total: R1,679.96

As soon as Smart Measure calculates:
- the separate Quantity control is hidden;
- there is no "Use required m² as quantity" extra step;
- the button changes to:
  ADD 4.00 m² TO CART • R1,679.96

When pressed, the cart shows:
- Smart Measure: 4.00 m²
- 3 boxes recommended
- 4.00 m² × R419.99/m²
- SMART MEASURE TOTAL: R1,679.96

The quotation and PDF then show:
QTY: 4.00 m²
UNIT: R419.99/m²
TOTAL: R1,679.96

The Smart Measure cart line cannot be changed with +/- buttons, preventing the calculated quote from being accidentally altered.

REPLACE ONLY THESE FOUR FILES IN sales-app:
- index.html
- app.js
- styles.css
- sw.js

Do NOT replace:
- firebase-config.js
- catalogue JSON files
- manifest
- icons

IMPORTANT AFTER PUSHING:
The new service worker forces the installed app to refresh to this build.
If the OLD R419.99 test item is already sitting in your cart, remove that old item once,
then calculate Smart Measure again and add it. New Smart Measure items will use the correct total.

Permanent URL remains:
https://mos00000006.github.io/Busterbuild1/sales-app/
