/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const db = admin.firestore();

// Helper to write to the audit collection
async function writeAuditLog(entityType, entityId, action, userId, changes, snapshot) {
  try {
    await db.collection("audit_logs").add({
      entityType,
      entityId,
      action,
      userId: userId || "SYSTEM",
      changes: changes || null,
      snapshot: snapshot || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Audit log created: ${action} on ${entityType} ${entityId}`);
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

// ─── PROJECT AUDITS ────────────────────────────────────────────────────────
exports.onProjectCreated = functions.firestore
  .document("projects/{projectId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await writeAuditLog("PROJECT", context.params.projectId, "CREATE", null, null, data);
  });

exports.onProjectUpdated = functions.firestore
  .document("projects/{projectId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Calculate differences
    const changes = {};
    for (const key in after) {
      if (after[key] !== before[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }
    
    await writeAuditLog("PROJECT", context.params.projectId, "UPDATE", null, changes, after);
  });

exports.onProjectDeleted = functions.firestore
  .document("projects/{projectId}")
  .onDelete(async (snap, context) => {
    await writeAuditLog("PROJECT", context.params.projectId, "DELETE", null, null, snap.data());
  });

// ─── TASK AUDITS ───────────────────────────────────────────────────────────
exports.onTaskCreated = functions.firestore
  .document("tasks/{taskId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await writeAuditLog("TASK", context.params.taskId, "CREATE", data.assignedTo, null, data);
  });

exports.onTaskUpdated = functions.firestore
  .document("tasks/{taskId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    const changes = {};
    for (const key in after) {
      if (after[key] !== before[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }
    
    await writeAuditLog("TASK", context.params.taskId, "UPDATE", after.assignedTo, changes, after);
  });

exports.onTaskDeleted = functions.firestore
  .document("tasks/{taskId}")
  .onDelete(async (snap, context) => {
    await writeAuditLog("TASK", context.params.taskId, "DELETE", null, null, snap.data());
  });

// ─── ISSUE AUDITS ──────────────────────────────────────────────────────────
exports.onIssueCreated = functions.firestore
  .document("issues/{issueId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await writeAuditLog("ISSUE", context.params.issueId, "CREATE", null, null, data);
  });

exports.onIssueUpdated = functions.firestore
  .document("issues/{issueId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    const changes = {};
    for (const key in after) {
      if (after[key] !== before[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }
    
    await writeAuditLog("ISSUE", context.params.issueId, "UPDATE", null, changes, after);
  });

exports.onIssueDeleted = functions.firestore
  .document("issues/{issueId}")
  .onDelete(async (snap, context) => {
    await writeAuditLog("ISSUE", context.params.issueId, "DELETE", null, null, snap.data());
  });

// ─── REPORT AUDITS ─────────────────────────────────────────────────────────
exports.onReportCreated = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await writeAuditLog("REPORT", context.params.reportId, "CREATE", null, null, data);
  });

exports.onReportUpdated = functions.firestore
  .document("reports/{reportId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    const changes = {};
    for (const key in after) {
      if (after[key] !== before[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }
    
    await writeAuditLog("REPORT", context.params.reportId, "UPDATE", null, changes, after);
  });

exports.onReportDeleted = functions.firestore
  .document("reports/{reportId}")
  .onDelete(async (snap, context) => {
    await writeAuditLog("REPORT", context.params.reportId, "DELETE", null, null, snap.data());
  });

// ─── USER ROLE AUDITS ──────────────────────────────────────────────────────
exports.onUserRoleUpdated = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (before.role !== after.role) {
      const changes = {
        role: { from: before.role, to: after.role }
      };
      await writeAuditLog("USER_ROLE", context.params.userId, "UPDATE", null, changes, after);
    }
  });
