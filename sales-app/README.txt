BusterBuild Firebase Login Access Fix

The message "Account access could not be verified" means:

- Firebase Authentication accepted the salesperson's email/password.
- The Sales App then tried to read their Firestore access profile.
- Firestore blocked that read.

This is a FIREBASE RULES issue, not a password issue.

IMPORTANT:
Uploading firestore.rules to GitHub does NOT activate Firebase rules.

YOU MUST DO THIS ONCE:

1. Open Firebase Console.
2. Open project: busterbuild-sales-app.
3. Go to Firestore Database.
4. Click Rules.
5. Delete the existing rules.
6. Paste the complete contents of the supplied firestore.rules.
7. Click PUBLISH.

Then:

8. Return to BusterBuild Sales.
9. Sign in as Administrator.
10. Manage Sales Team -> Test Firebase Access.
11. It must say Firebase access is correct.
12. Press the repair/spanner icon beside the salesperson once.
13. Ask the salesperson to close the app completely and sign in again.

The important rule now permits:
- Administrator to manage all Sales App profiles.
- A salesperson to read only their own salesUsers profile.
- A previously incomplete salesperson to self-link only when their exact email has
  an administrator-approved salesInvites record.

Administrator:
moyanamoses006@icloud.com
