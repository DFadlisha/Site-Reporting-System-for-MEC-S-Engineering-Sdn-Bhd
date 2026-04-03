// src/components/tasks/TasksPage.js
import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, Edit2, X, Loader2,
  CheckSquare, Calendar, User, FolderOpen,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import {
  createProject, subscribeProjects, updateProject, deleteProject,
  createTask, subscribeTasks, updateTask, deleteTask,
} from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import "./TasksPage.css";

const STATUS_OPTIONS = ["todo", "inprogress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

export default function TasksPage() {
  const { profile } = useAuth();
  const isConsultant = profile?.role === "consultant";

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [selProject, setSelProject] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal]       = useState(false);
  const [editingTask, setEditingTask]           = useState(null);
  const [savingP, setSavingP] = useState(false);
  const [savingT, setSavingT] = useState(false);

  const [pForm, setPForm] = useState({ name: "", description: "", location: "", startDate: "", endDate: "", priority: "medium" });
  const [tForm, setTForm] = useState({ title: "", description: "", assignedTo: "", dueDate: "", priority: "medium", status: "todo" });

  useEffect(() => {
    const unsub = subscribeProjects(setProjects);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeTasks(selProject?.id || null, setTasks);
    return unsub;
  }, [selProject]);

  // Project CRUD
  const handleCreateProject = async (e) => {
    e.preventDefault();
    setSavingP(true);
    try {
      await createProject(pForm);
      toast.success("Project created!");
      setShowProjectModal(false);
      setPForm({ name: "", description: "", location: "", startDate: "", endDate: "", priority: "medium" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSavingP(false); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm("Delete this project?")) return;
    await deleteProject(id);
    if (selProject?.id === id) setSelProject(null);
    toast.success("Project deleted");
  };

  // Task CRUD
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!selProject) { toast.error("Select a project first"); return; }
    setSavingT(true);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, tForm);
        toast.success("Task updated");
      } else {
        await createTask({ ...tForm, projectId: selProject.id, projectName: selProject.name });
        toast.success("Task created");
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setTForm({ title: "", description: "", assignedTo: "", dueDate: "", priority: "medium", status: "todo" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSavingT(false); }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTForm({
      title: task.title, description: task.description,
      assignedTo: task.assignedTo, dueDate: task.dueDate,
      priority: task.priority, status: task.status,
    });
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(id);
    toast.success("Task deleted");
  };

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter((t) => t.status === taskFilter);

  return (
    <div>
      <Topbar title="Task Tracking" />
      <div className="page-body">

        {/* Projects strip */}
        <div className="tk-projects-bar">
          <div className="tk-projects-scroll">
            <button
              className={`tk-proj-chip ${!selProject ? "active" : ""}`}
              onClick={() => setSelProject(null)}
            >
              <FolderOpen size={14} /> All Projects
            </button>
            {projects.map((p) => (
              <div key={p.id} className="tk-proj-chip-wrap">
                <button
                  className={`tk-proj-chip ${selProject?.id === p.id ? "active" : ""}`}
                  onClick={() => setSelProject(p)}
                >
                  <FolderOpen size={14} /> {p.name}
                </button>
                {isConsultant && (
                  <button className="tk-proj-del" onClick={() => handleDeleteProject(p.id)}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {isConsultant && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowProjectModal(true)}>
              <Plus size={14} /> New Project
            </button>
          )}
        </div>

        {/* Tasks header */}
        <div className="page-header" style={{ marginTop: 20 }}>
          <div>
            <h2 className="page-title">
              {selProject ? selProject.name : "All Tasks"}
            </h2>
            <p className="page-subtitle">{filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="tk-actions">
            {/* Status filter */}
            <div className="tk-filter-tabs">
              {["all", ...STATUS_OPTIONS].map((s) => (
                <button
                  key={s}
                  className={`tk-filter-tab ${taskFilter === s ? "active" : ""}`}
                  onClick={() => setTaskFilter(s)}
                >
                  {s === "all" ? "All" : s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {isConsultant && (
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>
                <Plus size={14} /> Add Task
              </button>
            )}
          </div>
        </div>

        {/* Task grid */}
        {filteredTasks.length === 0 ? (
          <div className="tk-empty">
            <CheckSquare size={40} />
            <p>No tasks found</p>
          </div>
        ) : (
          <div className="tk-grid">
            {filteredTasks.map((task) => (
              <div key={task.id} className="tk-card card">
                <div className="tk-card-header">
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  <span className={`badge badge-${task.status}`}>
                    {task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : "Done"}
                  </span>
                </div>
                <h3 className="tk-card-title">{task.title}</h3>
                {task.description && <p className="tk-card-desc">{task.description}</p>}
                <div className="tk-card-meta">
                  {task.assignedTo && (
                    <span className="tk-meta-item"><User size={12} />{task.assignedTo}</span>
                  )}
                  {task.dueDate && (
                    <span className="tk-meta-item"><Calendar size={12} />{task.dueDate}</span>
                  )}
                  {task.projectName && (
                    <span className="tk-meta-item"><FolderOpen size={12} />{task.projectName}</span>
                  )}
                </div>
                {isConsultant && (
                  <div className="tk-card-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditTask(task)}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
                {!isConsultant && (
                  <div className="tk-card-actions">
                    <select
                      className="form-control"
                      style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value }).then(() => toast.success("Status updated"))}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Create New Project</div>
            <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input className="form-control" required value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="Residential Block A" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div className="form-group">
                <label className="form-label">Location / Site</label>
                <input className="form-control" value={pForm.location} onChange={(e) => setPForm({ ...pForm, location: e.target.value })} placeholder="Johor Bahru" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-control" value={pForm.startDate} onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-control" value={pForm.endDate} onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-control" value={pForm.priority} onChange={(e) => setPForm({ ...pForm, priority: e.target.value })}>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProjectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingP}>
                  {savingP ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingTask ? "Edit Task" : "Create New Task"}</div>
            <form onSubmit={handleSaveTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input className="form-control" required value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} placeholder="Install structural reinforcements" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={tForm.description} onChange={(e) => setTForm({ ...tForm, description: e.target.value })} placeholder="Task details..." />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input className="form-control" value={tForm.assignedTo} onChange={(e) => setTForm({ ...tForm, assignedTo: e.target.value })} placeholder="Ahmad bin Ali" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={tForm.priority} onChange={(e) => setTForm({ ...tForm, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={tForm.status} onChange={(e) => setTForm({ ...tForm, status: e.target.value })}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-control" value={tForm.dueDate} onChange={(e) => setTForm({ ...tForm, dueDate: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingT}>
                  {savingT ? <Loader2 size={16} className="spin" /> : null}
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
