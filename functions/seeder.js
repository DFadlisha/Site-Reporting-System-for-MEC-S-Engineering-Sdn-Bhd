/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const db = admin.firestore();

// ─── ENTERPRISE DATA WAREHOUSE SEEDER ──────────────────────────────────────

/**
 * Generates an exorbitant amount of realistic historical data across 12 months.
 * Useful for PSM 2 presentation demonstrations showcasing heavy analytics logic.
 */

const CONSTRUCTION_TERMS = [
  "Excavation", "Foundation Pouring", "Rebar Installation", "Scaffolding Assembly",
  "Concrete Curing", "Structural Framing", "HVAC Routing", "Electrical Wiring",
  "Plumbing Riser Installation", "Drywall Hanging", "Painting & Texturing", "Roofing",
  "Site Grading", "Paving", "Landscaping", "Final Inspection Clearance"
];

const ISSUE_DESCRIPTIONS = [
  "Delayed concrete delivery due to traffic conditions.",
  "Heavy thunderstorm paused all crane operations for 4 hours.",
  "Failed safety inspection on level 4 scaffolding.",
  "Shortage of grade-A steel reinforcements from primary supplier.",
  "Worker injury reported during rebar cutting. OSHA protocol initiated.",
  "Subcontractor dispute causing 2-day delay on plumbing loop.",
  "Elevator shaft measurements misaligned by 2 inches. Rework required.",
  "City permit for road closure unexpectedly revoked by council."
];

const WORKER_NAMES = [
  "Ahmad Faizal", "John Doe", "Jane Smith", "Muthu Subramaniam", "Lim Wei Jie",
  "Arun Kumar", "Sarah Abdullah", "Daniel Wong", "Mohd Hafiz", "Siti Nurhaliza",
  "Vikram Singh", "Chloe Tan", "Amirul Amin", "Lisa Chong", "Kevin O'Connor"
];

exports.seedHistoricalData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Denied.");

  const batchSize = 450; // Firestore batch limit is 500
  let batch = db.batch();
  let operationCount = 0;
  
  const commitBatch = async () => {
    if (operationCount > 0) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  };

  try {
    console.log("Initiating Master Seeder Script...");

    // 1. Generate 10 Heavy Projects
    const projects = [];
    for (let i = 1; i <= 10; i++) {
      const pRef = db.collection("projects").doc();
      const payload = {
        name: `Gov Infra Project Phase ${i}`,
        location: `Parcel ${String.fromCharCode(64 + i)}, Cyberjaya`,
        status: i % 3 === 0 ? "completed" : "active",
        progress: i % 3 === 0 ? 100 : Math.floor(Math.random() * 80) + 10,
        budgetAllocated: 5000000 + (Math.random() * 10000000),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(pRef, payload);
      projects.push({ id: pRef.id, ...payload });
      operationCount++;
      if (operationCount >= batchSize) await commitBatch();
    }

    // 2. Generate 50 Tasks per Project (Total 500 Tasks)
    const allTasks = [];
    for (const project of projects) {
      for (let t = 0; t < 50; t++) {
        const tRef = db.collection("tasks").doc();
        const randTerm = CONSTRUCTION_TERMS[Math.floor(Math.random() * CONSTRUCTION_TERMS.length)];
        const isDone = Math.random() > 0.5;
        
        const payload = {
          projectId: project.id,
          title: `Zone ${Math.floor(t/10) + 1} - ${randTerm}`,
          status: project.status === "completed" ? "done" : (isDone ? "done" : "inprogress"),
          assignedTo: WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)],
          priority: Math.random() > 0.8 ? "high" : "normal",
          estimatedHours: Math.floor(Math.random() * 40) + 4,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(tRef, payload);
        allTasks.push({ id: tRef.id, ...payload });
        operationCount++;
        if (operationCount >= batchSize) await commitBatch();
      }
    }

    // 3. Generate 30 Issues per Project (Total 300 Issues)
    for (const project of projects) {
      for (let i = 0; i < 30; i++) {
        const iRef = db.collection("issues").doc();
        const severityArr = ["low", "medium", "high", "critical"];
        const randSev = severityArr[Math.floor(Math.random() * severityArr.length)];
        const isResolved = Math.random() > 0.3; // 70% resolved
        
        const payload = {
          projectId: project.id,
          title: `Site Flag #${i+1}: ${ISSUE_DESCRIPTIONS[Math.floor(Math.random() * ISSUE_DESCRIPTIONS.length)].split(' ')[0]} Alert`,
          description: ISSUE_DESCRIPTIONS[Math.floor(Math.random() * ISSUE_DESCRIPTIONS.length)],
          severity: randSev,
          status: project.status === "completed" ? "resolved" : (isResolved ? "resolved" : "open"),
          reportedBy: WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(iRef, payload);
        operationCount++;
        if (operationCount >= batchSize) await commitBatch();
      }
    }

    // 4. Generate Daily Reports over the last 180 days for active projects (Massive Loop)
    // Roughly ~1000 reports
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const project of projects) {
      if (project.status === "completed") continue; // Skip completed for report generation

      for (let day = 0; day < 180; day++) {
        // Only 40% probability a report was filed on any given day past
        if (Math.random() > 0.4) continue; 

        let reportDate = new Date(now - (day * MS_PER_DAY));
        const rRef = db.collection("reports").doc();
        
        // Pick 2 random workers
        const presentWorkers = `${WORKER_NAMES[Math.floor(Math.random()*WORKER_NAMES.length)]}, ${WORKER_NAMES[Math.floor(Math.random()*WORKER_NAMES.length)]}`;

        const payload = {
          projectId: project.id,
          projectName: project.name,
          title: `Daily Log - ${reportDate.toISOString().split("T")[0]}`,
          date: reportDate.toISOString().split("T")[0],
          description: `Conducted routine tasks. Focused heavily on ${CONSTRUCTION_TERMS[Math.floor(Math.random() * CONSTRUCTION_TERMS.length)]}. Weather condition was optimal.`,
          workforce: String(Math.floor(Math.random() * 50) + 10),
          equipment: `${Math.floor(Math.random() * 5)} Cranes, ${Math.floor(Math.random() * 10)} Excavators`,
          status: "approved",
          createdAt: admin.firestore.Timestamp.fromDate(reportDate)
        };

        batch.set(rRef, payload);
        operationCount++;
        if (operationCount >= batchSize) await commitBatch();
      }
    }

    // 5. Generate Inventory Catalog Data (50 items)
    const MATERIAL_TYPES = ["Steel", "Concrete", "Wood", "Glass", "Wiring", "Pipes", "Tiles", "Paint"];
    for (let inv = 0; inv < 50; inv++) {
      const invRef = db.collection("inventory").doc();
      const type = MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)];
      const payload = {
        sku: `SKU-${Math.floor(Math.random() * 9000) + 1000}`,
        name: `Industrial Grade ${type} Batch ${inv}`,
        category: type,
        quantityInStock: Math.floor(Math.random() * 10000),
        unit: type === "Concrete" || type === "Paint" ? "Liters" : "Units",
        reorderThreshold: Math.floor(Math.random() * 1000),
        costPerUnit: (Math.random() * 500).toFixed(2),
        lastRestocked: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(invRef, payload);
      operationCount++;
      if (operationCount >= batchSize) await commitBatch();
    }

    // 6. Push any remaining operations
    await commitBatch();

    console.log("Master Seeder Script Execution Completed Successfully.");
    return { success: true, message: "Exorbitant historical data generated successfully!" };

  } catch (error) {
    console.error("Master seeder completely failed:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// A small utility function to clear the DB
exports.clearTenantData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Nonsense");
  
  // Danger path: requires explicit admin confirmation flag
  if (data.confirmation !== "UNDERSTAND_PERMANENT_DELETION") {
    throw new functions.https.HttpsError("invalid-argument", "Missing safety flag");
  }

  const collections = ["projects", "tasks", "issues", "reports", "inventory", "audit_logs", "security_alerts"];
  
  for (const col of collections) {
    const snap = await db.collection(col).get();
    let localBatch = db.batch();
    let lc = 0;
    
    for (const doc of snap.docs) {
      localBatch.delete(doc.ref);
      lc++;
      if (lc >= 450) {
        await localBatch.commit();
        localBatch = db.batch();
        lc = 0;
      }
    }
    if (lc > 0) await localBatch.commit();
  }
  
  return { success: true, removedCollections: collections };
});

// Mock Third-party Webhook receiver
exports.vendorWebhookHandler = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  
  const apiKey = req.headers["x-vendor-key"];
  if (apiKey !== "SECURE_WEBHOOK_KEY") return res.status(401).send("Unauthorized");

  const vendorPayload = req.body;
  if (!vendorPayload.eventId) return res.status(400).send("Bad Request");

  try {
    await db.collection("vendor_logs").add({
      vendor: vendorPayload.source || "Unknown",
      eventId: vendorPayload.eventId,
      rawPayload: JSON.stringify(vendorPayload),
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(200).send("Logged correctly");
  } catch (e) {
    res.status(500).send("Database failure");
  }
});
