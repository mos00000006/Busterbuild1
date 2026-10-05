BusterBuild Sales App — Sales Account Creation Fix
Version 2.0.2

THIS FIX CHANGES THE ACCOUNT CREATION FLOW

OLD PROBLEM:
Firebase Authentication could create the new email first, then Firestore could block
the sales profile. This left a half-created login and the salesperson could not use
the Sales App.

NEW FLOW:
1. Admin Sales Access is written to Firestore FIRST.
2. If Firestore permissions are wrong, the process stops BEFORE creating an Auth login.
3. Firebase Authentication login is then created.
4. The UID sales profile is linked.
5. If the email already exists from an earlier failed attempt, the Sales App repairs
   access instead of failing with "email already in use".
6. On that salesperson's next login, their UID profile is linked automatically.

NEW BUTTON:
Manage Sales Team -> Test Firebase Access

Click this first. It should say:
"Firebase access is correct. You can create sales accounts."

IMPORTANT — PUBLISH FIRESTORE RULES:
Firebase Console
-> Firestore Database
-> Rules
-> Replace with the included firestore.rules
-> Publish

ADMIN EMAIL:
moyanamoses006@icloud.com

FILES TO UPLOAD TO:
Busterbuild1/sales-app/

REPLACE:
- index.html
- app.js
- sw.js
- app-version.json

ADD:
- app-v2-usersfix.js

styles.css is included unchanged for completeness.

DO NOT REPLACE:
- firebase-config.js
- manifest.webmanifest
- icons
- catalogue JSON files

EXISTING FAILED EMAILS:
You should no longer need to delete them from Firebase Authentication.
Create the salesperson again in Manage Sales Team using the same email.
The app will say the existing login was repaired.
They can use their existing password or you can press the key icon to send a password reset.

PERMANENT URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
