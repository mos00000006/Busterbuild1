BUSTERBUILD SALES APP — FINAL INSTALL / REPLACEMENT PACK
Version 2.0.5

PART 1 — GITHUB

Open:
Busterbuild1 / sales-app

Replace / upload EVERYTHING inside the included:
sales-app/

That folder contains:
- index.html
- app.js
- app-v2-passwordfix.js
- styles.css
- sw.js
- app-version.json

DO NOT DELETE OR REPLACE your existing:
- firebase-config.js
- manifest.webmanifest
- icons/
- data/ catalogue files
- sanitary-products.json
- pulse-tile-catalogue.json
- pulse-combo-catalogue.json

Your permanent app address stays:
https://mos00000006.github.io/Busterbuild1/sales-app/


PART 2 — FIREBASE RULES

Open:
Firebase Console
-> BusterBuild Sales App
-> Firestore
-> Rules

Open:
FIREBASE/firestore.rules

Copy ONLY the contents of firestore.rules into the Firebase Rules editor.
The first line must be:
rules_version = '2';

Then click:
PUBLISH

Do NOT paste this README into Firebase Rules.


PART 3 — TEST

After GitHub Pages deploys:

1. Fully close the installed BusterBuild Sales App.
2. Open the normal URL in Chrome/Safari once.
3. Sign in as Administrator.
4. Open Manage Sales Team.
5. Press Test Firebase Access.
6. It should confirm Firebase access is correct.
7. For an existing salesperson, use the spanner/repair button if shown.
8. If their password is uncertain, use the key button to send a password-reset email.
9. Have the salesperson close and reopen the app, then sign in.

IMPORTANT PASSWORD BEHAVIOUR

Brand-new email:
- Temporary password entered by Admin works immediately.

Email already existed in Firebase:
- Firebase does not replace the old password with the new temporary password.
- The app sends / supports a password reset instead.
- Salesperson must sign in with the password they set from the reset email.


NETWORK ERROR

If a salesperson sees:
auth/network-request-failed

that is a device/network connection problem to Firebase Authentication, not Firestore Rules.
Test the same login in Chrome/Safari using mobile data.
