BusterBuild Sales App — STAFF SIGN-IN GATE
Version 2.0.8

This update is for salespeople who are ALREADY registered.

NEW BEHAVIOUR
- Welcome motion plays.
- Then the salesperson sees the Sign In screen.
- A previously registered user is NOT taken straight into the app on a new app session.
- Their email can be remembered/prefilled.
- They must enter their password to start the new sales session.
- Refreshing the page during the same session does not unnecessarily log them out.
- Closing the app/browser session and starting a new session requires Sign In again.
- Customer product QR links remain public and do not require staff login.

LOGIN IMPROVEMENTS
- "Already registered? Sign in" message.
- Show/hide password button.
- Forgot Password button.
- Password reset can be sent directly from the login screen.
- Logout clears the current staff session.

IMPORTANT
This is SIGN IN, not public SIGN UP.
Only accounts created/approved by the BusterBuild administrator can enter the Sales App.

FILES TO REPLACE:
- index.html
- app.js
- styles.css
- sw.js
- app-version.json

ADD:
- app-v2-signingate.js

firestore.rules is unchanged and included for convenience.

DO NOT REPLACE:
- firebase-config.js
- manifest.webmanifest
- icons/
- catalogue JSON files

Permanent URL:
https://mos00000006.github.io/Busterbuild1/sales-app/
