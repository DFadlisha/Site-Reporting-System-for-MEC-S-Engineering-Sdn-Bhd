// src/firebase/services.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getToken } from "firebase/messaging";
import { db, auth, storage, messaging } from "./config";

// ─── AUTH ─────────────────────────────────────────────────────

/** Only emails containing "@mecs" (case-insensitive) are allowed to register. */
const ALLOWED_DOMAIN = "@mecs";

export const registerUser = async (name, email, password, role) => {
  // ── Domain constraint ──────────────────────────────────────────
  if (!email.toLowerCase().includes(ALLOWED_DOMAIN.toLowerCase())) {
    throw new Error(
      `Registration is restricted to MEC'S staff. Your email must contain "${ALLOWED_DOMAIN}" (e.g. name@mecs.com.my).`
    );
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(cred.user, { displayName: name });
    await addDoc(collection(db, "users"), {
      uid: cred.user.uid,
      name,
      email,
      role, // "consultant" | "supervisor"
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Roll back the Firebase Auth user if Firestore write fails
    await cred.user.delete();
    throw err;
  }
  return cred.user;
};

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const getUserProfile = async (uid) => {
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  return null;
};

export const requestPushPermission = async (userDocId) => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // NOTE: Replace YOUR_VAPID_KEY with a real Web push certificate key from Firebase Console -> Project Settings -> Cloud Messaging
      const token = await getToken(messaging, { vapidKey: "YOUR_VAPID_KEY" });
      if (token && userDocId) {
        // Save FCM token to user for sending notifications
        await updateDoc(doc(db, "users", userDocId), { fcmToken: token });
      }
      return token;
    }
  } catch (error) {
    console.error("Push notification error:", error);
  }
  return null;
};

// ─── PROJECTS ─────────────────────────────────────────────────

export const createProject = async (data) => {
  return addDoc(collection(db, "projects"), {
    ...data,
    status: "active",
    progress: 0,
    createdAt: serverTimestamp(),
  });
};

export const getProjects = async () => {
  const snap = await getDocs(
    query(collection(db, "projects"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateProject = async (id, data) =>
  updateDoc(doc(db, "projects", id), { ...data, updatedAt: serverTimestamp() });

export const deleteProject = async (id) => deleteDoc(doc(db, "projects", id));

export const subscribeProjects = (callback) =>
  onSnapshot(
    query(collection(db, "projects"), orderBy("createdAt", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

// ─── TASKS ────────────────────────────────────────────────────

export const createTask = async (data) =>
  addDoc(collection(db, "tasks"), {
    ...data,
    status: "todo",
    createdAt: serverTimestamp(),
  });

export const getTasks = async (projectId) => {
  const q = projectId
    ? query(collection(db, "tasks"), where("projectId", "==", projectId), orderBy("createdAt", "desc"))
    : query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateTask = async (id, data) =>
  updateDoc(doc(db, "tasks", id), { ...data, updatedAt: serverTimestamp() });

export const deleteTask = async (id) => deleteDoc(doc(db, "tasks", id));

export const subscribeTasks = (projectId, callback) => {
  const q = projectId
    ? query(collection(db, "tasks"), where("projectId", "==", projectId), orderBy("createdAt", "desc"))
    : query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
};

// ─── DAILY REPORTS ────────────────────────────────────────────

export const createReport = async (data, photoFiles = []) => {
  const photoUrls = [];
  for (const file of photoFiles) {
    const storageRef = ref(storage, `reports/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    photoUrls.push(url);
  }
  return addDoc(collection(db, "reports"), {
    ...data,
    photoUrls,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const getReports = async (projectId) => {
  const q = projectId
    ? query(collection(db, "reports"), where("projectId", "==", projectId), orderBy("createdAt", "desc"))
    : query(collection(db, "reports"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateReport = async (id, data) =>
  updateDoc(doc(db, "reports", id), { ...data, updatedAt: serverTimestamp() });

export const subscribeReports = (projectId, callback) => {
  const q = projectId
    ? query(collection(db, "reports"), where("projectId", "==", projectId), orderBy("createdAt", "desc"))
    : query(collection(db, "reports"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
};

// ─── ISSUES ───────────────────────────────────────────────────

export const createIssue = async (data) =>
  addDoc(collection(db, "issues"), {
    ...data,
    status: "open",
    createdAt: serverTimestamp(),
  });

export const getIssues = async () => {
  const snap = await getDocs(
    query(collection(db, "issues"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateIssue = async (id, data) =>
  updateDoc(doc(db, "issues", id), { ...data, updatedAt: serverTimestamp() });

export const subscribeIssues = (callback) =>
  onSnapshot(
    query(collection(db, "issues"), orderBy("createdAt", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

// ─── NOTIFICATIONS ────────────────────────────────────────────

export const createNotification = async (recipientUid, message, type = "info") =>
  addDoc(collection(db, "notifications"), {
    recipientUid,
    message,
    type,
    read: false,
    createdAt: serverTimestamp(),
  });

export const subscribeNotifications = (uid, callback) =>
  onSnapshot(
    query(
      collection(db, "notifications"),
      where("recipientUid", "==", uid),
      orderBy("createdAt", "desc")
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const markNotificationRead = async (id) =>
  updateDoc(doc(db, "notifications", id), { read: true });

// ─── UTILS: DUMMY DATA SEEDER ─────────────────────────────────

export const seedDummyData = async () => {
  // Create 3 Projects
  const p1 = await createProject({ name: "Block A Skyscraper", location: "Kuala Lumpur", status: "active", progress: 65 });
  const p2 = await createProject({ name: "Jalan 5 Highway Extension", location: "Johor Bahru", status: "active", progress: 30 });
  const p3 = await createProject({ name: "Water Pipeline Replacement", location: "Penang", status: "active", progress: 95 });

  // Create Tasks
  await createTask({ projectId: p1.id, title: "Foundation Pour", status: "done", assignedTo: "Ahmed (Supervisor)" });
  await createTask({ projectId: p1.id, title: "Level 1 Reinforcement", status: "inprogress", assignedTo: "Ahmed (Supervisor)" });
  await createTask({ projectId: p2.id, title: "Road Surveying", status: "done", assignedTo: "John (Supervisor)" });
  await createTask({ projectId: p2.id, title: "Asphalt Laying", status: "todo", assignedTo: "John (Supervisor)" });
  await createTask({ projectId: p3.id, title: "Pressure Testing", status: "inprogress", assignedTo: "Jane (Consultant)" });

  // Create Issues
  await createIssue({ projectId: p1.id, title: "Concrete delivery delayed", severity: "medium" });
  await createIssue({ projectId: p2.id, title: "Roadblock permit revoked", severity: "high" });

  // Create Reports
  await createReport({ projectId: p1.id, projectName: "Block A Skyscraper", title: "Daily Log - Foundation", date: "2026-03-31", description: "Successfully poured foundation phase 1.", workforce: "40", equipment: "3 Cranes, 5 Mixers" }, []);
};
