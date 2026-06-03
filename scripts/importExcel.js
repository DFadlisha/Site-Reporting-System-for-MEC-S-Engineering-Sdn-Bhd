/**
 * Firebase Firestore Excel Data Importer & Database Cleaner
 * 
 * This script will:
 * 1. Clean out existing mockup/dummy data in specified collections.
 * 2. Scan the subfolders inside `excel_imports/` and parse customized engineering files.
 * 3. Map spreadsheets into Firestore documents.
 * 4. Relate Tasks, Issues, and Site Reports to their respective Projects using the Project Name.
 * 5. Bulk upload the data into your Firestore database.
 * 
 * Prerequisites:
 * Run the following commands in your project root before running this script:
 * npm install xlsx firebase-admin
 */

const admin = require("firebase-admin");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

// =========================================================================
// CONFIGURATION
// =========================================================================
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../serviceAccountKey.json");
const CLEAN_MOCKUP_DATA_FIRST = true;
const COLLECTIONS_TO_CLEAR = ["projects", "tasks", "issues", "reports", "notifications", "audit_logs"];

// =========================================================================
// INITIALIZE FIREBASE ADMIN SDK
// =========================================================================
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("========================================================================");
  console.error("❌ ERROR: Firebase Service Account Key Not Found!");
  console.error(`Please place your serviceAccountKey.json file at: \n   ${SERVICE_ACCOUNT_PATH}`);
  console.error("========================================================================");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Ensure import directories exist
const importsDir = path.join(__dirname, "../excel_imports");
const categories = ["projects", "tasks", "issues", "reports", "users"];
if (!fs.existsSync(importsDir)) {
  fs.mkdirSync(importsDir, { recursive: true });
}
for (const cat of categories) {
  const catPath = path.join(importsDir, cat);
  if (!fs.existsSync(catPath)) {
    fs.mkdirSync(catPath, { recursive: true });
  }
}

// Helper to convert Excel serial dates to JS Dates
function excelDateToJSDate(serial) {
  if (!serial) return null;
  if (typeof serial === "string") return serial; // already formatted as string
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const minutes = Math.floor(total_seconds / 60) % 60;
  const hours = Math.floor(total_seconds / 3600);
  const d = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  
  // Format to YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// =========================================================================
// CUSTOM FILE PARSERS
// =========================================================================

// Parse Project BQ file and extract name, location, and tasks
function parseProjectFileAndTasks(filePath) {
  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const firstSheetData = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1 });
  
  let nameVal = "";
  let locationVal = "Batu Pahat, Johor";
  let descriptionVal = "";
  
  if (firstSheetData.length > 0 && firstSheetData[0] && firstSheetData[0][0]) {
    const headerText = firstSheetData[0][0];
    if (headerText.includes("BATU PAHAT")) {
      locationVal = "Batu Pahat, Johor";
    }
  }
  
  for (let r = 0; r < firstSheetData.length; r++) {
    if (firstSheetData[r] && firstSheetData[r][0]) {
      const text = String(firstSheetData[r][0]).trim();
      if (text.startsWith("PAKEJ 7") || text.includes("RUMAH PAM") || text.includes("GRAND TOTAL")) {
        nameVal = text;
        break;
      }
    }
  }
  
  if (!nameVal) {
    nameVal = path.basename(filePath, ".xlsx")
      .replace(/RTBBP\s*-\s*/gi, "")
      .replace(/-\s*\d+\.\d+\.\d+/g, "")
      .trim();
  }
  
  nameVal = nameVal.replace(/\r?\n|\r/g, " ").trim();
  descriptionVal = `Flooding mitigation and pump house upgrade work under Package 7: ${nameVal}. Contract No: JPS/IP/BPB/32/2023.`;

  const projectPayload = {
    name: nameVal,
    location: locationVal,
    status: "active",
    progress: 0,
    startDate: "2025-12-09",
    endDate: "2026-12-09",
    priority: "high",
    description: descriptionVal
  };

  const tasks = [];
  
  // Extract BQ items as tasks
  for (const sheetName of workbook.SheetNames) {
    if (["General Summary", "Bx - Summary", "Page Setup", "BQ Setup", "Grand Total"].includes(sheetName)) {
      continue;
    }
    
    try {
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      for (let r = 5; r < sheetData.length; r++) {
        const row = sheetData[r];
        if (row && row[0] && (row[2] || row[4] || row[3])) {
          const itemNo = String(row[0]).trim();
          if (/^[A-Z]?\d+(\.\d+)*$/i.test(itemNo)) {
            const rawDesc = String(row[4] || row[2] || row[3]).trim();
            if (rawDesc.length > 5 && !rawDesc.toLowerCase().includes("total carried to")) {
              let title = rawDesc.replace(/\r?\n|\r/g, " ");
              if (title.length > 80) {
                title = title.substring(0, 77) + "...";
              }
              title = `[${sheetName}] ${itemNo}: ${title}`;
              
              tasks.push({
                title: title,
                site: sheetName,
                dueDate: "2026-12-09",
                priority: "medium",
                status: "todo"
              });
            }
          }
        }
      }
    } catch (err) {
      // Ignore sheet reading errors
    }
  }

  return { project: projectPayload, tasks: tasks };
}

// Parse Site Diary weekly report file
function parseSiteDiaryFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  
  let dateVal = "";
  let projectNameVal = "";
  let weatherVal = "";
  let workStartTimeVal = "";
  let workEndTimeVal = "";
  let submittedByVal = "";
  let reviewedByVal = "";
  let workforceVal = "";
  let equipmentVal = [];
  let descriptionVal = [];
  let issuesVal = "";
  
  // Format A: Multiple sheets (Table 1 to Table 14)
  if (workbook.SheetNames.includes("Table 4") || workbook.SheetNames.includes("Table 6")) {
    if (workbook.Sheets["Table 4"]) {
      const data4 = xlsx.utils.sheet_to_json(workbook.Sheets["Table 4"], { header: 1 });
      if (data4 && data4.length > 1) {
        dateVal = String(data4[1][0] || "").trim();
        projectNameVal = String(data4[1][1] || "").trim();
        weatherVal = String(data4[1][2] || "").trim();
        workStartTimeVal = String(data4[1][3] || "").trim();
        workEndTimeVal = String(data4[1][4] || "").trim();
      }
    }
    
    if (workbook.Sheets["Table 6"]) {
      const data6 = xlsx.utils.sheet_to_json(workbook.Sheets["Table 6"], { header: 1 });
      if (data6 && data6.length > 1) {
        for (let r = 1; r < data6.length; r++) {
          const row = data6[r];
          if (row && row[1]) {
            descriptionVal.push(`${row[0] || r}. ${String(row[1]).trim()}`);
            if (row[3]) {
              workforceVal = workforceVal ? `${workforceVal}, Team ${row[2] || r}: ${row[3]} workers` : `Team ${row[2] || r}: ${row[3]} workers`;
            }
            if (row[4]) {
              equipmentVal.push(String(row[4]).trim());
            }
            if (row[5]) {
              issuesVal = issuesVal ? `${issuesVal}\n${String(row[5]).trim()}` : String(row[5]).trim();
            }
          }
        }
      }
    }
    
    if (workbook.Sheets["Table 12"]) {
      const data12 = xlsx.utils.sheet_to_json(workbook.Sheets["Table 12"], { header: 1 });
      if (data12 && data12.length > 1) {
        submittedByVal = String(data12[1][0] || "").trim();
      }
    }
    
    if (workbook.Sheets["Table 14"]) {
      const data14 = xlsx.utils.sheet_to_json(workbook.Sheets["Table 14"], { header: 1 });
      for (let r = 1; r < data14.length; r++) {
        if (data14[r] && data14[r][0]) {
          reviewedByVal = String(data14[r][0]).trim();
          break;
        }
      }
    }
  } 
  // Format B: Single sheet
  else {
    const firstSheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1 });
    
    if (data.length > 3 && data[2]) {
      const row3 = data[3];
      const headers = data[2];
      const getValByHeader = (headerName) => {
        const idx = headers.findIndex(h => h && String(h).toLowerCase().includes(headerName.toLowerCase()));
        return idx !== -1 ? row3[idx] : "";
      };
      
      dateVal = String(getValByHeader("date") || row3[0] || "").trim();
      projectNameVal = String(getValByHeader("project name") || row3[2] || "").trim();
      weatherVal = String(getValByHeader("weather") || row3[5] || "").trim();
      workStartTimeVal = String(getValByHeader("start time") || row3[9] || "").trim();
      workEndTimeVal = String(getValByHeader("end time") || row3[14] || "").trim();
    }
    
    let actStart = -1;
    let actEnd = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i] && String(data[i][0]).trim() === "Work Activities") actStart = i + 2;
      if (data[i] && String(data[i][0]).trim() === "Visitor Log") actEnd = i;
    }
    
    if (actStart !== -1 && actEnd !== -1) {
      for (let i = actStart; i < actEnd; i++) {
        const row = data[i];
        if (row && row[1]) {
          descriptionVal.push(`${row[0] || (i - actStart + 1)}. ${String(row[1]).trim()}`);
          if (row[8]) {
            workforceVal = workforceVal ? `${workforceVal}, Team ${row[4] || i}: ${row[8]} workers` : `Team ${row[4] || i}: ${row[8]} workers`;
          }
          if (row[11]) {
            equipmentVal.push(String(row[11]).trim());
          }
          if (row[16]) {
            issuesVal = issuesVal ? `${issuesVal}\n${String(row[16]).trim()}` : String(row[16]).trim();
          }
        }
      }
    }
    
    let prepRowIdx = -1;
    let appRowIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i] && String(data[i][0]).trim() === "Prepared By") prepRowIdx = i + 2;
      if (data[i] && String(data[i][0]).trim() === "Approved By") appRowIdx = i + 2;
    }
    
    if (prepRowIdx !== -1 && data[prepRowIdx]) {
      submittedByVal = String(data[prepRowIdx][0] || "").trim();
    }
    if (appRowIdx !== -1 && data[appRowIdx]) {
      reviewedByVal = String(data[appRowIdx][0] || "").trim();
    }
  }

  projectNameVal = projectNameVal.replace(/\r?\n|\r/g, " ").trim();
  dateVal = dateVal.replace(/\r?\n|\r/g, " ").trim();

  return {
    projectName: projectNameVal || "Unknown Project",
    title: `Site Diary - ${path.basename(filePath, ".xlsx").replace(/Site_Diary_/i, "").replace(/_/g, " ")}`,
    date: dateVal,
    submittedBy: submittedByVal || "Technical Supervisor",
    weather: weatherVal || "Clear",
    workforce: workforceVal || "3 workers",
    equipment: Array.from(new Set(equipmentVal)).filter(Boolean).join(", ") || "Hand tools",
    materials: "Maintenance materials",
    description: descriptionVal.join("\n") || "No activities logged.",
    issues: issuesVal || "None",
    status: "approved",
    reviewedBy: reviewedByVal || "Nor Ihsan Bin Abidin",
    reviewComment: "Verified from imported weekly spreadsheet."
  };
}

// =========================================================================
// CLEAN DATABASE
// =========================================================================
async function clearCollection(collectionName) {
  console.log(`🧹 Clearing collection: "${collectionName}"...`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`   Collection "${collectionName}" is already empty.`);
    return;
  }

  let batch = db.batch();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  
  await batch.commit();
  console.log(`   Deleted ${count} documents from "${collectionName}".`);
}

// =========================================================================
// MAIN RUN FUNCTION
// =========================================================================
async function runImport() {
  try {
    if (CLEAN_MOCKUP_DATA_FIRST) {
      console.log("🚀 Starting database cleanup...");
      for (const col of COLLECTIONS_TO_CLEAR) {
        await clearCollection(col);
      }
      console.log("✅ Database cleanup completed.\n");
    }

    const projectNamesMap = {}; // Maps Project Name -> Firestore Document ID

    // -------------------------------------------------------------------------
    // IMPORT PROJECTS & EXTRACTED TASKS
    // -------------------------------------------------------------------------
    const projectsSubfolder = path.join(importsDir, "projects");
    let importedProjectsCount = 0;
    let importedTasksCount = 0;

    if (fs.existsSync(projectsSubfolder)) {
      console.log("📂 Parsing files in 'excel_imports/projects'...");
      const files = fs.readdirSync(projectsSubfolder).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls"));
      
      for (const file of files) {
        const filePath = path.join(projectsSubfolder, file);
        console.log(`\nParsing project file: ${file}`);
        
        const { project, tasks } = parseProjectFileAndTasks(filePath);
        
        // Write Project to Firestore
        const docRef = await db.collection("projects").add({
          ...project,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const projectKey = project.name.toLowerCase();
        projectNamesMap[projectKey] = {
          id: docRef.id,
          name: project.name
        };
        importedProjectsCount++;
        console.log(`   ➕ Imported project: "${project.name}" -> ID: ${docRef.id}`);

        // Write Extracted Tasks to Firestore
        if (tasks && tasks.length > 0) {
          console.log(`   📋 Extracted ${tasks.length} tasks from BQ sheets. Importing...`);
          let batch = db.batch();
          let c = 0;
          for (const task of tasks) {
            const taskRef = db.collection("tasks").doc();
            batch.set(taskRef, {
              ...task,
              projectId: docRef.id,
              projectName: project.name,
              assignedTo: "Nor Ihsan Bin Abidin", // Default Consultant/Technical Officer
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            c++;
            importedTasksCount++;
            
            if (c % 400 === 0) {
              await batch.commit();
              batch = db.batch();
            }
          }
          await batch.commit();
          console.log(`   ✅ Imported ${c} tasks successfully.`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // IMPORT SITE DIARY REPORTS
    // -------------------------------------------------------------------------
    const reportsSubfolder = path.join(importsDir, "reports");
    let importedReportsCount = 0;

    if (fs.existsSync(reportsSubfolder)) {
      console.log("\n📝 Parsing files in 'excel_imports/reports'...");
      const files = fs.readdirSync(reportsSubfolder).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls"));
      
      for (const file of files) {
        const filePath = path.join(reportsSubfolder, file);
        console.log(`Parsing report file: ${file}`);
        
        const report = parseSiteDiaryFile(filePath);
        
        // Link to Project or Auto-create if not found
        const projectNameKey = report.projectName.toLowerCase();
        let projectMatch = projectNamesMap[projectNameKey];
        
        if (!projectMatch) {
          console.log(`   🛠️ Project "${report.projectName}" not found. Auto-creating project profile...`);
          const newProjPayload = {
            name: report.projectName,
            location: "Perai, Penang", // Inferred from Gudang Perai DC
            status: "active",
            progress: 80,
            startDate: "2025-03-03",
            endDate: "2025-06-03",
            priority: "medium",
            description: `Auto-created project profile for ${report.projectName}.`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          const newProjRef = await db.collection("projects").add(newProjPayload);
          projectMatch = {
            id: newProjRef.id,
            name: newProjPayload.name
          };
          projectNamesMap[projectNameKey] = projectMatch;
          importedProjectsCount++;
          console.log(`   ➕ Auto-created project: "${newProjPayload.name}" -> ID: ${newProjRef.id}`);
        }

        // Write report to Firestore
        await db.collection("reports").add({
          ...report,
          projectId: projectMatch.id,
          projectName: projectMatch.name,
          photoUrls: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        importedReportsCount++;
        console.log(`   ➕ Imported report: "${report.title}" linked to project ID: ${projectMatch.id}`);
      }
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log("🎉 SUCCESS: Data import completed successfully!");
    console.log(`👉 Projects Imported: ${importedProjectsCount}`);
    console.log(`👉 Tasks Imported: ${importedTasksCount}`);
    console.log(`👉 Reports Imported: ${importedReportsCount}`);
    console.log("========================================================");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Critical error during import execution:", error);
    process.exit(1);
  }
}

// Run the script
runImport();
