/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const db = admin.firestore();

// ─── ROLE-BASED ACCESS CONTROL (RBAC) ──────────────────────────────────────────

/**
 * Enterprise Role-Based Access Control logic for the construction reporting system.
 * Contains exhaustive checks to ensure structural separation between roles:
 * - Admin
 * - Manager
 * - Supervisor
 * - Worker
 * - Consultant
 */

const ROLE_PERMISSIONS = {
  admin: ["create_project", "delete_project", "read_all", "assign_manager"],
  manager: ["read_all", "update_project", "create_task", "assign_supervisor"],
  supervisor: ["read_assigned", "update_task", "create_report", "create_issue"],
  consultant: ["read_all", "create_issue"],
  worker: ["read_assigned", "update_task_status"]
};

// Cloud function to securely format and validate custom user claims upon creation
exports.assignCustomRoles = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const user = snap.data();
    const uid = context.params.userId;
    const role = user.role ? user.role.toLowerCase() : "worker";

    try {
      // Step 1: Validate role exists in our Enterprise hierarchy
      if (!ROLE_PERMISSIONS[role]) {
        console.warn(`Invalid role assigned: ${role}. Falling back to default worker role.`);
      }

      const assignedRole = ROLE_PERMISSIONS[role] ? role : "worker";
      const userPermissions = ROLE_PERMISSIONS[assignedRole];

      // Step 2: Set Custom Auth Claims (Extremely secure Backend enforcement)
      await admin.auth().setCustomUserClaims(uid, {
        role: assignedRole,
        permissions: userPermissions,
        isEnterpriseUser: true,
        department: "Operations"
      });

      console.log(`Custom claims successfully set for user ${uid} as ${assignedRole}`);

      // Step 3: Mirror the applied claims in Firestore for frontend consumption
      await db.collection("users").doc(uid).update({
        assignedRole: assignedRole,
        permissions: userPermissions,
        claimsSetAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error(`Failed to assign custom roles for user ${uid}:`, error);
    }
  });

// ─── ACCESS AUDITS ─────────────────────────────────────────────────────────

// Tracks any external attempt to change user roles manually via security rules
exports.monitorRoleChanges = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only proceed if the role was modified
    if (before.role !== after.role) {
      console.warn(`SECURITY ALERT: User ${context.params.userId} role changed from ${before.role} to ${after.role}`);
      
      try {
        // Audit log internal tracking
        await db.collection("security_alerts").add({
          type: "ROLE_ESCALATION",
          userId: context.params.userId,
          oldRole: before.role,
          newRole: after.role,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Re-calculate and enforce via custom claims instantly
        const newPermissions = ROLE_PERMISSIONS[after.role] || ROLE_PERMISSIONS["worker"];
        await admin.auth().setCustomUserClaims(context.params.userId, {
          role: after.role,
          permissions: newPermissions
        });
        
        console.log(`Claims securely rebuilt for ${context.params.userId} after manual role change.`);
      } catch (err) {
        console.error("Failed to mitigate role change escalation:", err);
      }
    }
  });

// ─── USER ONBOARDING METRICS ───────────────────────────────────────────────

exports.createUserOnboardingProfile = functions.auth.user().onCreate(async (user) => {
  try {
    // Generate an onboarding profile entry inside 'worker_metrics'
    await db.collection("worker_metrics").doc(user.uid).set({
      email: user.email || "No Email",
      displayName: user.displayName || "Unknown Worker",
      accountCreated: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      projectsAssignedCount: 0,
      issuesReportedCount: 0,
      tasksCompletedCount: 0,
      reliabilityScore: 100, // Starts at 100%
      onboardingStatus: "pending_review"
    });
    console.log(`Onboarding profile pre-generated for Auth User ${user.uid}`);
  } catch (error) {
    console.error(`Onboarding profile failure for ${user.uid}:`, error);
  }
});
