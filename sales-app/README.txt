BusterBuild Sales App v2.0 Complete
Build: 20261003-v2complete1

This package includes the full professional sales upgrade requested.
STOCK AVAILABILITY WAS DELIBERATELY NOT ADDED.

INCLUDED
1. Customer database + customer quote history
2. Quote validity / expiry (24, 48, 72 hours)
3. Price-change warning when reopening an old quote
4. Discount control: 0%, 2%, 5%; custom is admin-only
5. Customer confirmation fields
6. Convert to official sale + official sales-system reference
7. Salesperson personal dashboard
8. Manager team-performance dashboard
9. Follow-up reminders + WhatsApp follow-up after 2 days
10. Favourites + recently viewed products
11. Product comparison (up to 3)
12. Saved rooms/projects in Smart Measure
13. Waste allowance
14. Tile layout options (Straight, Diagonal, Herringbone)
15. Suggested accessories (adhesive, grout, spacers, cleaner)
16. Custom Combo Builder
17. Improved customer QR product mode with Share / Copy Product Code
18. Install-App guidance for Android and iPhone
19. Device/session tracking + last activity
20. Audit trail in Firestore
21. Admin CSV export for quotations and customers
22. Catalogue error Retry button
23. Help / Training section
24. Recent scan history
25. Cloud quotation/customer persistence retained
26. Smart Measure m² pricing retained

SMART MEASURE
- Straight lay defaults to 5% waste
- Diagonal defaults to 10%
- Herringbone defaults to 15%
- Customer is charged by calculated m² including selected waste allowance
- Boxes remain the fulfilment recommendation
- Multiple rooms can be saved and combined

FILES TO UPLOAD TO:
Busterbuild1/sales-app/

REPLACE:
- index.html
- app.js
- styles.css
- sw.js

ADD:
- app-v2.js
- app-version.json

DO NOT REPLACE:
- firebase-config.js
- manifest.webmanifest
- icons/
- data/pulse-tile-catalogue.json
- data/pulse-combo-catalogue.json
- data/sanitary-products.json

FIRESTORE
Publish the included firestore.rules:
Firebase Console -> Firestore Database -> Rules

Your administrator email is already set in the supplied rules:
moyanamoses006@icloud.com

PERMANENT URL
https://mos00000006.github.io/Busterbuild1/sales-app/

ROLL-OUT TEST
Before installing on every salesperson's phone:
1. Test on one iPhone and one Android.
2. Sign in as a normal salesperson.
3. Scan a tile QR.
4. Test Straight/Diagonal/Herringbone and waste allowance.
5. Save two rooms and use Project Total.
6. Add accessories and create the estimate.
7. Save a customer and reopen them from Customers.
8. Send the PDF by WhatsApp.
9. Leave the estimate Sent, then confirm follow-up appears after 2 days.
10. Change to Customer Confirmed and Converted.
11. Enter the official sales-system reference.
12. Sign in as Admin and verify dashboards and CSV exports.
13. Reopen an older quote after a catalogue price change and verify the price-change warning.
