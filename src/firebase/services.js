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
  sendPasswordResetEmail,
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
      password, // Save password so admin can view it
      role, // "consultant" | "supervisor" | "admin"
      status: role === "admin" ? "approved" : "pending", 
      createdAt: serverTimestamp(),
    });

    // ── Notify all admins about new pending registration ───────────
    if (role !== "admin") {
      const adminSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "admin"))
      );
      const roleLabel = role === "supervisor" ? "Site Supervisor" : "Consultant";
      const notifPromises = adminSnap.docs.map((adminDoc) =>
        addDoc(collection(db, "notifications"), {
          recipientUid: adminDoc.data().uid,
          message: `New ${roleLabel} registration pending approval: ${name} (${email}). Please review in User Management.`,
          type: "warning",
          link: "/users", // Link to User Management
          read: false,
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(notifPromises);
    }
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
  if (!snap.empty) {
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...data, status: data.status || "approved" };
  }
  return null;
};

export const getSystemUsers = async () => {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, status: data.status || "approved" };
  });
};

export const subscribeSystemUsers = (callback) =>
  onSnapshot(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
    (snap) => callback(snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, status: data.status || "approved" };
    }))
  );

export const updateUserStatus = async (id, data) =>
  updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });

export const approveUser = async (id) => {
  // Get the user document to retrieve their uid for notification
  const userSnap = await getDoc(doc(db, "users", id));
  if (userSnap.exists()) {
    const userData = userSnap.data();
    // Update status to approved
    await updateDoc(doc(db, "users", id), { status: "approved", updatedAt: serverTimestamp() });
    // Notify the user that their account has been approved
    await addDoc(collection(db, "notifications"), {
      recipientUid: userData.uid,
      message: `🎉 Your account has been approved! You can now log in to SPRS as ${userData.role === "supervisor" ? "Site Supervisor" : "Consultant"}.`,
      type: "success",
      link: "/dashboard",
      read: false,
      createdAt: serverTimestamp(),
    });
  } else {
    await updateDoc(doc(db, "users", id), { status: "approved", updatedAt: serverTimestamp() });
  }
};

export const requestPushPermission = async (userDocId) => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const vapidKey = process.env.REACT_APP_VAPID_KEY || "BKGJsxAOoYnNWcTuk3yplrH7YttR8Z73GdxSZQ83JXMAK0zx9mZADhUvmdHhoDUNeGS7Ka0ggn6taio5PQZAa_c";
      const token = await getToken(messaging, { vapidKey });


      if (token && userDocId) {
        try {
          // Save FCM token to user for sending notifications
          await updateDoc(doc(db, "users", userDocId), { fcmToken: token });
        } catch (dbErr) {
          console.warn("Could not save FCM token to user document (possibly due to Firestore rules), but token generated successfully.");
        }
      }
      return token;
    }
  } catch (error) {
    console.error("Push notification error:", error);
  }
  return null;
};

// ─── PROJECTS ─────────────────────────────────────────────────

export const createProject = async (data, createdByUid = null) => {
  return addDoc(collection(db, "projects"), {
    ...data,
    status: "active",
    progress: 0,
    createdByUid: createdByUid || null,
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

/**
 * Subscribe to projects scoped by user role:
 * - Consultant: only projects they created
 * - Supervisor: only projects they are assigned to (where supervisorUid == uid)
 * - Admin: all projects
 */
export const subscribeUserProjects = (uid, role, callback) => {
  if (role === "consultant") {
    return onSnapshot(
      query(collection(db, "projects"), where("createdByUid", "==", uid), orderBy("createdAt", "desc")),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }
  if (role === "supervisor") {
    return onSnapshot(
      query(collection(db, "projects"), where("supervisorUid", "==", uid), orderBy("createdAt", "desc")),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }
  // Admin sees all projects
  return subscribeProjects(callback);
};

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

export const createIssue = async (data, photoFile = null) => {
  let photoUrl = null;
  if (photoFile) {
    const storageRef = ref(storage, `issues/${Date.now()}_${photoFile.name}`);
    await uploadBytes(storageRef, photoFile);
    photoUrl = await getDownloadURL(storageRef);
  }
  return addDoc(collection(db, "issues"), {
    ...data,
    photoUrl,
    status: "open",
    createdAt: serverTimestamp(),
  });
};

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

export const createNotification = async (recipientUid, message, type = "info", link = null) =>
  addDoc(collection(db, "notifications"), {
    recipientUid,
    message,
    type,
    link: link || null,
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

export const resetUserPassword = async (email) => {
  await sendPasswordResetEmail(auth, email);
};

// ─── ADMIN: USER ACTIONS ──────────────────────────────────────

export const rejectUser = async (id, reason) => {
  const userSnap = await getDoc(doc(db, "users", id));
  if (userSnap.exists()) {
    const userData = userSnap.data();
    await updateDoc(doc(db, "users", id), {
      status: "rejected",
      rejectionReason: reason,
      updatedAt: serverTimestamp(),
    });
    if (userData.uid) {
      await addDoc(collection(db, "notifications"), {
        recipientUid: userData.uid,
        message: `❌ Your registration has been rejected. Reason: "${reason}". Please contact the administrator for further assistance.`,
        type: "error",
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  }
};

export const deactivateUser = async (id, reactivate = false) => {
  await updateDoc(doc(db, "users", id), {
    status: reactivate ? "approved" : "deactivated",
    updatedAt: serverTimestamp(),
  });
};

export const deleteUserDoc = async (id) => {
  await deleteDoc(doc(db, "users", id));
};

export const updateUserDetails = async (id, data) => {
  await updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });
};

export const broadcastNotification = async (message, targetRole = null) => {
  const q = targetRole
    ? query(collection(db, "users"), where("role", "==", targetRole), where("status", "==", "approved"))
    : query(collection(db, "users"), where("status", "==", "approved"));
  const snap = await getDocs(q);
  const promises = snap.docs
    .map((d) => d.data())
    .filter((u) => u.uid)
    .map((u) =>
      addDoc(collection(db, "notifications"), {
        recipientUid: u.uid,
        message,
        type: "info",
        read: false,
        isAnnouncement: true,
        createdAt: serverTimestamp(),
      })
    );
  await Promise.all(promises);
  await addDoc(collection(db, "audit_logs"), {
    action: "ANNOUNCEMENT_SENT",
    entityType: "SYSTEM",
    userId: "ADMIN",
    changes: { message, targetRole: targetRole || "all", recipientCount: snap.docs.length },
    timestamp: serverTimestamp(),
  });
  return snap.docs.length;
};

export const subscribeAuditLogs = (callback) =>
  onSnapshot(
    query(collection(db, "audit_logs"), orderBy("timestamp", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const subscribeCustomMaterials = (callback) =>
  onSnapshot(collection(db, "custom_materials"), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const subscribeCustomEquipment = (callback) =>
  onSnapshot(collection(db, "custom_equipment"), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const addCustomMaterialIfNew = async (name) => {
  const normalized = name.trim();
  if (!normalized) return;
  const q = query(
    collection(db, "custom_materials"),
    where("nameLower", "==", normalized.toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(collection(db, "custom_materials"), {
      name: normalized,
      nameLower: normalized.toLowerCase(),
      createdAt: serverTimestamp(),
    });
  }
};

export const addCustomEquipmentIfNew = async (name) => {
  const normalized = name.trim();
  if (!normalized) return;
  const q = query(
    collection(db, "custom_equipment"),
    where("nameLower", "==", normalized.toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(collection(db, "custom_equipment"), {
      name: normalized,
      nameLower: normalized.toLowerCase(),
      createdAt: serverTimestamp(),
    });
  }
};



