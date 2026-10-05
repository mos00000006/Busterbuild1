BusterBuild Sales App — PASSWORD FIX
Version 2.0.5

WHY A NEWLY ADDED SALESPERSON CAN GET "PASSWORD WRONG"

BRAND-NEW EMAIL
- Firebase creates a new login.
- The temporary password entered by the administrator is the actual password.
- It works immediately.

EMAIL ALREADY EXISTED IN FIREBASE
- Firebase does NOT overwrite the old account password with the new temporary password.
- That is why the salesperson can get "password wrong".

THIS VERSION FIXES THE WORKFLOW

If the email already exists:
- Sales access is repaired.
- The app automatically sends a Firebase password-reset email.
- The app clearly tells the administrator that the temporary password was NOT applied.
- The salesperson opens the reset email, chooses a new password, then signs in.

If the email is brand-new:
- The temporary password works immediately.

LOGIN SCREEN
The sign-in error now tells repaired users to use the password-reset email.

MANAGE SALES TEAM
The key button sends a password-reset email at any time.

FILES TO REPLACE IN sales-app:
- index.html
- app.js
- styles.css
- sw.js
- app-version.json

ADD:
- app-v2-passwordfix.js

firestore.rules is unchanged from the Login Repair package and is included again.

Do NOT replace:
- firebase-config.js
- manifest.webmanifest
- icons
- catalogue JSON files

FOR A SALESPERSON CURRENTLY GETTING "PASSWORD WRONG"
1. Upload this update.
2. Manage Sales Team -> press the KEY button next to the salesperson.
3. They open the Firebase password-reset email.
4. They choose a new password.
5. They sign in using the new password.

Permanent URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
