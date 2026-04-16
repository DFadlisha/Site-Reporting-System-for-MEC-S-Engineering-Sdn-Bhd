// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCy6ear6KhfpeP-EZkgfTD0acmV2xYgpLs",
  authDomain: "sprs-82929.firebaseapp.com",
  projectId: "sprs-82929",
  storageBucket: "sprs-82929.firebasestorage.app",
  messagingSenderId: "945845998606",
  appId: "1:945845998606:web:940ee71d0ed42125c0185f",
  measurementId: "G-BLBRX9JBKR",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Messaging only works in supported browsers (requires HTTPS + service worker)
let messaging = null;
isSupported().then((supported) => {
  if (supported) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("Firebase Messaging initialization failed:", e);
    }
  } else {
    console.warn("Firebase Messaging not supported in this environment. (Often caused by using HTTP instead of secure HTTPS/Localhost)");
  }
}).catch((err) => {
  console.warn("Firebase Messaging support check failed:", err);
});

export { messaging };

export default app;
