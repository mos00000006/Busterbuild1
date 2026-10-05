BusterBuild Sales App — MOBILE + PC + CUSTOMER QR CLEANUP
Version 2.0.9

WHAT WAS FIXED

1. CUSTOMER QR / PRICE-TAG VIEW
Customers scanning a product QR now see ONLY:
- BusterBuild product image
- Product name
- Product code
- Product price
- Product description / specifications
- Simple Smart Measure
- Room length
- Room width
- Required m²
- Recommended boxes
- Coverage
- Estimated m² price
- Share Product
- Copy Product Code

CUSTOMERS DO NOT SEE:
- Add to Cart
- Quantity
- Tile Adhesive suggestions
- Grout / spacers / cleaner suggestions
- Add Room to Project
- Saved Rooms
- Project Total
- Combo Builder
- Internal sales navigation
- Staff tools
- Quote controls
- Waste / tile-layout controls

Customer Smart Measure is intentionally simple:
Room length × room width.
It is shown as an estimate and tells the customer that a BusterBuild salesperson can
confirm the final requirement.

2. MOBILE
- Full-width clean customer product page.
- Larger touch controls.
- 16px form fields to stop phone auto-zoom.
- Responsive Smart Measure.
- Safe-area support for iPhone.
- Product image scales correctly.
- No horizontal overflow.
- Share / Copy Code buttons fit properly.

3. PC / LAPTOP
- Product detail uses a clean two-column layout.
- Product image remains easy to view.
- Product details scroll independently when needed.
- Smart Measure results fit on one row on larger screens.
- Customer QR product page is centered and polished.

4. STAFF SALES APP
All staff features remain:
- Sign In
- Catalogue
- Scanner
- Smart Measure
- Cart
- Quotations
- Customer database
- Dashboards
- Follow-ups
- Combo Builder
- Admin
- Cloud functions

FILES TO REPLACE:
- index.html
- app.js
- styles.css
- sw.js
- app-version.json

ADD:
- app-v2-customerqr.js

firestore.rules is unchanged and included for convenience.

DO NOT REPLACE:
- firebase-config.js
- manifest.webmanifest
- icons/
- catalogue JSON files

Permanent URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
