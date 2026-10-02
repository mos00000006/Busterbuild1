BusterBuild Customer QR View Update

Replace ONLY these four files inside:
Busterbuild1/sales-app/

- index.html
- app.js
- styles.css
- sw.js

Do NOT replace firebase-config.js, your catalogue JSON files, manifest, or icons.

Result:
- Normal Sales App URL (no product query): staff still see the login and full sales app.
- Price-tag QR URL with ?product=CODE: customers bypass login and see only:
  product image/details/price + Smart Measure (where applicable).
- Customer QR view has NO quantity controls, NO Add to Cart, NO cart, NO quotations, NO account access.
- Existing QR codes continue to work; you do not need to remake them.

Permanent staff app URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
