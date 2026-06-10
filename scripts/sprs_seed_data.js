/**
 * SPRS Firebase Seed Script
 * Real data extracted from MEC'S Engineering site diaries & project documents
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const path  = require("path");
const fs    = require("fs");

// ── Init ──────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../serviceAccountKey.json");
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ serviceAccountKey.json not found at: " + SERVICE_ACCOUNT_PATH);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const ts = () => FieldValue.serverTimestamp();

// ── Collections to clear ──────────────────────────────────────────
const CLEAR_COLLECTIONS = ["projects", "tasks", "reports", "issues", "notifications", "users"];

// ══════════════════════════════════════════════════════════════════
// PROJECT DATA
// ══════════════════════════════════════════════════════════════════
const PROJECTS = [
  {
    _id: "project_gudang_prai",
    name: "Kerja Penyelenggaran, Pembaikan dan Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC",
    location: "Gudang Perai DC, Perai, Pulau Pinang",
    status: "active",
    progress: 85,
    startDate: "2025-03-03",
    endDate: "2025-06-30",
    priority: "high",
    description:
      "Maintenance, repair and upgrade works of the fire suppression system at PADIBER Nasional Berhad's Gudang Perai DC warehouse. Works include cleaning and repainting hydrant/hosereel pipes, installing fire extinguisher cabinets, emergency lights, exit lights, hosereel installations, tank painting, pump servicing and fire alarm panel wiring inspection.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Nor Ihsan Bin Abidin",
    createdAt: Timestamp.fromDate(new Date("2025-03-01")),
  },
  {
    _id: "project_rubberflex",
    name: "Lukisan Terbina Bagi Kelulusan Pelan Aktif – Rubberflex Sdn Bhd Bentong",
    location: "Lot 2, Kawasan Perindustrian Bentong, Mukim Bentong, Daerah Bentong, Pahang",
    status: "active",
    progress: 40,
    startDate: "2026-03-09",
    endDate: "2026-12-31",
    priority: "medium",
    description:
      "Preparation and submission of as-built drawings for Bomba approval under ref JBPM/PH/BKK:700-2/1/7/14/25/30. Building layout plan and additional structure on Lot 2, Bentong Industrial Area. Submitted to Jabatan Bomba dan Penyelamat Malaysia Negeri Pahang (Tn PPgB Muhammad Amri Azman) for Active Plan Approval (Kelulusan 3/1/27544). Consulting engineer: Ir Mohammad Khalis bin Md Yasin.",
    supervisorName: "Ir Mohammad Khalis bin Md Yasin",
    consultantName: "Nor Ihsan Bin Abidin",
    createdAt: Timestamp.fromDate(new Date("2026-03-09")),
  },
  {
    _id: "project_langkawi",
    name: "Cadangan Permohonan Menaiktaraf Bekalan Elektrik di Pusat Belian PPK Langkawi – Kg. Bukit Hantu",
    location: "Kg. Bukit Hantu, Langkawi, Kedah",
    status: "completed",
    progress: 100,
    startDate: "2023-10-27",
    endDate: "2025-08-10",
    priority: "medium",
    description:
      "M&E consulting for electrical supply upgrade at PPK Langkawi purchasing centre. No. Tender/SH: D/021/0623/BPI/PPK. Client: Padiber Nasional Berhad. Total consulting fee RM 48,888. Final claim (Invoice no. 05172) of RM 182.17 issued 10 August 2025.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Nor Ihsan Bin Abidin",
    createdAt: Timestamp.fromDate(new Date("2023-10-27")),
  },
];

// ══════════════════════════════════════════════════════════════════
// TASKS DATA
// ══════════════════════════════════════════════════════════════════
const TASKS = [
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja membersihkan pipe hydrant",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-07",
    completedAt: "2025-03-07",
    description: "Cleaning of hydrant pipes using kain, scraper, and waterjet. Team of 3 workers. Weeks 1–2.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja undercoat pipe hydrant",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-14",
    completedAt: "2025-03-14",
    description: "Undercoat painting of hydrant pipes. Equipment: roller, undercoat paint, berus. Week 1–2.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja mengecat pipe hydrant",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-03-14",
    completedAt: "2025-03-14",
    description: "Top coat painting of hydrant pipes after undercoat. Completed Week 2.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja membersihkan pipe hosereel",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-18",
    completedAt: "2025-04-18",
    description: "Cleaning of hosereel pipes. Ran across Weeks 3–7 (17 March – 18 April 2025).",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja undercoat dan mengecat hosereel pipe",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-18",
    completedAt: "2025-04-18",
    description: "Undercoat and top coat painting of hosereel pipes. Weeks 3–7.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja mengecat tangki",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-04-25",
    completedAt: "2025-04-25",
    description: "Painting of fire suppression system tank. Week 8 (21–25 April 2025).",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja memasang hosereel",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-25",
    completedAt: "2025-04-25",
    description: "Installation of hosereel units. Week 8.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja mengecat hydrant",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-05-02",
    completedAt: "2025-05-02",
    description: "Painting of fire hydrant units. Week 9 (28 April – 2 May 2025).",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja memasang Exit Light",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-02",
    completedAt: "2025-05-02",
    description: "Installation of exit light fittings as part of fire-safety upgrade. Week 9.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja memasang Cabinet Fire Extinguisher",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-16",
    completedAt: "2025-05-16",
    description: "Installation of fire extinguisher cabinets. Weeks 10–11 (5–16 May 2025).",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja-kerja memasang Emergency Light",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-09",
    completedAt: "2025-05-09",
    description: "Installation of emergency lighting units. Week 10.",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja Servis Pump",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-16",
    completedAt: "2025-05-16",
    description: "Fire suppression pump servicing. Week 11 (12–16 May 2025).",
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja Pemeriksaan Wiring Fire Alarm Panel",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "inprogress",
    priority: "high",
    dueDate: "2025-06-30",
    description: "Inspection of fire alarm panel wiring. Started Week 11. Follow-up verification needed before final sign-off.",
  },
  // Rubberflex tasks
  {
    projectId: "project_rubberflex",
    title: "Kemaskini Lukisan Terbina (As-Built Drawing Update)",
    site: "Lot 2, Kawasan Perindustrian Bentong",
    assignedTo: "Ir Mohammad Khalis bin Md Yasin",
    status: "done",
    priority: "high",
    dueDate: "2026-03-09",
    completedAt: "2026-03-09",
    description: "Update as-built drawings for existing building and additional structure to reflect current layout for Bomba submission.",
  },
  {
    projectId: "project_rubberflex",
    title: "Hantar 3 Salinan Lukisan ke Jabatan Bomba Pahang",
    site: "Ibu Pejabat JBPM, Kuantan, Pahang",
    assignedTo: "Ir Mohammad Khalis bin Md Yasin",
    status: "done",
    priority: "high",
    dueDate: "2026-03-09",
    completedAt: "2026-03-09",
    description: "Submit 3 copies of as-built drawings to JBPM Pahang (Tn PPgB Muhammad Amri Azman) for Active Plan Approval. Ref: ME/RF/01/26.",
  },
  {
    projectId: "project_rubberflex",
    title: "Pengesahan Pematuhan Akta Perkhidmatan Bomba 1988",
    site: "Lot 2, Kawasan Perindustrian Bentong",
    assignedTo: "Nor Ihsan Bin Abidin",
    status: "inprogress",
    priority: "high",
    dueDate: "2026-06-30",
    description: "Verify premise complies with fire safety requirements under the Fire Services Act 1988. Awaiting JBPM review response.",
  },
];

// ══════════════════════════════════════════════════════════════════
// REPORTS DATA  (one per site diary week)
// ══════════════════════════════════════════════════════════════════
const weekData = [
  { week:1,  dateRange:"3 March 2025 – 7 March 2025",        date:"2025-03-07",  activities:["Kerja-kerja membersihkan pipe hydrant","Kerja-kerja undercoat pipe"] },
  { week:2,  dateRange:"10 March 2025 – 14 March 2025",      date:"2025-03-14",  activities:["Kerja-kerja membersihkan pipe hydrant","Kerja-kerja undercoat pipe","Kerja-kerja mengecat pipe"] },
  { week:3,  dateRange:"17 March 2025 – 21 March 2025",      date:"2025-03-21",  activities:["Kerja-kerja membersihkan pipe hosereel","Kerja-kerja undercoat pipe","Kerja-kerja mengecat hosereel pipe"] },
  { week:4,  dateRange:"24 March 2025 – 28 March 2025",      date:"2025-03-28",  activities:["Kerja-kerja membersihkan pipe hosereel","Kerja-kerja undercoat pipe","Kerja-kerja mengecat hosereel pipe"] },
  { week:5,  dateRange:"31 March 2025 – 4 April 2025",       date:"2025-04-04",  activities:["Kerja-kerja membersihkan pipe hosereel","Kerja-kerja undercoat pipe","Kerja-kerja mengecat hosereel pipe"] },
  { week:6,  dateRange:"7 April 2025 – 11 April 2025",       date:"2025-04-11",  activities:["Kerja-kerja membersihkan pipe hosereel","Kerja-kerja undercoat pipe","Kerja-kerja mengecat hosereel pipe"] },
  { week:7,  dateRange:"14 April 2025 – 18 April 2025",      date:"2025-04-18",  activities:["Kerja-kerja membersihkan pipe hosereel","Kerja-kerja undercoat pipe","Kerja-kerja mengecat hosereel pipe"] },
  { week:8,  dateRange:"21 April 2025 – 25 April 2025",      date:"2025-04-25",  activities:["Kerja-kerja mengecat tangki","Kerja-kerja memasang hosereel"] },
  { week:9,  dateRange:"28 April 2025 – 2 May 2025",         date:"2025-05-02",  activities:["Kerja-kerja mengecat hydrant","Kerja-kerja memasang Exit Light"] },
  { week:10, dateRange:"5 May 2025 – 9 May 2025",            date:"2025-05-09",  activities:["Kerja-kerja memasang Cabinet Fire Extinguisher","Kerja-kerja memasang Emergency Light"] },
  { week:11, dateRange:"12 May 2025 – 16 May 2025",          date:"2025-05-16",  activities:["Kerja-kerja memasang Cabinet Fire Extinguisher","Kerja Servis Pump","Kerja Pemeriksaan Wiring Fire Alarm Panel"] },
];

const REPORTS = weekData.map((w) => ({
  projectId: "project_gudang_prai",
  projectName: "Kerja Penyelenggaran, Pembaikan dan Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC",
  title: `Site Diary – Week ${w.week} (${w.dateRange})`,
  date: w.date,
  submittedBy: "Hj Azmi Bin Nong",
  submittedByRole: "supervisor",
  reviewedBy: "Nor Ihsan Bin Abidin",
  weather: "Sunny / Clear",
  workforce: "3 workers (Team 1) – Contractor: Mozzaz Venture",
  equipment: "Kain, Scraper, Waterjet, Roller, Undercoat paint, Berus",
  materials: "Undercoat paint, top coat paint",
  description: w.activities.map((a, i) => `${i+1}. ${a}`).join("\n"),
  issues: "None – comply as per requirement",
  status: "approved",
  reviewComment: "Verified. All activities comply as per project requirement.",
  photoUrls: [],
  createdAt: Timestamp.fromDate(new Date(w.date)),
}));

// ══════════════════════════════════════════════════════════════════
// ISSUES DATA
// ══════════════════════════════════════════════════════════════════
const ISSUES = [
  {
    projectId: "project_rubberflex",
    projectName: "Lukisan Terbina Bagi Kelulusan Pelan Aktif – Rubberflex Sdn Bhd Bentong",
    title: "Kelulusan FC Perlu Dikemaskini – Rujukan 2010 Lapuk",
    description: "Previous fire safety approval FC JBPM:PH/7/0026/2004 dated 18 August 2010 is outdated. As-built drawings have been updated but JBPM confirmation of new approval is still pending.",
    priority: "high",
    status: "open",
    reportedBy: "Ir Mohammad Khalis bin Md Yasin",
    location: "Lot 2, Kawasan Perindustrian Bentong, Pahang",
    createdAt: Timestamp.fromDate(new Date("2026-03-09")),
  },
  {
    projectId: "project_gudang_prai",
    projectName: "Kerja Penyelenggaran, Pembaikan dan Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC",
    title: "Fire Alarm Panel Wiring – Pemeriksaan Lanjut Diperlukan",
    description: "During Week 11 inspection of fire alarm panel wiring, some areas require closer monitoring before final sign-off. Follow-up verification needed before project completion.",
    priority: "medium",
    status: "open",
    reportedBy: "Hj Azmi Bin Nong",
    location: "Gudang Perai DC, Perai, Pulau Pinang",
    createdAt: Timestamp.fromDate(new Date("2025-05-16")),
  },
];

// ══════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════
const USERS = [
  {
    name: "Nor Ihsan Bin Abidin",
    email: "norihsan@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "wM9m4fUS8NNMLovoQ731xdmly9b2", // Map to existing Firebase Auth UID if matching email
    fcmToken: null,
  },
  {
    name: "Hj Azmi Bin Nong",
    email: "azmi@mecs.com.my",
    role: "supervisor",
    status: "approved",
    password: "Mecs@2025",
    uid: "f5RHHTkKQjOBwunBXze0UhIyJno2", // Map to existing Firebase Auth UID if matching email
    fcmToken: null,
  },
  {
    name: "Ir Mohammad Khalis bin Md Yasin",
    email: "khalis@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "cb4AVFTrvwV3CTJ7i8SqQM2E4WD2", // Map to existing Firebase Auth UID if matching email (Ir Khalis maps to cb4A... which is jessica@mecs.com.my or a new user, we will map dynamically or keep it)
    fcmToken: null,
  },
];

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
async function clearCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) { console.log(`  ⏭️  '${name}' already empty`); return; }
  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`  🗑️  Cleared ${count} docs from '${name}'`);
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function run() {
  console.log("\n🚀 SPRS Real-Data Seeder Starting...\n");

  // 1. Clear all mockup data
  console.log("Step 1: Clearing all existing data...");
  for (const col of CLEAR_COLLECTIONS) await clearCollection(col);

  // 2. Projects
  console.log("\nStep 2: Uploading projects...");
  const projectIdMap = {};
  for (const p of PROJECTS) {
    const { _id, ...data } = p;
    const docRef = db.collection("projects").doc();
    await docRef.set(data);
    projectIdMap[_id] = docRef.id;
    console.log(`  ✅ ${data.name.substring(0,55)}... → ${docRef.id}`);
  }

  // 3. Tasks
  console.log("\nStep 3: Uploading tasks...");
  let taskCount = 0;
  for (const t of TASKS) {
    const { projectId: pid, ...rest } = t;
    await db.collection("tasks").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
      projectName: PROJECTS.find(p => p._id === pid)?.name || "",
      createdAt: ts(),
    });
    taskCount++;
  }
  console.log(`  ✅ ${taskCount} tasks uploaded`);

  // 4. Reports
  console.log("\nStep 4: Uploading site diary reports...");
  for (const r of REPORTS) {
    const { projectId: pid, ...rest } = r;
    await db.collection("reports").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
    });
  }
  console.log(`  ✅ ${REPORTS.length} reports uploaded`);

  // 5. Issues
  console.log("\nStep 5: Uploading issues...");
  for (const i of ISSUES) {
    const { projectId: pid, ...rest } = i;
    await db.collection("issues").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
    });
  }
  console.log(`  ✅ ${ISSUES.length} issues uploaded`);

  // 6. Users
  console.log("\nStep 6: Uploading users...");
  // Let's resolve the user UIDs from existing auth users if possible, or keep the placeholder values.
  const authUsers = await getAuth().listUsers();
  
  for (const u of USERS) {
    const matchingAuth = authUsers.users.find(au => au.email.toLowerCase() === u.email.toLowerCase());
    if (matchingAuth) {
      u.uid = matchingAuth.uid;
    }
    await db.collection("users").add({ ...u, createdAt: ts() });
    console.log(`  ✅ ${u.name} (${u.role}) | UID: ${u.uid}`);
  }

  console.log("\n══════════════════════════════════════════");
  console.log("🎉 Done! Firebase is now loaded with REAL data.");
  console.log(`   Projects : ${PROJECTS.length}`);
  console.log(`   Tasks    : ${taskCount}`);
  console.log(`   Reports  : ${REPORTS.length}`);
  console.log(`   Issues   : ${ISSUES.length}`);
  console.log(`   Users    : ${USERS.length}`);
  console.log("══════════════════════════════════════════\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
