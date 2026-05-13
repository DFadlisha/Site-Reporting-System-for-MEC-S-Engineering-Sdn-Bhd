# 🏗️ SPRS — Site Progress Reporting System
### MEC'S Engineering Sdn. Bhd. | Final Year Project (PSM 2)

A comprehensive, enterprise-grade site management and progress reporting ecosystem designed for modern construction workflows. SPRS streamlines the bridge between site-level execution and consultant-level oversight through real-time data synchronization, automated forecasting, and professional reporting.

---

## 🌟 Key Pillars

### 📊 Project Intelligence
*   **Real-time Dashboards**: Visualized progress tracking using Chart.js and Recharts.
*   **Project Lifecycle**: Manage projects from initial clearing to final handover with status-based filtering.
*   **Inventory Forecasting**: An intelligent forecasting engine (E-IMS) that predicts material shortages based on active task loads.

### 📝 Field Reporting
*   **Rich Daily Logs**: Track weather, workforce, equipment, and materials with integrated photo uploads.
*   **Approval Workflow**: Structured resubmission and review cycle between Site Supervisors and Consultants.
*   **Issue Tracker**: Log site incidents with severity levels and track them until resolution.

### 🔐 Enterprise Governance
*   **Role-Based Access (RBAC)**: Strict separation of concerns for Administrators, Consultants, and Supervisors.
*   **Domain Restriction**: Secure registration restricted to `@mecs` staff.
*   **Admin Audit Logs**: Full transparency on system changes and user approvals.

### 📱 Modern Engineering
*   **PWA Ready**: Installable on mobile devices with offline capabilities and push notification support.
*   **Dynamic Theming**: Premium UI featuring "Syne" display typography and a vivid Dark/Light mode engine.

---

## 🛠️ Technical Architecture

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router 6, Bootstrap 5 |
| **State & Auth** | Firebase Authentication, Context API |
| **Database** | Cloud Firestore (Real-time NoSQL) |
| **Serverless** | Firebase Functions (Forecasting, Notifications) |
| **Storage** | Firebase Storage (Media Assets) |
| **Messaging** | Firebase Cloud Messaging (FCM) |
| **Visuals** | Recharts, Lucide React, CSS Variables |

---

## 📂 Project Structure

```text
sprs/
├── functions/              # Firebase Cloud Functions (Forecasting, Logistics)
├── public/                 # Static assets & PWA Manifest
├── src/
│   ├── components/         # Feature-based UI components (Auth, Dashboard, Reports, etc.)
│   ├── contexts/           # React Contexts (Auth, Theme)
│   ├── firebase/           # Configuration and Service Layer (CRUD)
│   ├── hooks/              # Custom React hooks
│   ├── App.js              # Routing & Layout definitions
│   └── index.css           # Global Design System (CSS Variables)
├── firestore.rules         # Database Security Rules
└── firebase.json           # Hosting & Services Configuration
```

---

## 🚀 Deployment & Setup

### Prerequisites
*   Node.js (v18.x or higher)
*   Firebase CLI (`npm install -g firebase-tools`)

### 1. Environment Configuration
Create a `.env` file or update `src/firebase/config.js` with your Firebase credentials:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "sprs-mecs.firebaseapp.com",
  projectId: "sprs-mecs",
  storageBucket: "sprs-mecs.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Installation
```bash
npm install
```

### 3. Database Security & Infrastructure
Deploy the required security rules and compound indexes:
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Run Locally
```bash
npm start
```

---

## 📦 Enterprise Inventory Management (E-IMS)

The system includes a specialized inventory module with a **Forecasting Engine** that runs daily:
*   **Concrete Load**: Predicts consumption based on "pour" and "concrete" tasks.
*   **Steel Load**: Forecasts rebar requirements.
*   **Automated Purchase Requests**: Triggers high-urgency requests when forecasted load exceeds stock.

---

## 🔐 User Roles & Permissions

The system implements a strict Role-Based Access Control (RBAC) model to ensure data integrity and workflow efficiency.

### 📊 Roles Matrix
| Feature | Administrator | Consultant | Supervisor |
|---|:---:|:---:|:---:|
| User Management & Approvals | ✅ | ❌ | ❌ |
| Project Creation & Editing | ✅ | ✅ | ❌ |
| Task Definition & Assignment | ❌ | ✅ | ❌ |
| Daily Report Submission | ❌ | ❌ | ✅ |
| Report Review & Approval | ❌ | ✅ | ❌ |
| Inventory Forecasting (E-IMS) | ✅ | ✅ | ✅ |
| System Audit Logs | ✅ | ❌ | ❌ |
| Global Announcements | ✅ | ❌ | ❌ |

---

### 🔑 Role-Specific Workflows

#### 👑 Administrator (System Governance)
*   **User Lifecycle Management**: Full control over user approvals, rejections, and account deactivations.
*   **System Audit Logs**: Monitor all critical system actions and entity changes for full accountability.
*   **Global Announcements**: Broadcast high-priority messages to all staff or specific roles via the notification engine.
*   **Enterprise Oversight**: Comprehensive visibility across all active projects and global inventory status.

#### 🎓 Consultant (Project Oversight)
*   **Project Initiation**: Define project scopes, geographic locations, and baseline timelines.
*   **Task Management**: Create detailed work packages and assign them to specific site supervisors.
*   **Quality Assurance**: Review daily reports with a structured workflow (Approve or Request Resubmission with feedback).
*   **Progress Analytics**: Analyze project velocity through specialized charts and milestone tracking.

#### 👷 Site Supervisor (Field Execution)
*   **Daily Site Logging**: Capture real-time data including weather, workforce distribution, and equipment usage.
*   **Progress Documentation**: Upload multiple site photos as visual proof of daily progress.
*   **Task Synchronization**: Update task status in real-time (To-Do → In Progress → Done) to keep stakeholders informed.
*   **Issue Reporting**: Log site incidents or material shortages immediately with severity levels to trigger alerts.

---

## 📱 PWA Features
*   **Service Worker**: Background sync and asset caching.
*   **Push Notifications**: Real-time alerts for report status updates and low stock warnings.
*   **Installable**: Full-screen mobile experience without browser chrome.

---

## 📞 Academic Context
*   **Institution**: Universiti Teknologi Malaysia (UTM)
*   **Program**: Bachelor of Computer Science (Software Engineering)
*   **Course**: Projek Sarjana Muda 2 (PSM 2)
*   **Student**: Nurdhaniyah Fadlisha binti Hasnorfadli (A22MJ5003)
*   **Supervisor**: Dr. Zatul Alwani Shaffiei

---

> [!NOTE]
> This system is developed for professional use at MEC'S Engineering Sdn. Bhd. for site monitoring and data-driven decision making.
