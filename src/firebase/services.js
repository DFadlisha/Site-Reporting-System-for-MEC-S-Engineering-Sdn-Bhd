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
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  return null;
};

export const getSystemUsers = async () => {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeSystemUsers = (callback) =>
  onSnapshot(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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
  // ── 5 Completed Projects ────────────────────────────────────────
  const p1 = await addDoc(collection(db, "projects"), {
    name: "Block A Skyscraper", location: "Kuala Lumpur",
    status: "completed", progress: 100,
    startDate: "2025-09-01", endDate: "2026-03-31",
    priority: "high", description: "Construction of a 32-storey commercial tower in the KL CBD.",
    createdAt: serverTimestamp(),
  });
  const p2 = await addDoc(collection(db, "projects"), {
    name: "Jalan 5 Highway Extension", location: "Johor Bahru",
    status: "completed", progress: 100,
    startDate: "2025-10-01", endDate: "2026-04-15",
    priority: "high", description: "14km dual-carriageway highway expansion linking Johor Bahru to Kulai.",
    createdAt: serverTimestamp(),
  });
  const p3 = await addDoc(collection(db, "projects"), {
    name: "Water Pipeline Replacement", location: "Penang",
    status: "completed", progress: 100,
    startDate: "2025-11-01", endDate: "2026-02-28",
    priority: "medium", description: "Replacement of 8.4km of aging cast-iron water mains in Georgetown.",
    createdAt: serverTimestamp(),
  });
  const p4 = await addDoc(collection(db, "projects"), {
    name: "Substation Upgrade – TNB Grid", location: "Shah Alam",
    status: "completed", progress: 100,
    startDate: "2025-08-15", endDate: "2026-01-31",
    priority: "high", description: "Upgrading 132kV electrical substation equipment for increased load capacity.",
    createdAt: serverTimestamp(),
  });
  const p5 = await addDoc(collection(db, "projects"), {
    name: "Rawang Flood Mitigation Canal", location: "Rawang, Selangor",
    status: "active", progress: 78,
    startDate: "2026-01-10", endDate: "2026-07-30",
    priority: "medium", description: "Construction of a 2.1km diversion canal to reduce flood risk in Rawang township.",
    createdAt: serverTimestamp(),
  });

  // ── TASKS — Project 1: Block A Skyscraper ──────────────────────
  const t1Tasks = [
    { title: "Site Clearing & Grubbing", assignedTo: "Ahmad Fadzil", site: "Block A, Level GF", dueDate: "2025-10-15", priority: "high", status: "done", completedAt: "2025-10-14" },
    { title: "Piling Works (Bored Pile)", assignedTo: "Ahmad Fadzil", site: "Block A, Foundation", dueDate: "2025-11-01", priority: "high", status: "done", completedAt: "2025-10-30" },
    { title: "Foundation Raft Pour", assignedTo: "Ravi Kumar", site: "Block A, B2 Level", dueDate: "2025-11-20", priority: "high", status: "done", completedAt: "2025-11-18" },
    { title: "Ground Floor RC Works", assignedTo: "Ravi Kumar", site: "Block A, GF", dueDate: "2025-12-10", priority: "high", status: "done", completedAt: "2025-12-08" },
    { title: "Levels 1–10 Structural Frame", assignedTo: "Ahmad Fadzil", site: "Block A, L1–L10", dueDate: "2026-01-15", priority: "high", status: "done", completedAt: "2026-01-12" },
    { title: "Levels 11–20 Structural Frame", assignedTo: "Ravi Kumar", site: "Block A, L11–L20", dueDate: "2026-02-10", priority: "high", status: "done", completedAt: "2026-02-09" },
    { title: "MEP Rough-in (Electrical)", assignedTo: "Ahmad Fadzil", site: "Block A, All Levels", dueDate: "2026-02-28", priority: "medium", status: "done", completedAt: "2026-02-26" },
    { title: "External Façade Cladding", assignedTo: "Ravi Kumar", site: "Block A, Exterior", dueDate: "2026-03-15", priority: "medium", status: "done", completedAt: "2026-03-14" },
    { title: "Final Inspection & Handover", assignedTo: "Ahmad Fadzil", site: "Block A, All", dueDate: "2026-03-31", priority: "high", status: "done", completedAt: "2026-03-29" },
  ];
  for (const t of t1Tasks) {
    await addDoc(collection(db, "tasks"), { ...t, projectId: p1.id, projectName: "Block A Skyscraper", createdAt: serverTimestamp() });
  }

  // ── TASKS — Project 2: Highway Extension ──────────────────────
  const t2Tasks = [
    { title: "Topographic Survey", assignedTo: "Lee Chong Wei", site: "JB–Kulai Corridor", dueDate: "2025-10-20", priority: "high", status: "done", completedAt: "2025-10-19" },
    { title: "Earthworks & Subgrade Prep", assignedTo: "Mohd Hafiz", site: "Km 0 – Km 6", dueDate: "2025-11-25", priority: "high", status: "done", completedAt: "2025-11-24" },
    { title: "Sub-base & Base Course Laying", assignedTo: "Lee Chong Wei", site: "Km 6 – Km 14", dueDate: "2025-12-20", priority: "high", status: "done", completedAt: "2025-12-18" },
    { title: "Asphalt Wearing Course", assignedTo: "Mohd Hafiz", site: "Km 0 – Km 14", dueDate: "2026-01-30", priority: "high", status: "done", completedAt: "2026-01-28" },
    { title: "Road Marking & Signage", assignedTo: "Lee Chong Wei", site: "Full Corridor", dueDate: "2026-02-28", priority: "medium", status: "done", completedAt: "2026-02-27" },
    { title: "Drainage & Culverts", assignedTo: "Mohd Hafiz", site: "Full Corridor", dueDate: "2026-03-20", priority: "medium", status: "done", completedAt: "2026-03-18" },
    { title: "Final Road Inspection", assignedTo: "Lee Chong Wei", site: "Full Corridor", dueDate: "2026-04-15", priority: "high", status: "done", completedAt: "2026-04-13" },
  ];
  for (const t of t2Tasks) {
    await addDoc(collection(db, "tasks"), { ...t, projectId: p2.id, projectName: "Jalan 5 Highway Extension", createdAt: serverTimestamp() });
  }

  // ── TASKS — Project 3: Water Pipeline ──────────────────────────
  const t3Tasks = [
    { title: "Route Survey & Soil Investigation", assignedTo: "Siti Norsyafiqah", site: "Georgetown Zone A", dueDate: "2025-11-15", priority: "medium", status: "done", completedAt: "2025-11-14" },
    { title: "Trench Excavation (Phase 1)", assignedTo: "Karim Abdullah", site: "Georgetown Zone B", dueDate: "2025-12-01", priority: "high", status: "done", completedAt: "2025-11-30" },
    { title: "Pipe Installation & Jointing", assignedTo: "Siti Norsyafiqah", site: "Georgetown Zone B", dueDate: "2025-12-30", priority: "high", status: "done", completedAt: "2025-12-28" },
    { title: "Pressure Testing & Flushing", assignedTo: "Karim Abdullah", site: "Full Route", dueDate: "2026-01-25", priority: "high", status: "done", completedAt: "2026-01-23" },
    { title: "Backfilling & Reinstatement", assignedTo: "Siti Norsyafiqah", site: "Full Route", dueDate: "2026-02-20", priority: "medium", status: "done", completedAt: "2026-02-18" },
    { title: "Commissioning & Handover to Air Penang", assignedTo: "Karim Abdullah", site: "Pump Station", dueDate: "2026-02-28", priority: "high", status: "done", completedAt: "2026-02-27" },
  ];
  for (const t of t3Tasks) {
    await addDoc(collection(db, "tasks"), { ...t, projectId: p3.id, projectName: "Water Pipeline Replacement", createdAt: serverTimestamp() });
  }

  // ── TASKS — Project 4: Substation Upgrade ──────────────────────
  const t4Tasks = [
    { title: "Site Preparation & Fencing", assignedTo: "Azwan Ismail", site: "Shah Alam Grid", dueDate: "2025-09-15", priority: "medium", status: "done", completedAt: "2025-09-14" },
    { title: "Old Equipment Decommission", assignedTo: "Nurul Ain", site: "Substation Bay 3", dueDate: "2025-10-10", priority: "high", status: "done", completedAt: "2025-10-09" },
    { title: "New Transformer Installation", assignedTo: "Azwan Ismail", site: "Substation Bay 3", dueDate: "2025-11-15", priority: "high", status: "done", completedAt: "2025-11-13" },
    { title: "HV Cable Termination & Testing", assignedTo: "Nurul Ain", site: "Substation Bay 3", dueDate: "2025-12-10", priority: "high", status: "done", completedAt: "2025-12-08" },
    { title: "SCADA System Integration", assignedTo: "Azwan Ismail", site: "Control Room", dueDate: "2026-01-10", priority: "medium", status: "done", completedAt: "2026-01-08" },
    { title: "Load Testing & Energisation", assignedTo: "Nurul Ain", site: "Full Substation", dueDate: "2026-01-31", priority: "high", status: "done", completedAt: "2026-01-30" },
  ];
  for (const t of t4Tasks) {
    await addDoc(collection(db, "tasks"), { ...t, projectId: p4.id, projectName: "Substation Upgrade – TNB Grid", createdAt: serverTimestamp() });
  }

  // ── TASKS — Project 5: Rawang Canal (Active, 78%) ──────────────
  const t5Tasks = [
    { title: "Environmental Impact Assessment", assignedTo: "Faridah Osman", site: "Rawang Township", dueDate: "2026-02-01", priority: "medium", status: "done", completedAt: "2026-01-30" },
    { title: "Canal Excavation Phase 1 (0–700m)", assignedTo: "Faridah Osman", site: "Canal Km 0–0.7", dueDate: "2026-03-15", priority: "high", status: "done", completedAt: "2026-03-14" },
    { title: "Concrete Lining Phase 1", assignedTo: "Zulkifli Hamdan", site: "Canal Km 0–0.7", dueDate: "2026-04-10", priority: "high", status: "done", completedAt: "2026-04-09" },
    { title: "Canal Excavation Phase 2 (700m–1.4km)", assignedTo: "Zulkifli Hamdan", site: "Canal Km 0.7–1.4", dueDate: "2026-05-20", priority: "high", status: "inprogress" },
    { title: "Concrete Lining Phase 2", assignedTo: "Faridah Osman", site: "Canal Km 0.7–1.4", dueDate: "2026-06-20", priority: "high", status: "todo" },
    { title: "Canal Excavation Phase 3 (1.4–2.1km)", assignedTo: "Zulkifli Hamdan", site: "Canal Km 1.4–2.1", dueDate: "2026-07-15", priority: "medium", status: "todo" },
    { title: "Final Concrete Lining & Commissioning", assignedTo: "Faridah Osman", site: "Full Canal", dueDate: "2026-07-30", priority: "high", status: "todo" },
  ];
  for (const t of t5Tasks) {
    await addDoc(collection(db, "tasks"), { ...t, projectId: p5.id, projectName: "Rawang Flood Mitigation Canal", createdAt: serverTimestamp() });
  }

  // ── DAILY REPORTS — All Approved ──────────────────────────────
  const reports = [
    // Project 1
    { projectId: p1.id, projectName: "Block A Skyscraper", title: "Foundation Raft Pour – Day 1", date: "2025-11-10", submittedBy: "Ahmad Fadzil", weather: "Sunny", workforce: "52", equipment: "4 Concrete Pumps, 2 Cranes", materials: "1200 m³ Ready-Mix Concrete", description: "Commenced raft foundation pour at 07:00. All mix designs verified by QA. No incidents.", issues: "", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Good work, proceed as planned." },
    { projectId: p1.id, projectName: "Block A Skyscraper", title: "Level 5 RC Slab Pour", date: "2026-01-05", submittedBy: "Ravi Kumar", weather: "Partly Cloudy", workforce: "38", equipment: "2 Tower Cranes, 1 Concrete Pump", materials: "320 m³ Ready-Mix C35", description: "L5 slab poured successfully. Post-pour curing initiated. Core samples taken.", issues: "", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Curing records to be submitted by end of week." },
    { projectId: p1.id, projectName: "Block A Skyscraper", title: "Façade Cladding Progress Report", date: "2026-03-10", submittedBy: "Ahmad Fadzil", weather: "Cloudy", workforce: "44", equipment: "Spider Platform, 3 Gondolas", materials: "Aluminium Composite Panels", description: "Completed cladding on north and east elevations. South elevation 70% done.", issues: "Wind speed exceeded 40km/h at 14:00, halted gondola works for 2 hours.", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Safety call was correct. Resume when wind clears." },

    // Project 2
    { projectId: p2.id, projectName: "Jalan 5 Highway Extension", title: "Earthworks Daily Report – Km 0 to Km 3", date: "2025-11-08", submittedBy: "Lee Chong Wei", weather: "Sunny", workforce: "60", equipment: "5 Excavators, 8 Dump Trucks, 2 Rollers", materials: "None (cut-fill)", description: "Cut volume of 3,200 m³ achieved. Embankment compaction at Km 1.5 completed and tested.", issues: "", status: "approved", reviewedBy: "Consultant Haziq", reviewComment: "Compaction test results satisfactory. Good progress." },
    { projectId: p2.id, projectName: "Jalan 5 Highway Extension", title: "Asphalt Paving Report – Km 7 to Km 10", date: "2026-01-15", submittedBy: "Mohd Hafiz", weather: "Sunny", workforce: "45", equipment: "2 Pavers, 4 Rollers, 5 Tipper Lorries", materials: "480 tonnes AC14 Wearing Course", description: "Paved 3km stretch. Hot-mix temperature maintained at 145°C throughout. IRI testing passed.", issues: "", status: "approved", reviewedBy: "Consultant Haziq", reviewComment: "Excellent IRI results. Proceed to Km 10–14." },

    // Project 3
    { projectId: p3.id, projectName: "Water Pipeline Replacement", title: "Pipe Installation – Zone B Section 1", date: "2025-12-10", submittedBy: "Siti Norsyafiqah", weather: "Cloudy", workforce: "28", equipment: "2 Excavators, 1 Mobile Crane, 2 Welding Sets", materials: "DN500 HDPE Pipe – 200m installed", description: "Pipe joints butt-fused and inspected. 200m installed and bedded. Traffic management active on Jalan Burma.", issues: "Minor bedding material shortage resolved by noon delivery.", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Fusion test records sighted and approved." },
    { projectId: p3.id, projectName: "Water Pipeline Replacement", title: "Pressure Testing Report", date: "2026-01-20", submittedBy: "Karim Abdullah", weather: "Partly Cloudy", workforce: "18", equipment: "Pressure Test Pump, Data Logger", materials: "None", description: "Hydrostatic pressure test conducted at 1.5x working pressure (12 bar) for 4 hours. Zero leakage detected.", issues: "", status: "approved", reviewedBy: "Consultant Haziq", reviewComment: "Test witnessed and passed. Approve for backfill." },

    // Project 4
    { projectId: p4.id, projectName: "Substation Upgrade – TNB Grid", title: "Transformer Installation Day 1", date: "2025-11-01", submittedBy: "Azwan Ismail", weather: "Sunny", workforce: "20", equipment: "200T Mobile Crane, 2 Utility Vehicles", materials: "132/11kV Power Transformer (80MVA)", description: "Transformer delivered and positioned on plinth. Alignment checked. Oil sampling completed.", issues: "", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Oil sampling report to be shared with TNB QA." },
    { projectId: p4.id, projectName: "Substation Upgrade – TNB Grid", title: "Load Testing Report", date: "2026-01-28", submittedBy: "Nurul Ain", weather: "Sunny", workforce: "15", equipment: "Load Bank, Thermal Cameras", materials: "None", description: "Full load test at 80MVA completed. No thermal anomalies detected. Protection relay settings verified.", issues: "", status: "approved", reviewedBy: "Consultant Haziq", reviewComment: "All test parameters within TNB Grid Code. Approved for energisation." },

    // Project 5
    { projectId: p5.id, projectName: "Rawang Flood Mitigation Canal", title: "Excavation Phase 1 – Day 5 Report", date: "2026-02-20", submittedBy: "Faridah Osman", weather: "Partly Cloudy", workforce: "32", equipment: "3 Excavators, 5 Dump Trucks", materials: "None (excavation)", description: "Excavation complete from Ch. 0 to Ch. 350m. Formation level checked and accepted by SO.", issues: "", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Formation level satisfactory. Proceed to lining." },
    { projectId: p5.id, projectName: "Rawang Flood Mitigation Canal", title: "Concrete Lining Phase 1 Report", date: "2026-04-05", submittedBy: "Zulkifli Hamdan", weather: "Sunny", workforce: "38", equipment: "Slip Form Paver, Concrete Pump", materials: "C30 Concrete – 420 m³", description: "Lining completed at Ch. 0–700m. Surface finish and thickness verified by QC. Curing membrane applied.", issues: "Minor surface cracking at Ch. 450m repaired same day.", status: "approved", reviewedBy: "Consultant Lim", reviewComment: "Repair method approved. Continue Phase 2 works." },
    { projectId: p5.id, projectName: "Rawang Flood Mitigation Canal", title: "Excavation Phase 2 – Progress Update", date: "2026-04-22", submittedBy: "Zulkifli Hamdan", weather: "Rainy", workforce: "26", equipment: "2 Excavators, 4 Dump Trucks", materials: "None", description: "Excavation at Ch. 700–950m completed. Rain halted works at 14:30. Pumping out standing water.", issues: "Heavy rainfall slowed progress by ~30%. Pumping ongoing.", status: "pending", reviewedBy: "", reviewComment: "" },
  ];

  for (const r of reports) {
    await addDoc(collection(db, "reports"), { ...r, photoUrls: [], createdAt: serverTimestamp() });
  }

  // ── ISSUES — Mix of Resolved & Open ───────────────────────────
  const issues = [
    { projectId: p1.id, title: "Concrete delivery delay – raft pour", severity: "high", status: "resolved", description: "Ready-mix truck delayed by 2 hours due to traffic. Adjusted pour sequence to avoid cold joint.", resolvedBy: "Ahmad Fadzil", resolvedAt: "2025-11-11" },
    { projectId: p1.id, title: "Rebar congestion at pile cap junction", severity: "medium", status: "resolved", description: "Rebar too congested for vibrator access. Adjusted spacing per SE instruction.", resolvedBy: "Ravi Kumar", resolvedAt: "2025-12-01" },
    { projectId: p2.id, title: "Roadblock permit revoked by MBJB", severity: "high", status: "resolved", description: "Permit revoked due to Hari Raya restriction. Works paused for 5 days and rescheduled.", resolvedBy: "Lee Chong Wei", resolvedAt: "2026-01-05" },
    { projectId: p2.id, title: "Premix temperature below spec on delivery", severity: "medium", status: "resolved", description: "Batch rejected and supplier penalised. Replacement batch arrived within 3 hours.", resolvedBy: "Mohd Hafiz", resolvedAt: "2026-01-16" },
    { projectId: p3.id, title: "Groundwater inflow during excavation", severity: "high", status: "resolved", description: "Unexpected groundwater at 1.8m depth. Wellpoint dewatering deployed.", resolvedBy: "Karim Abdullah", resolvedAt: "2025-12-05" },
    { projectId: p4.id, title: "Transformer oil leakage during positioning", severity: "high", status: "resolved", description: "Minor seepage at gasket during installation. Gasket replaced and pressure tested. No further leakage.", resolvedBy: "Azwan Ismail", resolvedAt: "2025-11-04" },
    { projectId: p5.id, title: "Heavy rainfall flooding excavation trench", severity: "high", status: "open", description: "Persistent rain causing water accumulation in Phase 2 trench. Pumping ongoing. Work halted.", resolvedBy: "", resolvedAt: "" },
    { projectId: p5.id, title: "Slip-form paver breakdown", severity: "medium", status: "open", description: "Paver hydraulic system failure. Spare parts ordered, ETA 5 days.", resolvedBy: "", resolvedAt: "" },
  ];

  for (const issue of issues) {
    await addDoc(collection(db, "issues"), { ...issue, createdAt: serverTimestamp() });
  }
};


