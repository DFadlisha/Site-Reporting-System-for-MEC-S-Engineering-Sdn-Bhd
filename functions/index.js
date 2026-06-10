/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// ─── 1. PUSH NOTIFICATIONS ────────────────────────────────────

// Notify users when a new Report is created
exports.notifyNewReport = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snap) => {
    const report = snap.data();

    const usersSnap = await db.collection("users")
      .where("fcmToken", "!=", null).get();

    const tokens = [];
    usersSnap.forEach((doc) => {
      const user = doc.data();
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    });

    if (tokens.length === 0) {
      console.log("No FCM tokens found.");
      return null;
    }

    const title =
      `New Report: ${report.title || "Site Update"}`;
    const body =
      `Project: ${report.projectName || "Unknown"}`;

    try {
      const res = await admin.messaging()
        .sendEachForMulticast({
          tokens,
          notification: { title, body },
        });
      console.log("Sent notifications:", res);
    } catch (err) {
      console.error("FCM error:", err);
    }
    return null;
  });

// Notify users when a new Issue is created
exports.notifyNewIssue = functions.firestore
  .document("issues/{issueId}")
  .onCreate(async (snap) => {
    const issue = snap.data();

    const usersSnap = await db.collection("users")
      .where("fcmToken", "!=", null).get();

    const tokens = [];
    usersSnap.forEach((doc) => {
      const user = doc.data();
      if (user.fcmToken) tokens.push(user.fcmToken);
    });

    if (tokens.length === 0) return null;

    const title =
      `Issue: ${issue.title || "New Issue"}`;
    const body =
      `Severity: ${issue.severity || "N/A"}`;

    return admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });
  });

// ─── 2. AUTO PROJECT PROGRESS ─────────────────────────────────

// Recalculate project progress when tasks change
exports.updateProjectProgress = functions.firestore
  .document("tasks/{taskId}")
  .onWrite(async (change) => {
    const docData = change.after.exists ?
      change.after.data() :
      change.before.data();
    const projectId = docData.projectId;

    if (!projectId) return null;

    const tasksSnap = await db.collection("tasks")
      .where("projectId", "==", projectId).get();

    if (tasksSnap.empty) {
      return db.collection("projects")
        .doc(projectId)
        .update({ progress: 0 });
    }

    let total = 0;
    let done = 0;

    tasksSnap.forEach((doc) => {
      total++;
      if (doc.data().status === "done") {
        done++;
      }
    });

    const progress =
      Math.round((done / total) * 100);

    console.log(
      `Project ${projectId}: ${progress}%`
    );

    return db.collection("projects")
      .doc(projectId)
      .update({ progress });
  });

// ─── 3. USER MANAGEMENT ───────────────────────────────────────

// Log new user creation
exports.onUserCreated = functions.auth
  .user()
  .onCreate(async (user) => {
    console.log(
      `New user: ${user.email} (${user.uid})`
    );
  });

// Cleanup Firestore when user is deleted
exports.onUserDeleted = functions.auth
  .user()
  .onDelete(async (user) => {
    console.log(
      `Cleaning up user: ${user.uid}`
    );
    const qs = await db.collection("users")
      .where("uid", "==", user.uid).get();
    const batch = db.batch();
    qs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    return batch.commit();
  });

// Notify user when their account is approved
exports.onUserStatusChanged = functions.firestore
  .document("users/{docId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if status changed from pending to approved
    if (before.status === "pending" && after.status === "approved") {
      console.log(`Sending approval email to: ${after.email}`);
      
      const roleStr = after.role || "supervisor";
      const messageText = `Hello ${after.name},\n\nYou are ${roleStr} and you're registered successfully.\n\nWelcome to SPRS!`;
      const messageHtml = `<p>Hello ${after.name},</p><p>You are <strong>${roleStr}</strong> and you're registered successfully.</p><p>Welcome to SPRS!</p>`;

      // Send email via Firebase Trigger Email extension (writes to 'mail' collection)
      return db.collection("mail").add({
        to: after.email,
        message: {
          subject: "Account Approved - SPRS",
          text: messageText,
          html: messageHtml
        }
      });
    }
    return null;
  });



// ─── 5. ENTERPRISE MODULE EXPORTS ───────────────────────────────────────────
const apiModule = require("./api");
const auditModule = require("./audit");
const cronModule = require("./cron");
const rbacModule = require("./rbac");
const exportsModule = require("./exports_pdf");
const inventoryModule = require("./inventory");

// Export REST APIs
exports.api = apiModule.api;

// Export Audit Triggers
exports.audit = auditModule;

// Export Cron Jobs
exports.cron = cronModule;

// Export RBAC Security Triggers
exports.rbac = rbacModule;

// Export Aggregation Utilities
exports.reportsHelper = exportsModule;



// Export Inventory and Forecasting Logic
exports.inventory = inventoryModule;

