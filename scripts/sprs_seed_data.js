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
    name: "Kerja Penyelenggaran, Pembaikan & Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC",
    client: "Padiberas Nasional Berhad (BERNAS)",
    location: "Gudang Perai DC, Penang",
    contractValue: "RM 16,500",
    status: "completed",
    progress: 100,
    startDate: "2025-03-03",
    endDate: "2025-05-23",
    priority: "high",
    description: "Kerja Penyelenggaran, Pembaikan & Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC. Client: Padiberas Nasional Berhad (BERNAS). Source: 11 Site Diaries + Minute of Meeting + Invoice.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Nor Ihsan Bin Abidin",
    createdAt: Timestamp.fromDate(new Date("2025-03-01")),
  },
  {
    _id: "project_langkawi",
    name: "Cadangan Permohonan Menaiktaraf Bekalan Elektrik di Pusat Belian PPK Langkawi",
    client: "Padiberas Nasional Berhad",
    location: "Langkawi, Kedah",
    contractValue: "RM 182.17 (M&E Fee)",
    status: "completed",
    progress: 100,
    startDate: "2023-10-27",
    endDate: "2025-08-10",
    priority: "medium",
    description: "Cadangan Permohonan Menaiktaraf Bekalan Elektrik di Pusat Belian PPK Langkawi – Kg. Bukit Hantu. Client: Padiberas Nasional Berhad. Source: Invoice No. 0517 (M&E Final Claim RM182.17).",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Nor Ihsan Bin Abidin",
    createdAt: Timestamp.fromDate(new Date("2023-10-27")),
  },
  {
    _id: "project_rubberflex",
    name: "Submission of As-Built Drawing for Bomba Approval — Rubberflex Factory",
    client: "Rubberflex Sdn. Bhd.",
    location: "Bentong, Pahang",
    contractValue: "RM 95,000",
    status: "active",
    progress: 60,
    startDate: "2026-03-09",
    endDate: "2026-12-31",
    priority: "high",
    description: "Submission of As-Built Drawing for Bomba Approval — Rubberflex Factory. Client: Rubberflex Sdn. Bhd. Source: Invoice RF/03/25 + Bomba letter + Quotation (Contract value RM95,000).",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Ir Mohammad Khalis bin Md Yasin",
    createdAt: Timestamp.fromDate(new Date("2026-03-09")),
  },
  {
    _id: "project_ftj_biopower",
    name: "Upgrading Work for Fire Fighting System — FTJ Bio Power Sdn. Bhd.",
    client: "FTJ Bio Power Sdn. Bhd.",
    location: "Jalan Jengka 9, Maran, Pahang",
    contractValue: "RM 49,580",
    status: "completed",
    progress: 100,
    startDate: "2025-06-01",
    endDate: "2025-08-30",
    priority: "medium",
    description: "Upgrading Work for Fire Fighting System — FTJ Bio Power Sdn. Bhd. Source: Invoice MECS/2025-FTJ/26/2 (RM49,580) + SSK completion form.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2025-06-01")),
  },
  {
    _id: "project_wellgain_fc",
    name: "Submission of Fire Certificate (FC) Bomba Drawing — Wellgain Product Sdn. Bhd.",
    client: "Wellgain Product Sdn. Bhd.",
    location: "Kawasan Perindustrian Nilai, Negeri Sembilan",
    contractValue: "RM 13,680 (FC submission)",
    status: "completed",
    progress: 100,
    startDate: "2025-01-01",
    endDate: "2025-05-30",
    priority: "medium",
    description: "Submission of Fire Certificate (FC) Bomba Drawing — Wellgain Product Sdn. Bhd. Client: Wellgain Product Sdn. Bhd. Source: Invoice 05012.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Muhamad Firdaus Bin Ahmad",
    createdAt: Timestamp.fromDate(new Date("2025-01-01")),
  },
  {
    _id: "project_wellgain_install",
    name: "Installation of Fire Fighting System — Wellgain Product Sdn. Bhd.",
    client: "Wellgain Product Sdn. Bhd.",
    location: "Kawasan Perindustrian Nilai, Negeri Sembilan",
    contractValue: "RM 295,000",
    status: "active",
    progress: 30,
    startDate: "2025-06-01",
    endDate: "2026-06-30",
    priority: "high",
    description: "Installation of Fire Fighting System — Wellgain Product Sdn. Bhd. Contract Value: RM 295,000 (30% paid — RM 88,500).",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Muhamad Firdaus Bin Ahmad",
    createdAt: Timestamp.fromDate(new Date("2025-06-01")),
  },
  {
    _id: "project_star_media",
    name: "ACMV Calculation & Design at Roof Trusses — The Star Media Group / Menara Star 2",
    client: "The Star Media Group",
    location: "Jalan 13/6, Petaling Jaya, Selangor",
    contractValue: "RM 9,800",
    status: "active",
    progress: 80,
    startDate: "2025-02-01",
    endDate: "2026-08-30",
    priority: "low",
    description: "ACMV Calculation & Design at Roof Trusses — The Star Media Group / Menara Star 2. Client: The Star Media Group. Source: Quotation MECS/2025-RF06/10 (RM9,800) + Bomba letter.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Ir Mohammad Khalis bin Md Yasin",
    createdAt: Timestamp.fromDate(new Date("2025-02-01")),
  },
  {
    _id: "project_semambu_water",
    name: "Mereka Bentuk, As-Built Drawing — Loji Rawatan Air Semambu Fasa 2",
    client: "Progressive Crest Sdn. Bhd.",
    location: "Semambu, Kuantan, Pahang",
    contractValue: "Not Specified",
    status: "completed",
    progress: 100,
    startDate: "2025-07-01",
    endDate: "2025-12-30",
    priority: "medium",
    description: "Mereka Bentuk, As-Built Drawing — Loji Rawatan Air Semambu Fasa 2. Client: Progressive Crest Sdn. Bhd. Source: Invoice issued Dec 2025.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2025-07-01")),
  },
  {
    _id: "project_ms_food",
    name: "Authority Submission for New Pipe Rack — M&S Food Industries Sdn. Bhd.",
    client: "All Zone Engineering & Trading Sdn. Bhd.",
    location: "Ipoh, Perak",
    contractValue: "Not Specified (PO 1023)",
    status: "completed",
    progress: 100,
    startDate: "2025-08-01",
    endDate: "2025-12-30",
    priority: "medium",
    description: "Authority Submission for New Pipe Rack — M&S Food Industries Sdn. Bhd. Client: All Zone Engineering & Trading Sdn. Bhd. Source: Invoice issued Dec 2025.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2025-08-01")),
  },
  {
    _id: "project_sg_udang_renovation",
    name: "Renovation Works — Taman Sg. Udang & Housekeeping/Wiring at Taman Tangga Batu",
    client: "MECS Construction Client",
    location: "Taman Sg. Udang & Taman Tangga Batu",
    contractValue: "RM 12,000+",
    status: "completed",
    progress: 100,
    startDate: "2025-04-01",
    endDate: "2025-07-30",
    priority: "medium",
    description: "Renovation Works — Taman Sg. Udang & Housekeeping/Wiring at Taman Tangga Batu. Source: Invoice issued Jul 2025.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2025-04-01")),
  },
  {
    _id: "project_surau_renovation",
    name: "Renovation Work — New Surau at Ken Rimba Legian, Shah Alam",
    client: "Syed Yaatim",
    location: "No.51 Jalan Lengkuas 16/22A, Shah Alam, Selangor",
    contractValue: "RM 45,000",
    status: "active",
    progress: 10,
    startDate: "2026-04-01",
    endDate: "2026-10-31",
    priority: "medium",
    description: "Renovation Work — New Surau at Ken Rimba Legian, Shah Alam. Client: Syed Yaatim. Source: Quotation Apr 2026.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2026-04-01")),
  },
  {
    _id: "project_frim_masjid",
    name: "M&E Engineering Consultant — Cadangan Membina Masjid Kg. Melayu FRIM, Kepong",
    client: "Jawatankuasa Penaja Masjid Kg. Melayu FRIM",
    location: "Kepong, Kuala Lumpur",
    contractValue: "Not Specified",
    status: "active",
    progress: 5,
    startDate: "2025-12-01",
    endDate: "2026-12-31",
    priority: "medium",
    description: "M&E Engineering Consultant — Cadangan Membina Masjid Kg. Melayu FRIM, Kepong. Client: Jawatankuasa Penaja Masjid Kg. Melayu FRIM. Source: RFQ received Dec 2025.",
    supervisorName: "Hj Azmi Bin Nong",
    consultantName: "Hasnorfadli Bin Amat (Ir.)",
    createdAt: Timestamp.fromDate(new Date("2025-12-01")),
  },
];

// ══════════════════════════════════════════════════════════════════
// TASKS DATA (16 Work Activities from Project 1 + Rubberflex tasks)
// ══════════════════════════════════════════════════════════════════
const TASKS = [
  // Project 1 (Gudang Prai) Tasks (Weekly tasks from site diaries)
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hydrant (W1)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-07",
    completedAt: "2025-03-07",
    description: "Kerja membersihkan pipe hydrant (Week 1)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W1)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-07",
    completedAt: "2025-03-07",
    description: "Kerja undercoat pipe (Week 1)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hydrant (W2)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-14",
    completedAt: "2025-03-14",
    description: "Kerja membersihkan pipe hydrant (Week 2)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W2)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-14",
    completedAt: "2025-03-14",
    description: "Kerja undercoat pipe (Week 2)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat pipe (W2)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-03-14",
    completedAt: "2025-03-14",
    description: "Kerja mengecat pipe (Week 2)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hosereel (W3)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-21",
    completedAt: "2025-03-21",
    description: "Kerja membersihkan pipe hosereel (Week 3)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W3)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-21",
    completedAt: "2025-03-21",
    description: "Kerja undercoat pipe (Week 3)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hosereel pipe (W3)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-03-21",
    completedAt: "2025-03-21",
    description: "Kerja mengecat hosereel pipe (Week 3)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hosereel (W4)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-28",
    completedAt: "2025-03-28",
    description: "Kerja membersihkan pipe hosereel (Week 4)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W4)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-03-28",
    completedAt: "2025-03-28",
    description: "Kerja undercoat pipe (Week 4)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hosereel pipe (W4)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-03-28",
    completedAt: "2025-03-28",
    description: "Kerja mengecat hosereel pipe (Week 4)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hosereel (W5)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-04",
    completedAt: "2025-04-04",
    description: "Kerja membersihkan pipe hosereel (Week 5)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W5)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-04",
    completedAt: "2025-04-04",
    description: "Kerja undercoat pipe (Week 5)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hosereel pipe (W5)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-04-04",
    completedAt: "2025-04-04",
    description: "Kerja mengecat hosereel pipe (Week 5)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hosereel (W6)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-11",
    completedAt: "2025-04-11",
    description: "Kerja membersihkan pipe hosereel (Week 6)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W6)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-11",
    completedAt: "2025-04-11",
    description: "Kerja undercoat pipe (Week 6)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hosereel pipe (W6)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-04-11",
    completedAt: "2025-04-11",
    description: "Kerja mengecat hosereel pipe (Week 6)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja membersihkan pipe hosereel (W7)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-18",
    completedAt: "2025-04-18",
    description: "Kerja membersihkan pipe hosereel (Week 7)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja undercoat pipe (W7)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-18",
    completedAt: "2025-04-18",
    description: "Kerja undercoat pipe (Week 7)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hosereel pipe (W7)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-04-18",
    completedAt: "2025-04-18",
    description: "Kerja mengecat hosereel pipe (Week 7)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat tangki (W8)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-04-25",
    completedAt: "2025-04-25",
    description: "Kerja mengecat tangki (Week 8)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja memasang hosereel (W8)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-04-25",
    completedAt: "2025-04-25",
    description: "Kerja memasang hosereel (Week 8)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja mengecat hydrant (W9)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "medium",
    dueDate: "2025-05-02",
    completedAt: "2025-05-02",
    description: "Kerja mengecat hydrant (Week 9)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja memasang Exit Light (W9)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-02",
    completedAt: "2025-05-02",
    description: "Kerja memasang Exit Light (Week 9)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja memasang Cabinet Fire Extinguisher (W10)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-09",
    completedAt: "2025-05-09",
    description: "Kerja memasang Cabinet Fire Extinguisher (Week 10)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja memasang Emergency Light (W10)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-09",
    completedAt: "2025-05-09",
    description: "Kerja memasang Emergency Light (Week 10)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja memasang Cabinet Fire Extinguisher (W11)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-16",
    completedAt: "2025-05-16",
    description: "Kerja memasang Cabinet Fire Extinguisher (Week 11)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja Servis Pump (W11)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-16",
    completedAt: "2025-05-16",
    description: "Kerja Servis Pump (Week 11)"
  },
  {
    projectId: "project_gudang_prai",
    title: "Kerja Pemeriksaan Wiring Fire Alarm Panel (W11)",
    site: "Gudang Perai DC",
    assignedTo: "Hj Azmi Bin Nong",
    status: "done",
    priority: "high",
    dueDate: "2025-05-16",
    completedAt: "2025-05-16",
    description: "Kerja Pemeriksaan Wiring Fire Alarm Panel (Week 11)"
  },
  // Project 3 (Rubberflex) Tasks (To complete 16 unique tasks list)
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
    description: "Submit 3 copies of as-built drawings to JBPM Pahang (Tn PPgB Muhammad Amri Azman) for Active Plan Approval.",
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
// REPORTS DATA (one per site diary week)
// ══════════════════════════════════════════════════════════════════
const weekData = [
  { week:1,  dateRange:"3 March 2025 – 7 March 2025",        date:"2025-03-07",  activities: ["Kerja membersihkan pipe hydrant", "Kerja undercoat pipe"] },
  { week:2,  dateRange:"10 March 2025 – 14 March 2025",      date:"2025-03-14",  activities: ["Kerja membersihkan pipe hydrant", "Kerja undercoat pipe", "Kerja mengecat pipe"] },
  { week:3,  dateRange:"17 March 2025 – 21 March 2025",      date:"2025-03-21",  activities: ["Kerja membersihkan pipe hosereel", "Kerja undercoat pipe", "Kerja mengecat hosereel pipe"] },
  { week:4,  dateRange:"24 March 2025 – 28 March 2025",      date:"2025-03-28",  activities: ["Kerja membersihkan pipe hosereel", "Kerja undercoat pipe", "Kerja mengecat hosereel pipe"] },
  { week:5,  dateRange:"31 March 2025 – 4 April 2025",       date:"2025-04-04",  activities: ["Kerja membersihkan pipe hosereel", "Kerja undercoat pipe", "Kerja mengecat hosereel pipe"] },
  { week:6,  dateRange:"7 April 2025 – 11 April 2025",       date:"2025-04-11",  activities: ["Kerja membersihkan pipe hosereel", "Kerja undercoat pipe", "Kerja mengecat hosereel pipe"] },
  { week:7,  dateRange:"14 April 2025 – 18 April 2025",      date:"2025-04-18",  activities: ["Kerja membersihkan pipe hosereel", "Kerja undercoat pipe", "Kerja mengecat hosereel pipe"] },
  { week:8,  dateRange:"21 April 2025 – 25 April 2025",      date:"2025-04-25",  activities: ["Kerja mengecat tangki", "Kerja memasang hosereel"] },
  { week:9,  dateRange:"28 April 2025 – 2 May 2025",         date:"2025-05-02",  activities: ["Kerja mengecat hydrant", "Kerja memasang Exit Light"] },
  { week:10, dateRange:"5 May 2025 – 9 May 2025",            date:"2025-05-09",  activities: ["Kerja memasang Cabinet Fire Extinguisher", "Kerja memasang Emergency Light"] },
  { week:11, dateRange:"12 May 2025 – 16 May 2025",          date:"2025-05-16",  activities: ["Kerja memasang Cabinet Fire Extinguisher", "Kerja Servis Pump", "Kerja Pemeriksaan Wiring Fire Alarm Panel"] },
];

const REPORTS = weekData.map((w) => ({
  projectId: "project_gudang_prai",
  projectName: "Kerja Penyelenggaran, Pembaikan & Peningkatan Sistem Pemadam Kebakaran di Gudang Prai DC",
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
// ISSUES DATA (0 issues)
// ══════════════════════════════════════════════════════════════════
const ISSUES = [];

// ══════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════
const USERS = [
  {
    name: "Hj Azmi Bin Nong",
    email: "azmi@mecs.com.my",
    role: "supervisor",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_supervisor_azmi",
    fcmToken: null,
  },
  {
    name: "Nor Ihsan Bin Abidin",
    email: "norihsan@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_consultant_ihsan",
    fcmToken: null,
  },
  {
    name: "Ir Mohammad Khalis bin Md Yasin",
    email: "khalis@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_consultant_khalis",
    fcmToken: null,
  },
  {
    name: "Hasnorfadli Bin Amat (Ir.)",
    email: "hasnorfadli@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_consultant_fadli",
    fcmToken: null,
  },
  {
    name: "Muhamad Firdaus Bin Ahmad",
    email: "firdaus@mecs.com.my",
    role: "consultant",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_consultant_firdaus",
    fcmToken: null,
  },
  {
    name: "Muhammad Izdihar",
    email: "izdihar@mecs.com.my",
    role: "admin",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_admin_izdihar",
    fcmToken: null,
  },
  {
    name: "Mohd Zafree Bin Mohd Ghaus",
    email: "zafree@mecs.com.my",
    role: "admin",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_admin_zafree",
    fcmToken: null,
  },
  {
    name: "System Administrator",
    email: "admin@mecs.com.my",
    role: "admin",
    status: "approved",
    password: "Mecs@2025",
    uid: "seed_admin_sys",
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

  // 2. Resolve Users FIRST
  console.log("\nStep 2: Syncing and syncing users...");
  const authUsers = await getAuth().listUsers();
  const nameToUidMap = {};

  for (const u of USERS) {
    let authUid = u.uid;
    const matchingAuth = authUsers.users.find(au => au.email.toLowerCase() === u.email.toLowerCase());
    
    if (matchingAuth) {
      authUid = matchingAuth.uid;
      console.log(`  ℹ️ Found existing Auth user for: ${u.email} → ${authUid}`);
    } else {
      // Create user in Firebase Auth if they do not exist
      try {
        const createdUser = await getAuth().createUser({
          email: u.email,
          password: u.password,
          displayName: u.name,
        });
        authUid = createdUser.uid;
        console.log(`  ➕ Created Auth user: ${u.email} → ${authUid}`);
      } catch (authErr) {
        console.error(`  ❌ Failed to create Auth user for ${u.email}:`, authErr.message);
      }
    }
    
    u.uid = authUid;
    nameToUidMap[u.name.toLowerCase()] = authUid;
    // Special mapping for Hasnorfadli (Ir.) to hasnorfadli
    if (u.name.toLowerCase().includes("hasnorfadli")) {
      nameToUidMap["hasnorfadli bin amat"] = authUid;
      nameToUidMap["hasnorfadli bin amat (ir.)"] = authUid;
    }
    await db.collection("users").add({ ...u, createdAt: ts() });
    console.log(`  ✅ ${u.name} (${u.role}) | Firestore synced | UID: ${u.uid}`);
  }

  // 3. Projects
  console.log("\nStep 3: Uploading projects...");
  const projectIdMap = {};
  for (const p of PROJECTS) {
    const { _id, ...data } = p;
    
    // Resolve createdByUid and supervisorUid dynamically from user name mapping
    const consultantUid = nameToUidMap[data.consultantName.toLowerCase()];
    const supervisorUid = nameToUidMap[data.supervisorName.toLowerCase()];
    
    const docRef = db.collection("projects").doc();
    await docRef.set({
      ...data,
      createdByUid: consultantUid || null,
      supervisorUid: supervisorUid || null,
    });
    projectIdMap[_id] = docRef.id;
    console.log(`  ✅ ${data.name.substring(0,55)}... (Consultant UID: ${consultantUid}, Supervisor UID: ${supervisorUid}) → ${docRef.id}`);
  }

  // 4. Tasks
  console.log("\nStep 4: Uploading tasks...");
  let taskCount = 0;
  for (const t of TASKS) {
    const { projectId: pid, ...rest } = t;
    
    const supervisorUid = nameToUidMap[t.assignedTo.toLowerCase()];
    
    await db.collection("tasks").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
      projectName: PROJECTS.find(p => p._id === pid)?.name || "",
      assignedToUid: supervisorUid || null,
      createdAt: ts(),
    });
    taskCount++;
  }
  console.log(`  ✅ ${taskCount} tasks uploaded`);

  // 5. Reports
  console.log("\nStep 5: Uploading site diary reports...");
  for (const r of REPORTS) {
    const { projectId: pid, ...rest } = r;
    
    const supervisorUid = nameToUidMap[r.submittedBy.toLowerCase()];
    
    await db.collection("reports").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
      submittedById: supervisorUid || null,
    });
  }
  console.log(`  ✅ ${REPORTS.length} reports uploaded`);

  // 6. Issues
  console.log("\nStep 6: Uploading issues...");
  for (const i of ISSUES) {
    const { projectId: pid, ...rest } = i;
    await db.collection("issues").add({
      ...rest,
      projectId: projectIdMap[pid] || pid,
    });
  }
  console.log(`  ✅ ${ISSUES.length} issues uploaded`);

  console.log("\n══════════════════════════════════════════");
  console.log("🎉 Done! Firebase is now loaded with REAL, fully linked data.");
  console.log(`   Users    : ${USERS.length}`);
  console.log(`   Projects : ${PROJECTS.length}`);
  console.log(`   Tasks    : ${taskCount}`);
  console.log(`   Reports  : ${REPORTS.length}`);
  console.log(`   Issues   : ${ISSUES.length}`);
  console.log("══════════════════════════════════════════\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
