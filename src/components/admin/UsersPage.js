import React, { useState, useEffect } from "react";
import { Users, Shield, Calendar, Edit2, ShieldAlert } from "lucide-react";
import Topbar from "../shared/Topbar";
import { subscribeSystemUsers, updateUserStatus } from "../../firebase/services";
import toast from "react-hot-toast";
import { format } from "date-fns";
import "./UsersPage.css";

export default function UsersPage() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeSystemUsers((data) => {
      setUsersList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserStatus(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (err) {
      toast.error("Failed to update role");
      console.error(err);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case "admin": return "user-role-admin";
      case "manager": return "user-role-manager";
      case "supervisor": return "user-role-supervisor";
      case "consultant": return "user-role-consultant";
      default: return "user-role-supervisor";
    }
  };

  return (
    <div>
      <Topbar title="User Management" />
      <div className="page-body">
        <div className="users-container">
          
          <div className="alert alert-info d-flex align-items-center gap-2 mb-4" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--info)' }}>
            <ShieldAlert size={20} />
            <span>
              <strong>Admin Only Area.</strong> Role changes made here directly map to Firebase Custom Claims and RBAC permissions. Use caution.
            </span>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Loading users...</div>
          ) : usersList.length === 0 ? (
            <div className="text-center py-5 text-muted">No users found.</div>
          ) : (
            <div className="row g-4">
              {usersList.map((user) => (
                <div className="col-12 col-md-6 col-lg-4" key={user.id}>
                  <div className="user-card">
                    <div className="user-header">
                      <div className="d-flex align-items-center w-100">
                        <div className="user-avatar">
                          {user.name ? user.name[0].toUpperCase() : <Users size={20} />}
                        </div>
                        <div className="user-details">
                          <h3 className="user-name">{user.name || "Unknown User"}</h3>
                          <p className="user-email">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="user-stats">
                      <div className="stat-item">
                        <Calendar size={14} />
                        Joined {user.createdAt ? format(user.createdAt.toDate(), "MMM d, yyyy") : "N/A"}
                      </div>
                    </div>

                    <div className="user-actions d-flex align-items-center justify-content-between mt-auto pt-3">
                       <span className={`user-role-badge ${getRoleBadgeClass(user.role)}`}>
                        {user.role || "worker"}
                      </span>

                      <div className="dropdown">
                        <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                          <Edit2 size={14} /> Change Role
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end shadow">
                          <li><button className="dropdown-item" onClick={() => handleRoleChange(user.id, "supervisor")}>Supervisor</button></li>
                          <li><button className="dropdown-item" onClick={() => handleRoleChange(user.id, "consultant")}>Consultant</button></li>
                          <li><hr className="dropdown-divider" /></li>
                          <li><button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={() => handleRoleChange(user.id, "admin")}><Shield size={14} /> Admin</button></li>
                        </ul>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
