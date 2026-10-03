BusterBuild Sales App v1.0 Professional
Build: 20261003-v1professional1

This package upgrades the current Sales App without replacing your Firebase configuration,
catalogue JSON files, icons, or manifest.

WHAT IS INCLUDED

1. APP VERSION + UPDATE CONTROL
- Current version displayed as v1.0.0.
- The app checks app-version.json for a newer release.
- When a newer build exists, staff see an "Update App" banner.
- "Update App" clears stale app caches and reloads the SAME permanent URL.

2. ONLINE / OFFLINE + CLOUD STATUS
- Online / Offline indicator.
- Cloud synced / syncing / sync issue indicator.
- If the salesperson is offline, quotations still save on the device.
- Pending quotations retry cloud sync when the connection returns.

3. PRICE / CATALOGUE SYNC TIMESTAMP
- Shows the latest generated_at timestamp from the live catalogue JSON files.
- Staff can see when the price catalogue was last refreshed.

4. CLOUD QUOTATIONS
- Saved quotations are written to Firestore collection: quotations.
- Salespeople load their own quotations on any authorised device.
- Administrator can see all cloud quotations.
- Local device history remains as an offline fallback.

5. QUOTE STATUS WORKFLOW
Statuses:
- Draft
- Sent
- Customer Confirmed
- Converted
- Cancelled

The quotation form also has:
- Official sales-system reference

WhatsApp / Email will move a saved Draft quotation to Sent automatically.

6. ADMIN SALES DASHBOARD
Administrator dashboard includes:
- Quotes today
- Today's estimate value
- Customer Confirmed value
- Converted value
- Latest quotation activity by salesperson

FILES TO UPLOAD / REPLACE IN:
Busterbuild1/sales-app/

REPLACE:
- index.html
- app.js
- styles.css
- sw.js

ADD:
- app-v1.js
- app-version.json

DO NOT REPLACE:
- firebase-config.js
- manifest.webmanifest
- icons/
- your catalogue JSON files

FIRESTORE RULES
This ZIP also contains:
- firestore.rules

For cloud quotations to work, publish these rules in:
Firebase Console -> Firestore Database -> Rules

The administrator email in the rules is:
moyanamoses006@icloud.com

IMPORTANT
Your permanent app address remains:
https://mos00000006.github.io/Busterbuild1/sales-app/

The current Smart Measure m² pricing logic is preserved:
Required m² is the chargeable quantity, while recommended boxes remain informational.

ROLL-OUT TEST
Before issuing the app to the whole sales team:
1. Sign in on one iPhone and one Android.
2. Confirm Online + Cloud synced indicators.
3. Open a tile, use Smart Measure, add to cart and verify the exact m² total.
4. Save a quotation and verify "saved and synced".
5. Sign into the same salesperson account on another device and confirm the quotation appears.
6. As administrator, open Manage Sales Team and confirm the dashboard shows the quotation.
7. Change status to Customer Confirmed, then Converted, and add the official sales-system reference.
8. Generate/share the PDF.
