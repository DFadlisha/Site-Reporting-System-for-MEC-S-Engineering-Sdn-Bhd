/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const db = admin.firestore();

// ─── ENTERPRISE REPORT AGGREGATION & EXPORT LOGIC ─────────────────────────────

/**
 * Advanced backend logic to compile enormous JSON datasets spanning multiple collections
 * to prepare them for PDF/Excel generation on the client-side or third-party servers.
 */

// Callable backend function to generate a "Monthly Master Report"
exports.generateMonthlyMasterReport = functions.https.onCall(async (data, context) => {
  // 1. Verify User Authority
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to generate master reports.");
  }

  const projectId = data.projectId;
  if (!projectId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing projectId in generation request.");
  }

  try {
    console.log(`Starting massive data aggregation for project: ${projectId}`);
    
    // 2. Fetch Core Project Data
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      throw new functions.https.HttpsError("not-found", "The specified project does not exist.");
    }
    const projectData = projectDoc.data();

    // 3. Time bounds (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startTimestamp = admin.firestore.Timestamp.fromDate(firstDay);
    const endTimestamp = admin.firestore.Timestamp.fromDate(lastDay);

    // 4. Fetch Tasks in parallel
    const tasksPromise = db.collection("tasks")
      .where("projectId", "==", projectId)
      .get();
      
    // 5. Fetch Daily Reports in parallel
    const reportsPromise = db.collection("reports")
      .where("projectId", "==", projectId)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .get();

    // 6. Fetch Issues in parallel
    const issuesPromise = db.collection("issues")
      .where("projectId", "==", projectId)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .get();

    // 7. Resolve all massive database queries
    const [tasksSnap, reportsSnap, issuesSnap] = await Promise.all([tasksPromise, reportsPromise, issuesPromise]);

    // 8. Compile the aggregate dataset
    const compiledData = {
      projectDetails: {
        name: projectData.name,
        location: projectData.location,
        totalProgress: projectData.progress,
        status: projectData.status
      },
      timeframe: {
        month: now.toLocaleString("default", { month: "long" }),
        year: now.getFullYear()
      },
      metrics: {
        totalTasks: tasksSnap.size,
        completedTasks: 0,
        pendingTasks: 0,
        totalIssues: issuesSnap.size,
        resolvedIssues: 0,
        criticalIssues: 0,
        totalReportsFiled: reportsSnap.size
      },
      breakdowns: {
        tasks: [],
        issues: [],
        reportsHighlight: []
      }
    };

    // 9. Process Task Metrics
    tasksSnap.forEach(doc => {
      const t = doc.data();
      compiledData.breakdowns.tasks.push({ id: doc.id, title: t.title, status: t.status });
      if (t.status === "done") compiledData.metrics.completedTasks++;
      else compiledData.metrics.pendingTasks++;
    });

    // 10. Process Issue Metrics
    issuesSnap.forEach(doc => {
      const i = doc.data();
      compiledData.breakdowns.issues.push({ id: doc.id, title: i.title, severity: i.severity, status: i.status });
      if (i.status === "resolved") compiledData.metrics.resolvedIssues++;
      if (i.severity === "high" || i.severity === "critical") compiledData.metrics.criticalIssues++;
    });

    // 11. Extract key report highlights (top 5 most recent)
    const reportsArray = [];
    reportsSnap.forEach(doc => reportsArray.push({ id: doc.id, ...doc.data() }));
    // Sort by date descending
    reportsArray.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
    compiledData.breakdowns.reportsHighlight = reportsArray.slice(0, 5).map(r => ({
      date: r.date,
      title: r.title,
      description: r.description
    }));

    // 12. Save Compilation Log 
    await db.collection("export_logs").add({
      projectId: projectId,
      requestedBy: context.auth.uid,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      documentType: "MONTHLY_MASTER_REPORT",
      sizeMetrics: compiledData.metrics
    });

    console.log(`Successfully compiled Master Report payload for ${projectId}`);
    
    // Return heavy JSON payload to client stringified to save bandwidth (mock compression)
    return {
      status: "success",
      payloadSize: JSON.stringify(compiledData).length, // Return byte approximation
      generationDate: now.toISOString(),
      data: compiledData
    };

  } catch (err) {
    console.error("Master Report Generation Error:", err);
    throw new functions.https.HttpsError("internal", "Failed to compile the master report.", err.message);
  }
});
