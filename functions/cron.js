/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const db = admin.firestore();

// ─── SCHEDULED JOBS (CRON) ─────────────────────────────────────────────────

// Run every Friday at 5:00 PM
exports.weeklyProgressSummary = functions.pubsub.schedule("0 17 * * 5")
  .timeZone("Asia/Kuala_Lumpur") // Malaysia Time
  .onRun(async (context) => {
    console.log("Running weekly progress summary generation...");
    
    try {
      const projectsSnap = await db.collection("projects").get();
      
      const batch = db.batch();
      
      for (const doc of projectsSnap.docs) {
        const project = doc.data();
        
        // Fetch tasks completed this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const tasksSnap = await db.collection("tasks")
          .where("projectId", "==", doc.id)
          .where("updatedAt", ">=", admin.firestore.Timestamp.fromDate(oneWeekAgo))
          .get();
          
        let completedThisWeek = 0;
        tasksSnap.forEach(taskDoc => {
          if (taskDoc.data().status === "done") completedThisWeek++;
        });

        // Insert summary document
        const summaryRef = db.collection("projects").doc(doc.id).collection("weekly_summaries").doc();
        batch.set(summaryRef, {
          weekEnding: admin.firestore.FieldValue.serverTimestamp(),
          projectProgress: project.progress || 0,
          tasksCompletedThisWeek: completedThisWeek,
          totalTasks: tasksSnap.size
        });
      }
      
      await batch.commit();
      console.log("Weekly summaries generated successfully.");
      
    } catch (error) {
      console.error("Failed to generate weekly summaries:", error);
    }
  });

// Run every morning at 8:00 AM to automatically clean up orphaned data
exports.dailyDataCleanup = functions.pubsub.schedule("0 8 * * *")
  .timeZone("Asia/Kuala_Lumpur")
  .onRun(async (context) => {
    console.log("Running daily cleanup routine...");
    
    try {
      // Find all tasks where projects might have been deleted
      const tasksSnap = await db.collection("tasks").get();
      let orphanedTasks = 0;
      
      for (const doc of tasksSnap.docs) {
        const task = doc.data();
        const projectDoc = await db.collection("projects").doc(task.projectId).get();
        if (!projectDoc.exists) {
          await db.collection("tasks").doc(doc.id).delete();
          orphanedTasks++;
        }
      }
      
      console.log(`Cleanup complete. Deleted ${orphanedTasks} orphaned tasks.`);
    } catch (error) {
      console.error("Cleanup routine failed:", error);
    }
  });
