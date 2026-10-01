// BusterBuild Sales App - Firebase Authentication configuration.
// Replace the placeholder values below with your Firebase Web App config.
// Firebase Console > Project settings > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_FIREBASE_APP_ID"
};

export const salesAppConfig = {
  departmentName: "Tiles & Sanitary Ware",
  storeName: "BusterBuild Hardware",
  // When true, the sales app will not open without a valid Firebase login.
  authRequired: true,
  // GitHub Pages base is detected automatically; leave blank unless you move the app.
  qrBaseUrl: ""
};
