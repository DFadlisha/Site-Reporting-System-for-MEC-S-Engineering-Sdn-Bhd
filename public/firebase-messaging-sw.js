// public/firebase-messaging-sw.js
// This creates a dedicated background service worker exclusively for Firebase Cloud Messaging
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Initialize Firebase app in the service worker with your real config
firebase.initializeApp({
  apiKey: "AIzaSyCy6ear6KhfpeP-EZkgfTD0acmV2xYgpLs",
  authDomain: "sprs-82929.firebaseapp.com",
  projectId: "sprs-82929",
  storageBucket: "sprs-82929.firebasestorage.app",
  messagingSenderId: "945845998606",
  appId: "1:945845998606:web:940ee71d0ed42125c0185f"
});

const messaging = firebase.messaging();

// Handle incoming background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log("Received background push notification:", payload);
  
  const notificationTitle = payload.notification?.title || "New SPRS Alert";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new update in the system.",
    icon: "/favicon.ico",
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
