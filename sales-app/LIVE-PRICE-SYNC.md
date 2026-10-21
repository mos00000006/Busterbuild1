# Install the BusterBuild live price connection

This folder belongs to the BusterBuild SALES WEBSITE repository. The files outside this folder belong to the Maliks Group HUB repository. Both deployments are required once. No Firebase password, service-account key or new Firestore rules are required.

## 1. Hub
Copy the root Hub patch files to the Hub repository and deploy normally. If you have not yet installed the two-brand price tag feature, apply its included migration 0035 first. This price-sync addition needs no further migration. The existing customer Cloudflare Access bypass for api/public-price-tags/* covers the read-only prices endpoint.

## 2. Sales website
Copy sales-app/hub-prices.js and scripts/install_hub_price_sync.py from this folder into the corresponding folders in the separate sales website repository. Open a terminal at that repository root and run:

    python3 scripts/install_hub_price_sync.py

The installer edits the active app script referenced by sales-app/index.html, updates the script cache version and makes the service worker fetch live prices without using offline cached responses. Existing Firebase configuration, login, catalogues, icons, images and styles remain in place. It checks the expected source sections before editing. If it reports a different app structure, stop and supply the current sales website ZIP for a tailored patch. Do not replace your website with an old complete app.

Deploy the changed sales website files normally. Close and reopen the installed sales app after deployment. New devices also receive the updated code when they open the website.

## Using it
In Hub > Price tag generator > BusterBuild, find a product code, enter your own VAT-inclusive price, keep the customer publishing checkbox selected and click Generate price tag. That saves the price; typing alone does not save it. The online sales app loads the new price on startup, within about a minute while open, when brought back into view, or on reconnect.

The same code must exist in the sales app catalogue. Prices retain their basis: each, per m², or per box. Tile coverage and box counts also follow the Hub. Per-box Smart Measure charges full boxes. Existing per-m² sales measuring behavior is retained. Active shopping carts follow live prices; saved quotations remain unchanged until explicitly reviewed/repriced. Custom combo deals retain their set package price.

Only published, active BusterBuild tags are shared. Products without an override keep their original catalogue price. Hiding a tag removes its live override at the next successful check. The sales app reports a warning if it cannot retrieve current prices; it retains its last successful in-session prices. Offline devices cannot receive changes until reconnected. Printed tags and already downloaded JPGs must be reprinted after a price change.

The feed address is in sales-app/hub-prices.js. If the Hub domain changes later, update HUB_PRICE_URL and redeploy the sales site.

## Verification
Production Hub build passed; 11 Hub/QR/API tests plus 5 sales sync tests passed. Checked separate brand prices, public field restrictions, unavailable-feed responses, per-box/per-m² math, product matching, invalid responses, failure preservation, active cart repricing and removal of overrides. The installer was exercised against the recovered active BusterBuild kitchen app, including JavaScript syntax checks and repeated installation. Live production connectivity and browser visual verification were not available here. Test one product on a staff phone before printing a batch.
