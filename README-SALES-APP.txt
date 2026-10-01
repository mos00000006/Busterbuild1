BUSTERBUILD TILES & SANITARY WARE SALES APP
==========================================

WHAT THIS ADDS
- Installable phone PWA at: /sales-app/
- Email/password login for sales staff using Firebase Authentication.
- The app only shows Tiles, Sanitary Ware and Combo Deals.
- Product search by name/code.
- Camera QR scanner.
- Product details: picture, code, price and specifications.
- BusterBuild Smart Measure for tile products that have m²-per-box data.
- Combo deals and sanitary products do NOT show Smart Measure; they show quantity, price and Add to Cart.
- Separate sales cart stored on the salesperson's phone.
- Printable QR labels at: /sales-app/qr/
- QR labels are rebuilt from the catalogue by GitHub Actions.

IMPORTANT: REAL ACCOUNT SECURITY
GitHub Pages is static hosting, so do not put usernames/passwords in HTML or JavaScript.
This package uses Firebase Authentication for proper account login.

FIREBASE SETUP (ONCE)
1. Go to Firebase Console and create a project for BusterBuild Sales.
2. Authentication > Sign-in method > enable Email/Password.
3. Project Settings > Your Apps > add a Web app.
4. Copy the Web App config into: sales-app/firebase-config.js
5. Authentication > Settings > Authorized domains > add: mos00000006.github.io
6. Authentication > Users > Add user for each Tiles & Sanitary salesperson.
   Create only staff who should have access to this sales app.

INSTALL ON SALESPEOPLE'S PHONES
Android / Chrome:
- Open https://mos00000006.github.io/Busterbuild1/sales-app/
- Sign in.
- Tap Install App / Add to Home Screen.

iPhone / Safari:
- Open the same URL.
- Share button > Add to Home Screen.

QR LABELS
- GitHub Action name: Build sales app QR labels
- It runs after the tile/combo catalogue workflows, and can also be run manually.
- Printable label page: https://mos00000006.github.io/Busterbuild1/sales-app/qr/
- Each QR opens the sales app directly on the matching product.

CAMERA
The scanner needs HTTPS and camera permission. GitHub Pages already uses HTTPS.
