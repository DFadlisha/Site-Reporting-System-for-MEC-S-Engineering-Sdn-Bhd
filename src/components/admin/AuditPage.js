import React, { useEffect, useState } from "react";
import { Activity, Bell, Loader2 } from "lucide-react";
import Topbar from "../shared/Topbar";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

export default function AuditPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Announcement state
  const [announcement, setAnnouncement] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [isAdmin]);

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    setSending(true);
    try {
      // Fetch all users to notify them
      const { getDocs } = require("firebase/firestore");
      const usersSnap = await getDocs(collection(db, "users"));
      
      const batch = require("firebase/firestore").writeBatch(db);
      
      usersSnap.forEach(doc => {
        const notifRef = require("firebase/firestore").doc(collection(db, "notifications"));
        batch.set(notifRef, {
          recipientUid: doc.id,
          message: `📢 System Announcement: ${announcement}`,
          type: "info",
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      // Log the announcement in audit
      await addDoc(collection(db, "audit_logs"), {
        action: "ANNOUNCEMENT_SENT",
        entityType: "SYSTEM",
        userId: "ADMIN",
        changes: { message: announcement },
        timestamp: serverTimestamp()
      });

      toast.success("Announcement sent to all users!");
      setAnnouncement("");
    } catch (err) {
      toast.error("Failed to send announcement.");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <Topbar title="Audit & Activity" />
        <div className="page-body">
           <div className="alert alert-danger">Access Denied: Admin Only.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Audit Logs & System Activity" />
      <div className="page-body">
        
        {/* System Announcements */}
        <div className="card p-4 mb-4" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)"}}>
          <h5 className="mb-3 d-flex align-items-center gap-2" style={{color: "var(--info)"}}>
            <Bell size={18} /> Send System-Wide Announcement
          </h5>
          <form onSubmit={handleSendAnnouncement} className="d-flex gap-2">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Enter announcement message..." 
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary text-nowrap" disabled={sending}>
              {sending ? <Loader2 size={16} className="spin" /> : "Broadcast"}
            </button>
          </form>
        </div>

        <div className="card p-4">
          <h5 className="mb-4 d-flex align-items-center gap-2">
            <Activity size={18} /> System Activity Logs
          </h5>
          
          {loading ? (
            <div className="text-center py-5 text-muted"><Loader2 size={24} className="spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-5 text-muted">No activity recorded yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <thead style={{color: "var(--text-primary)"}}>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Entity ID</th>
                    <th>User</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                     <tr key={log.id}>
                        <td>{log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : "Just now"}</td>
                        <td><span className="badge" style={{background: "rgba(63,185,80,0.1)", color: "var(--success)"}}>{log.action}</span></td>
                        <td>{log.entityType}</td>
                         <td style={{fontFamily: "monospace"}}>{log.entityId || "N/A"}</td>
                        <td>{log.userId || "SYSTEM"}</td>
                        <td>
                          {log.changes ? (
                             <pre style={{ margin: 0, fontSize: "0.75rem", background: "var(--bg-elevated)", padding: 4, borderRadius: 4}}>
                               {JSON.stringify(log.changes, null, 2)}
                             </pre>
                          ) : "None"}
                        </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
