/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

const db = admin.firestore();

// Initialize Express App
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ─── MIDDLEWARE: AUTHENTICATION ────────────────────────────────────────────
// Ensure all API calls are authenticated with a Firebase JWT token
const authMiddleware = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Bearer Token" });
  }

  const token = req.headers.authorization.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid Token" });
  }
};

// Apply auth middleware to all routes
app.use(authMiddleware);

// ─── API: PROJECTS ─────────────────────────────────────────────────────────

// GET /api/projects - Retrieve all projects
app.get("/api/projects", async (req, res) => {
  try {
    const snapshot = await db.collection("projects").orderBy("createdAt", "desc").get();
    const projects = [];
    snapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json({ data: projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// GET /api/projects/:id - Retrieve a specific project
app.get("/api/projects/:id", async (req, res) => {
  try {
    const docRef = db.collection("projects").doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: "Project Not Found" });
    }
    
    return res.status(200).json({ data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/projects - Create a project
app.post("/api/projects", async (req, res) => {
  try {
    const { name, location, status } = req.body;
    
    if (!name || !location) {
      return res.status(400).json({ error: "Bad Request: Missing required fields (name, location)" });
    }

    const payload = {
      name,
      location,
      status: status || "active",
      progress: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("projects").add(payload);
    return res.status(201).json({ data: { id: docRef.id, ...payload, createdAt: new Date() } });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/projects/:id - Update a project
app.put("/api/projects/:id", async (req, res) => {
  try {
    const { name, location, status, progress } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (status) updateData.status = status;
    if (progress !== undefined) updateData.progress = progress;
    
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("projects").doc(req.params.id).update(updateData);
    
    return res.status(200).json({ message: "Project updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Delete a project
app.delete("/api/projects/:id", async (req, res) => {
  try {
    await db.collection("projects").doc(req.params.id).delete();
    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete project" });
  }
});

// ─── API: TASKS ────────────────────────────────────────────────────────────

// GET /api/tasks?projectId=XYZ
app.get("/api/tasks", async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = db.collection("tasks").orderBy("createdAt", "desc");
    
    if (projectId) {
      query = db.collection("tasks").where("projectId", "==", projectId).orderBy("createdAt", "desc");
    }

    const snapshot = await query.get();
    const tasks = [];
    snapshot.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));
    
    return res.status(200).json({ data: tasks });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST /api/tasks
app.post("/api/tasks", async (req, res) => {
  try {
    const { projectId, title, assignedTo, status } = req.body;
    
    if (!projectId || !title) {
      return res.status(400).json({ error: "Missing projectId or title" });
    }

    const payload = {
      projectId,
      title,
      assignedTo: assignedTo || "Unassigned",
      status: status || "todo",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("tasks").add(payload);
    return res.status(201).json({ data: { id: docRef.id, ...payload } });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── API: WORKER METRICS (ANALYTICS ENDPOINT) ──────────────────────────────
// This is a complex endpoint that aggregates completion rates.
app.get("/api/analytics/workers", async (req, res) => {
  try {
    const tasksSnap = await db.collection("tasks").get();
    const workerStats = {};

    tasksSnap.forEach((doc) => {
      const task = doc.data();
      const worker = task.assignedTo || "Unassigned";

      if (!workerStats[worker]) {
        workerStats[worker] = { totalTasks: 0, completedTasks: 0, completionRate: 0 };
      }

      workerStats[worker].totalTasks++;
      if (task.status === "done") {
        workerStats[worker].completedTasks++;
      }
    });

    for (const worker in workerStats) {
      const stats = workerStats[worker];
      if (stats.totalTasks > 0) {
        stats.completionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100);
      }
    }

    return res.status(200).json({ data: workerStats });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Export the express app as a Firebase HTTPS Callable function
exports.api = functions.https.onRequest(app);
