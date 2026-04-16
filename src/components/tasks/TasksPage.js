// src/components/tasks/TasksPage.js
import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, Edit2, X, Loader2,
  CheckSquare, Calendar, User, FolderOpen, Clock, Eye,
  Search, Filter, Paperclip, MessageSquare, MoreVertical, Info, FileText, Download,
  MapPin, ChevronDown
} from "lucide-react";
import Topbar from "../shared/Topbar";
import {
  createProject, subscribeProjects, updateProject, deleteProject,
  createTask, subscribeTasks, updateTask, deleteTask,
  getSystemUsers, createNotification,
} from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import "./TasksPage.css";

const STATUS_OPTIONS = ["todo", "inprogress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

export default function TasksPage() {
  const { profile, user } = useAuth();
  const role = profile?.role?.toLowerCase() || "";
  const isConsultant = role === "consultant";
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";

  // ── Flowchart role permissions ──────────────────────────────────
  // Consultant: Manage projects & tasks → Create tasks, Assign to supervisor
  // Supervisor: View assigned tasks → Check status, View deadlines (update status only)
  // Admin: Full access
  const canManageProjects = isConsultant || isAdmin;
  const canManageTasks = isConsultant || isAdmin;

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [selProject, setSelProject] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [supervisors, setSupervisors] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false); // Combined Project + Task form
  const [showTaskModal, setShowTaskModal]       = useState(false);  // Edit single task
  const [editingTask, setEditingTask]           = useState(null);
  const [saving, setSaving] = useState(false);

  // Combined Project + Task form (per wireframe)
  const [pForm, setPForm] = useState({
    name: "", description: "", location: "", startDate: "", endDate: "", priority: "",
  });
  const [tForm, setTForm] = useState({
    title: "", assignedTo: "", assignedToUid: "", dueDate: "", site: "", status: "",
  });

  // Edit-only task form
  const [editTForm, setEditTForm] = useState({
    title: "", description: "", assignedTo: "", assignedToUid: "", dueDate: "", priority: "medium", status: "todo",
  });

  useEffect(() => {
    const unsub = subscribeProjects(setProjects);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeTasks(selProject?.id || null, setTasks);
    return unsub;
  }, [selProject]);

  // Load supervisor list so consultant can assign tasks to supervisors
  useEffect(() => {
    if (canManageTasks) {
      getSystemUsers().then(users => {
        setSupervisors(users.filter(u => u.role === "supervisor"));
      }).catch(() => {});
    }
  }, [canManageTasks]);

  // ── For Supervisor: filter tasks to only those assigned to them ──
  const visibleTasks = isSupervisor
    ? tasks.filter(t => t.assignedTo === profile?.name || t.assignedToUid === user?.uid)
    : tasks;

  // ── Combined Project + Task Submit (per wireframe) ──────────────
  const handleCreateProjectWithTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Step 1: Create the project
      const projectData = { ...pForm, priority: pForm.priority || "medium" };
      const projectRef = await createProject(projectData);
      const projectId = projectRef.id;

      // Step 2: Create the initial task if task name is filled
      if (tForm.title.trim()) {
        await createTask({
          title: tForm.title,
          assignedTo: tForm.assignedTo,
          assignedToUid: tForm.assignedToUid,
          dueDate: tForm.dueDate,
          site: tForm.site,
          status: tForm.status || "todo",
          priority: pForm.priority || "medium",
          projectId: projectId,
          projectName: pForm.name,
        });

        // Notify the assigned supervisor
        if (tForm.assignedToUid) {
          await createNotification(
            tForm.assignedToUid,
            `New task assigned: "${tForm.title}" in project "${pForm.name}".`,
            "info"
          );
        }
      }

      toast.success("Project created with task!");
      setShowProjectModal(false);
      setPForm({ name: "", description: "", location: "", startDate: "", endDate: "", priority: "" });
      setTForm({ title: "", assignedTo: "", assignedToUid: "", dueDate: "", site: "", status: "" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm("Delete this project?")) return;
    await deleteProject(id);
    if (selProject?.id === id) setSelProject(null);
    toast.success("Project deleted");
  };

  // ── Edit Task (separate modal) ──────────────────────────────────
  const handleEditTask = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    try {
      await updateTask(editingTask.id, editTForm);
      toast.success("Task updated");
      setShowTaskModal(false);
      setEditingTask(null);
      setEditTForm({ title: "", description: "", assignedTo: "", assignedToUid: "", dueDate: "", priority: "medium", status: "todo" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  // ── Add Task to existing project ────────────────────────────────
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [addTForm, setAddTForm] = useState({ title: "", assignedTo: "", assignedToUid: "", dueDate: "", site: "", status: "todo", priority: "medium" });

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!selProject) { toast.error("Select a project first"); return; }
    setSaving(true);
    try {
      await createTask({
        ...addTForm,
        projectId: selProject.id,
        projectName: selProject.name,
      });
      // Notify the assigned supervisor
      if (addTForm.assignedToUid) {
        await createNotification(
          addTForm.assignedToUid,
          `New task assigned: "${addTForm.title}" in project "${selProject.name}".`,
          "info"
        );
      }
      toast.success("Task created & assigned!");
      setShowAddTaskModal(false);
      setAddTForm({ title: "", assignedTo: "", assignedToUid: "", dueDate: "", site: "", status: "todo", priority: "medium" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setEditTForm({
      title: task.title, description: task.description || "",
      assignedTo: task.assignedTo, assignedToUid: task.assignedToUid || "",
      dueDate: task.dueDate || "",
      priority: task.priority || "medium", status: task.status,
    });
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(id);
    toast.success("Task deleted");
  };

  // ── Supervisor: update task status with completion date ─────────
  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      const updates = { status: newStatus };
      if (newStatus === 'done') {
        updates.completedAt = new Date().toISOString();
      } else {
        updates.completedAt = null; // clear if reverted
      }
      await updateTask(taskId, updates);
      setSelectedTask(prev => prev ? { ...prev, ...updates } : prev);
      toast.success(`Status updated to "${newStatus === 'inprogress' ? 'In Progress' : newStatus === 'todo' ? 'To Do' : 'Done'}"`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const filteredTasks = taskFilter === "all" ? visibleTasks : visibleTasks.filter((t) => t.status === taskFilter);

  // Helper to format due date with urgency
  const formatDueDate = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    let color = "var(--text-secondary)";
    let label = dueDate;
    if (diffDays < 0) { color = "var(--danger)"; label = `Overdue (${dueDate})`; }
    else if (diffDays <= 3) { color = "var(--warning)"; label = `Due soon (${dueDate})`; }
    return { color, label };
  };

  // Helper: Supervisor selector used in all task forms
  const renderSupervisorField = (value, onChange) => (
    supervisors.length > 0 ? (
      <select className="form-control" value={value} onChange={onChange}>
        <option value="">Select supervisor...</option>
        {supervisors.map((sv) => (
          <option key={sv.uid} value={sv.uid}>{sv.name} ({sv.email})</option>
        ))}
      </select>
    ) : (
      <input className="form-control" value={value} onChange={onChange} placeholder="Supervisor name" />
    )
  );

  return (
    <div>
      <Topbar title="Task Tracking" />
      <div className="page-body">

        {/* Projects strip */}

        {/* ── SUPERVISOR VIEW: Project-grouped task board ──────────── */}
        {isSupervisor ? (
          <div className="page-body-inner">

            {visibleTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                <CheckSquare size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontWeight: 600 }}>No tasks assigned to you yet.</p>
                <p style={{ fontSize: '0.85rem' }}>Your consultant will assign tasks once a project is created.</p>
              </div>
            ) : (
              /* Group tasks by project */
              (() => {
                const grouped = {};
                visibleTasks.forEach(t => {
                  const key = t.projectId || '__none__';
                  const label = t.projectName || 'Unassigned Project';
                  if (!grouped[key]) grouped[key] = { label, tasks: [] };
                  grouped[key].tasks.push(t);
                });

                return Object.entries(grouped).map(([pid, group]) => {
                  const groupTasks = group.tasks;
                  const done = groupTasks.filter(t => t.status === 'done').length;
                  const pct = Math.round((done / groupTasks.length) * 100);

                  return (
                    <div key={pid} style={{ marginBottom: 32 }}>
                      {/* Project header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 12, padding: '10px 16px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 8, borderLeft: '3px solid var(--accent)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <FolderOpen size={18} color="var(--accent)" />
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{group.label}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 10 }}>
                            {done}/{groupTasks.length} done
                          </span>
                        </div>
                        {/* Mini progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 100, height: 6, background: 'var(--border)', borderRadius: 99 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{pct}%</span>
                        </div>
                      </div>

                      {/* Task cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {groupTasks.map(task => {
                          // Due date urgency
                          let urgencyColor = 'var(--text-secondary)';
                          let urgencyLabel = task.dueDate || 'No due date';
                          let urgencyBg = 'transparent';
                          if (task.dueDate && task.status !== 'done') {
                            const diff = Math.ceil((new Date(task.dueDate) - new Date()) / 86400000);
                            if (diff < 0) {
                              urgencyColor = 'var(--danger)'; urgencyLabel = `Overdue by ${Math.abs(diff)}d`; urgencyBg = 'rgba(248,81,73,0.08)';
                            } else if (diff <= 3) {
                              urgencyColor = 'var(--warning)'; urgencyLabel = diff === 0 ? 'Due today!' : `Due in ${diff}d`; urgencyBg = 'rgba(210,153,34,0.08)';
                            }
                          }

                          const isSelected = selectedTask?.id === task.id;

                          return (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTask(isSelected ? null : task)}
                              style={{
                                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: 10, background: isSelected ? 'rgba(254,111,111,0.04)' : 'var(--bg-elevated)',
                                cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden'
                              }}
                            >
                              {/* Task summary row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                                {/* Status dot */}
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                  background: task.status === 'done' ? 'var(--success)' : task.status === 'inprogress' ? '#0284c7' : 'var(--text-muted)'
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {task.title}
                                  </div>
                                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                                    {task.site && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <MapPin size={11} /> {task.site}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: urgencyColor, background: urgencyBg, padding: urgencyBg !== 'transparent' ? '1px 6px' : 0, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Calendar size={11} /> {urgencyLabel}
                                    </span>
                                  </div>
                                </div>
                                {/* Priority badge */}
                                <span style={{
                                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                                  background: task.priority === 'high' ? 'rgba(248,81,73,0.15)' : task.priority === 'low' ? 'rgba(63,185,80,0.15)' : 'rgba(210,153,34,0.15)',
                                  color: task.priority === 'high' ? 'var(--danger)' : task.priority === 'low' ? 'var(--success)' : 'var(--warning)'
                                }}>
                                  {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium'}
                                </span>
                                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isSelected ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
                              </div>

                              {/* Expanded detail panel */}
                              {isSelected && (
                                <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-surface)' }}
                                  onClick={e => e.stopPropagation()}>

                                  {/* Description */}
                                  {task.description && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Description</div>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{task.description}</p>
                                    </div>
                                  )}

                                  {/* Key info grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                                    {[
                                      { label: 'Site', value: task.site || '—' },
                                      { label: 'Due Date', value: task.dueDate || '—' },
                                      { label: 'Priority', value: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium' },
                                      { label: 'Completed On', value: task.completedAt ? new Date(task.completedAt).toLocaleDateString() : (task.status === 'done' ? 'Recorded' : '—') },
                                    ].map(item => (
                                      <div key={item.label} style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Update Progress — only if not done */}
                                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Update Progress</div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      {[
                                        { s: 'todo', label: 'To Do', bg: 'var(--bg-surface)', activeBg: '#6b7280', color: '#fff' },
                                        { s: 'inprogress', label: 'In Progress', bg: 'var(--bg-surface)', activeBg: '#0284c7', color: '#fff' },
                                        { s: 'done', label: '✓ Mark Done', bg: 'var(--bg-surface)', activeBg: 'var(--success)', color: '#fff' },
                                      ].map(({ s, label, activeBg, color }) => (
                                        <button
                                          key={s}
                                          onClick={() => handleStatusUpdate(task.id, s)}
                                          style={{
                                            padding: '7px 18px', borderRadius: 20, border: 'none',
                                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                            background: task.status === s ? activeBg : 'var(--bg-elevated)',
                                            color: task.status === s ? color : 'var(--text-secondary)',
                                            border: `1px solid ${task.status === s ? activeBg : 'var(--border)'}`,
                                          }}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                    {task.status === 'done' && task.completedAt && (
                                      <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 8 }}>
                                        ✓ Completed on {new Date(task.completedAt).toLocaleDateString('en-MY', { day:'2-digit', month:'long', year:'numeric' })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>

        ) : (

        /* ── CONSULTANT / ADMIN VIEW: Original split-pane ─────────── */
        <>
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
                {canManageProjects && (
                  <button className="tk-proj-del" onClick={() => handleDeleteProject(p.id)}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="d-flex gap-2">
            {canManageProjects && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowProjectModal(true)}
              >
                <Plus size={14} /> New Project
              </button>
            )}
            {canManageTasks && selProject && (
              <button className="btn btn-outline-primary btn-sm" style={{borderColor: '#F56A6A', color: '#F56A6A'}} onClick={() => setShowAddTaskModal(true)}>
                <Plus size={14} /> Add Task
              </button>
            )}
          </div>
        </div>

        {/* Master Detail Task Layout */}
        <div className="tk-split-layout">
          {/* LEFT PANE: Task List */}
          <div className="tk-left-pane">
            <div className="tk-search-wrapper">
              <Search size={16} color="#999" />
              <input type="text" placeholder="Search..." className="tk-search-input" />
              <Filter size={16} color="#999" style={{ cursor: 'pointer' }} />
            </div>

            <div className="tk-filter-tabs" style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #eaeaea', marginBottom: '8px' }}>
              {["todo", "inprogress", "done"].map((s) => (
                <button
                  key={s}
                  style={{
                    background: 'none', border: 'none', padding: '8px 4px', fontSize: '0.8rem', fontWeight: 600,
                    color: taskFilter === s ? '#F56A6A' : '#999',
                    cursor: 'pointer', borderBottom: `2px solid ${taskFilter === s ? '#F56A6A' : 'transparent'}`,
                    textTransform: 'uppercase'
                  }}
                  onClick={() => setTaskFilter(taskFilter === s ? "all" : s)}
                >
                  {s === "inprogress" ? "In Progress" : s === "todo" ? "To do" : "Done"}
                </button>
              ))}
            </div>

            <div className="tk-task-list">
              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: '0.9rem' }}>
                  No tasks found
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div key={task.id} className={`tk-card-list-item ${selectedTask?.id === task.id ? 'active' : ''}`} onClick={() => setSelectedTask(task)}>
                    <div className="tk-card-img-placeholder"></div>
                    <h3 className="tk-card-title">{task.title}</h3>
                    <div className="tk-card-badges">
                      <span className={`badge`} style={{ background: '#fff0f0', color: '#F56A6A' }}>{task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium'}</span>
                      <span className={`badge`} style={{ background: '#e0f2fe', color: '#0284c7' }}>{task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To do" : "Done"}</span>
                    </div>
                    <div className="tk-card-footer">
                      <div className="tk-card-meta" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {task.assignedTo && <span><User size={11} /> {task.assignedTo}</span>}
                        {task.dueDate && <span style={{ marginLeft: 8 }}><Calendar size={11} /> {task.dueDate}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANE: Task Detail */}
          <div className="tk-right-pane d-none d-lg-block">
            {selectedTask ? (
              <div className="tk-task-detail">
                <div className="tk-detail-header d-flex justify-content-between align-items-center mb-4">
                  <h2 className="tk-detail-title">{selectedTask.title}</h2>
                  <div className="tk-detail-actions text-muted small d-flex align-items-center gap-3">
                    {canManageTasks && (
                      <>
                        <Edit2 size={16} style={{cursor:'pointer'}} onClick={() => openEditTask(selectedTask)} />
                        <Trash2 size={16} style={{cursor:'pointer', color:'var(--danger)'}} onClick={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }} />
                      </>
                    )}
                    <MoreVertical size={16} style={{cursor:'pointer'}} />
                  </div>
                </div>

                <div className="tk-detail-section" style={{marginTop: 0}}>
                  <h6 className="tk-section-title"><Info size={16}/> General Info</h6>
                  <div className="tk-general-grid">
                    <div>
                      <div className="tk-detail-label">Status</div>
                      <span className="badge" style={{ background: '#0284c7', color: '#fff' }}>
                        {selectedTask.status === "inprogress" ? "In Progress" : selectedTask.status === "todo" ? "To do" : "Done"}
                      </span>
                    </div>
                    <div>
                      <div className="tk-detail-label">Priority</div>
                      <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>
                        {selectedTask.priority ? selectedTask.priority.charAt(0).toUpperCase() + selectedTask.priority.slice(1) : 'Medium'}
                      </span>
                    </div>
                    <div>
                      <div className="tk-detail-label">Due Date</div>
                      <div className="tk-detail-value">{selectedTask.dueDate || '—'}</div>
                    </div>
                    <div>
                      <div className="tk-detail-label">Assigned To</div>
                      <div className="tk-detail-value">{selectedTask.assignedTo || '—'}</div>
                    </div>
                    <div>
                      <div className="tk-detail-label">Site</div>
                      <div className="tk-detail-value">{selectedTask.site || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="tk-detail-section">
                  <h6 className="tk-section-title"><FileText size={16}/> Description</h6>
                  <p className="tk-detail-text">{selectedTask.description || 'No description provided.'}</p>
                </div>
              </div>
            ) : (
              <div className="tk-empty-detail d-flex align-items-center justify-content-center h-100 text-muted" style={{minHeight: 400}}>
                Select a task to view details
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          COMBINED PROJECT + TASK FORM  (per wireframe)
          Consultant fills Project details + Task details → Submit
         ══════════════════════════════════════════════════════════════ */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="sp-modal" style={{ maxWidth: 480, padding: 32, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Project Form</h5>
            </div>
            <form onSubmit={handleCreateProjectWithTask} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Project Section ── */}
              <input className="visily-input" required value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="Project Name" />
              <input className="visily-input" value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} placeholder="Description" />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => {if(!e.target.value) e.target.type='text'}} className="visily-input" value={pForm.startDate} onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })} placeholder="Start Date" />
                <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => {if(!e.target.value) e.target.type='text'}} className="visily-input" value={pForm.endDate} onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })} placeholder="End Date" />
              </div>

              <div style={{ marginTop: 8 }}>
                <select className="visily-input" style={{ color: pForm.priority === "" ? "#999" : "inherit" }} value={pForm.priority} onChange={(e) => setPForm({ ...pForm, priority: e.target.value })}>
                  <option value="" disabled hidden>Priority</option>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p} style={{color: '#111'}}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>

              {/* ── Task Section ── */}
              <div style={{ marginTop: 8 }}>
                <h6 style={{ fontWeight: 700, marginBottom: 16, color: '#111' }}>
                  Task Section
                </h6>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <input className="visily-input" value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} placeholder="Task Name" />
                  
                  {supervisors.length > 0 ? (
                    <select className="visily-input" style={{ color: tForm.assignedToUid === "" ? "#999" : "inherit" }} value={tForm.assignedToUid} onChange={(e) => {
                      const sv = supervisors.find(s => s.uid === e.target.value);
                      setTForm({ ...tForm, assignedTo: sv ? sv.name : "", assignedToUid: e.target.value });
                    }}>
                      <option value="" disabled hidden>Assigned To</option>
                      {supervisors.map((sv) => (
                        <option key={sv.uid} value={sv.uid} style={{color: '#111'}}>{sv.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="visily-input" value={tForm.assignedTo} onChange={(e) => setTForm({ ...tForm, assignedTo: e.target.value })} placeholder="Assigned To" />
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => {if(!e.target.value) e.target.type='text'}} className="visily-input" value={tForm.dueDate} onChange={(e) => setTForm({ ...tForm, dueDate: e.target.value })} placeholder="Due Date" />
                    <input className="visily-input" value={tForm.site} onChange={(e) => setTForm({ ...tForm, site: e.target.value })} placeholder="Site" />
                  </div>
                  
                  <select className="visily-input" style={{ color: tForm.status === "" ? "#999" : "inherit" }} value={tForm.status} onChange={(e) => setTForm({ ...tForm, status: e.target.value })}>
                    <option value="" disabled hidden>Status</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Submit button */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 8 }}>
                <button type="submit" className="visily-submit-btn" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ADD TASK to existing project (separate modal)
         ══════════════════════════════════════════════════════════════ */}
      {showAddTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddTaskModal(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="sp-modal-title" style={{ marginBottom: 0 }}>Add Task to {selProject?.name}</div>
              <button className="btn btn-ghost btn-sm p-1" onClick={() => setShowAddTaskModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Task Name</label>
                <input className="form-control" required value={addTForm.title} onChange={(e) => setAddTForm({ ...addTForm, title: e.target.value })} placeholder="Install structural reinforcements" />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                {renderSupervisorField(
                  addTForm.assignedToUid,
                  (e) => {
                    if (supervisors.length > 0) {
                      const sv = supervisors.find(s => s.uid === e.target.value);
                      setAddTForm({ ...addTForm, assignedTo: sv ? sv.name : "", assignedToUid: e.target.value });
                    } else {
                      setAddTForm({ ...addTForm, assignedTo: e.target.value });
                    }
                  }
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-control" value={addTForm.dueDate} onChange={(e) => setAddTForm({ ...addTForm, dueDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Site</label>
                  <input className="form-control" value={addTForm.site} onChange={(e) => setAddTForm({ ...addTForm, site: e.target.value })} placeholder="Block A, Level 3" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={addTForm.priority} onChange={(e) => setAddTForm({ ...addTForm, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={addTForm.status} onChange={(e) => setAddTForm({ ...addTForm, status: e.target.value })}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: "10px 40px" }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          EDIT TASK modal (Consultant/Admin editing existing tasks)
         ══════════════════════════════════════════════════════════════ */}
      {showTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="sp-modal-title" style={{ marginBottom: 0 }}>Edit Task</div>
              <button className="btn btn-ghost btn-sm p-1" onClick={() => setShowTaskModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input className="form-control" required value={editTForm.title} onChange={(e) => setEditTForm({ ...editTForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={editTForm.description} onChange={(e) => setEditTForm({ ...editTForm, description: e.target.value })} placeholder="Task details..." />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                {renderSupervisorField(
                  editTForm.assignedToUid,
                  (e) => {
                    if (supervisors.length > 0) {
                      const sv = supervisors.find(s => s.uid === e.target.value);
                      setEditTForm({ ...editTForm, assignedTo: sv ? sv.name : "", assignedToUid: e.target.value });
                    } else {
                      setEditTForm({ ...editTForm, assignedTo: e.target.value });
                    }
                  }
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={editTForm.priority} onChange={(e) => setEditTForm({ ...editTForm, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={editTForm.status} onChange={(e) => setEditTForm({ ...editTForm, status: e.target.value })}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-control" value={editTForm.dueDate} onChange={(e) => setEditTForm({ ...editTForm, dueDate: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
