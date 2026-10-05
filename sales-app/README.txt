BusterBuild Sales App — Sales Account Compatibility Fix
Version 2.0.3

This fixes the screen that said:
"Could not load sales accounts — Publish the latest Firestore rules"

CAUSE
The previous fix introduced a new salesAccess collection. Your existing BusterBuild
Firebase setup was already built around salesUsers. The app therefore started asking
Firestore for a collection your current rules did not permit.

THIS VERSION REMOVES THAT EXTRA DEPENDENCY.

The Sales App now uses the original salesUsers collection again for:
- Adding salespeople
- Loading the Sales Accounts list
- Enabling / disabling staff
- Login authorisation
- Last activity
- Password reset

ACCOUNT CREATION
1. The new Firebase Authentication login is created in a secondary session.
2. Administrator remains logged in.
3. The salesperson's salesUsers profile is written by the admin.
4. If Firestore rejects the profile, the app attempts to delete the incomplete login
   so the same email can be retried.

TEST BUTTON
Manage Sales Team -> Test Firebase Access

If it says:
"Firebase access is correct. Sales accounts can now be added."
then Create Sales Account will work.

IF TEST FIREBASE ACCESS FAILS
Publish the included firestore.rules once:
Firebase Console -> Firestore Database -> Rules -> paste -> Publish

FILES TO REPLACE IN sales-app:
- index.html
- app.js
- sw.js
- app-version.json

ADD:
- app-v2-salescompat.js

The included styles.css is unchanged.

Do NOT replace:
- firebase-config.js
- manifest.webmanifest
- icons
- catalogue JSON files

IF BASANI'S EMAIL WAS ALREADY CREATED DURING A FAILED ATTEMPT
Firebase Console -> Authentication -> Users
Delete only that incomplete user once, then add Basani again in the Sales App.

Permanent URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
