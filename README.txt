BUSTERBUILD SALES APP — PULSE BATHROOMS
Version 2.1.0

SOURCE
https://pulsetiles.co.za/bathrooms/

WHAT THIS UPDATE ADDS
- Pulse bathroom products to the BusterBuild Sales App.
- Main Bathrooms filter.
- Bathroom subfilters:
  * All Bathrooms
  * Basins
  * Toilets
  * Showers
  * Taps
  * Baths
  * Bathroom Furniture
- Existing BusterBuild sanitary-products.json is preserved and merged.
- Pulse Bathroom Tiles / Floor Tiles / Mosaics are excluded from this new feed because
  those products are already covered by the Pulse tile catalogue.
- BusterBuild price policy is applied: bathroom selling prices end in .99.
- Product images, names, codes, descriptions and specifications are pulled from Pulse.
- Customer product QR view remains clean:
  no Add to Cart, no accessories, no staff-only controls.
- Works on cellphone, tablet and PC.

UPLOAD / REPLACE

1. Busterbuild1/sales-app/
   Replace:
   - index.html
   - app.js
   - styles.css
   - sw.js
   - app-version.json

   Add:
   - app-v2-bathrooms.js

2. Busterbuild1/scripts/
   Add:
   - update_bathroom_catalogue.py

3. Busterbuild1/.github/workflows/
   Add:
   - update-bathroom-catalogue.yml

4. Busterbuild1/data/
   Add:
   - pulse-bathroom-catalogue.json

IMPORTANT
Do NOT replace:
- sales-app/firebase-config.js
- manifest.webmanifest
- icons/
- your existing tile/combo catalogues
- sales-app/data/sanitary-products.json

FIRST SYNC
Uploading the new updater/workflow triggers the GitHub Action because the workflow watches
those paths. The Action will crawl Pulse Bathrooms and replace the placeholder
data/pulse-bathroom-catalogue.json with the live catalogue.

You can also run it manually:
GitHub -> Actions -> Update Pulse bathroom catalogue -> Run workflow

The workflow then runs daily automatically.

PERMANENT APP URL
https://mos00000006.github.io/Busterbuild1/sales-app/
