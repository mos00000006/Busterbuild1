BusterBuild Sales App — LOGIN REPAIR
Version 2.0.4

THIS VERSION FIXES:
A salesperson is created in Firebase Authentication but signs in and the Sales App
does not open.

HOW IT WORKS NOW

1. ADMIN APPROVES THE EMAIL
When you add a salesperson, the app creates an administrator-approved salesInvites
record for that exact email.

2. NEW ACCOUNT
If Firebase Authentication creates the user successfully, their UID salesUsers profile
is linked immediately.

3. EXISTING / FAILED ACCOUNT
If Firebase says the email already exists from an earlier failed attempt, the app does
NOT fail anymore. It keeps the approved invitation.

When that salesperson signs in:
- Firebase Authentication verifies the email/password.
- The Sales App looks for their UID salesUsers profile.
- If it is missing, it checks the administrator-approved invitation for their email.
- If approved, the app creates the missing UID profile automatically.
- The Sales App opens normally.

4. ADMIN REPAIR BUTTON
Manage Sales Team now shows a repair/spanner button.
Press it next to a salesperson and tell them to sign in again.

MANDATORY FIRESTORE STEP

Publish the included firestore.rules:

Firebase Console
-> Firestore Database
-> Rules
-> Replace the existing rules
-> Publish

Then in the Sales App:
Manage Sales Team
-> Test Firebase Access

You must see:
"Firebase access is correct. Sales logins can be created and repaired."

FOR THE SALESPERSON YOU ALREADY ADDED
1. Publish the rules.
2. Open Manage Sales Team.
3. Press the repair/spanner button next to their email.
4. Ask them to sign in again.
5. If their password is uncertain, press the key button to send a password reset.

FILES TO REPLACE IN sales-app:
- index.html
- app.js
- sw.js
- app-version.json

ADD:
- app-v2-loginrepair.js

Do NOT replace:
- firebase-config.js
- manifest.webmanifest
- icons
- catalogue JSON files

Permanent URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
