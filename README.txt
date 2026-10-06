BUSTERBUILD SALES APP — PULSE KITCHENS
Version 2.2.0

THIS PACKAGE INCLUDES THE PREVIOUS PULSE BATHROOMS UPDATE + THE NEW KITCHENS UPDATE.

SOURCE
https://pulsetiles.co.za/kitchens/

NEW KITCHEN SECTION
- All Kitchens
- Kitchen Sinks
- Sink Taps
- Sink Fittings

Pulse's kitchen area also links to kitchen tile ranges. Those tile categories are NOT duplicated
inside the kitchen feed because the BusterBuild app already loads Pulse tiles from the dedicated
tile catalogue. This keeps one clean tile record and preserves Smart Measure.

THE APP STILL KEEPS
- Tiles
- Bathrooms and all bathroom subcategories
- Kitchens
- Combo Deals
- Welcome motion
- Staff sign-in
- Mobile / tablet / PC responsive layouts
- Clean customer QR product page
- Smart Measure for tiles
- Cart / quotations / customer database / dashboards / admin tools

BUSTERBUILD PRICING
Pulse prices are converted to the BusterBuild .99 ending in the kitchen updater.

UPLOAD TO GITHUB

1. Busterbuild1/sales-app/
   REPLACE:
   - index.html
   - app.js
   - styles.css
   - sw.js
   - app-version.json

   ADD:
   - app-v2-kitchens.js

2. Busterbuild1/scripts/
   KEEP the bathroom updater and ADD:
   - update_kitchen_catalogue.py

3. Busterbuild1/.github/workflows/
   KEEP the bathroom workflow and ADD:
   - update-kitchen-catalogue.yml

4. Busterbuild1/data/
   KEEP pulse-bathroom-catalogue.json and ADD:
   - pulse-kitchen-catalogue.json

DO NOT REPLACE
- sales-app/firebase-config.js
- manifest.webmanifest
- icons/
- pulse-tile-catalogue.json
- pulse-combo-catalogue.json
- sales-app/data/sanitary-products.json

FIRST KITCHEN SYNC
After the updater/workflow is uploaded, GitHub Actions should run the kitchen catalogue job.
You can also run:
GitHub -> Actions -> Update Pulse kitchen catalogue -> Run workflow

PERMANENT APP URL
https://mos00000006.github.io/Busterbuild1/sales-app/
