# 🏗️ SPRS — Site Progress Reporting System
### MEC's Engineering Sdn. Bhd.

A full-stack, real-time web application for construction site monitoring built with **React.js** and **Firebase**.

---

## 📋 Features

| Module | Roles | Description |
|---|---|---|
| **Auth** | All | Register / Login with role assignment (Consultant / Supervisor) |
| **Dashboard** | All | Live stats, charts, project overview |
| **Daily Reports** | All | Supervisors submit; Consultants approve/reject |
| **Task Tracking** | All | Consultants create tasks; Supervisors update status |
| **Issue Tracker** | All | Log and resolve site issues |
| **Notifications** | All | Real-time alerts for report approvals, rejections |
| **UI & Theming** | All | Clean light mode by default, integrated dark mode toggle, dynamic chart colors |
| **Mobile Ready (PWA)** | All | Progressive Web App support, off-canvas mobile sidebar, device status bar theme syncing |

---

## 🎨 Design System

### Typography
- **Display Font**: `Syne` (used for headings, titles, and logos)
- **Body Font**: `DM Sans` (used for general text, forms, and UI elements)

### Theme Colors
The application uses a dynamic theme system with centralized CSS variables, supporting both vivid **Light** and deep **Dark** modes.

**Brand Colors**
- **Accent (Coral)**: `#fe6f6f` (Primary buttons, highlights, active states)
- **Accent Light**: `#ff8585`

**Light Theme Palette**
- **Backgrounds**: Base `#f8fafc`, Surface/Card `#ffffff`
- **Text**: Primary `#0f172a`, Secondary `#475569`, Muted `#94a3b8`
- **Borders**: Base `#e2e8f0`, Strong `#cbd5e1`

**Dark Theme Palette**
- **Backgrounds**: Base `#0d1117`, Surface `#161b22`, Elevated `#21262d`, Card `#1c2128`
- **Text**: Primary `#e6edf3`, Secondary `#8b949e`, Muted `#484f58`
- **Borders**: Base `rgba(255,255,255,0.08)`, Strong `rgba(255,255,255,0.15)`

**Semantic Colors (Light / Dark)**
- **Success**: `#10b981` / `#3fb950`
- **Warning**: `#f59e0b` / `#d29922`
- **Danger**: `#ef4444` / `#f85149`
- **Info**: `#3b82f6` / `#58a6ff`

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ — https://nodejs.org
- A Google account (for Firebase)

---

### Step 1 — Create Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"** → name it `sprs-mecs` → Continue
3. Disable Google Analytics (optional) → **Create project**

---

### Step 2 — Enable Firebase Services

#### Authentication
1. Left sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable **Email/Password** → Save

#### Firestore Database
1. Left sidebar → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** → Next
4. Select region: `asia-southeast1 (Singapore)` → **Enable**

#### Storage
1. Left sidebar → **Build → Storage**
2. Click **"Get started"**
3. Choose **"Start in test mode"** → Next → **Done**

---

### Step 3 — Get Firebase Config

1. Go to **Project Settings** (gear icon ⚙️ top left)
2. Scroll to **"Your apps"** → Click **`</>`** (Web)
3. Register app name: `sprs-web` → **Register app**
4. Copy the `firebaseConfig` object shown

---

### Step 4 — Add Config to the Project

Open `src/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← paste your values
  authDomain:        "sprs-mecs.firebaseapp.com",
  projectId:         "sprs-mecs",
  storageBucket:     "sprs-mecs.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

### Step 5 — Install & Run

```bash
# In the project folder
npm install

# Start development server
npm start
```

Open **http://localhost:3000** in your browser.

---

### Step 6 — Deploy Firestore Indexes (Required!)

The app uses compound queries that require indexes. Run this once:

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize (choose existing project: sprs-mecs)
firebase init firestore

# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy security rules
firebase deploy --only firestore:rules,storage
```

---

## 🗂️ Project Structure

```
sprs/
├── public/
│   └── index.html
├── src/
│   ├── firebase/
│   │   ├── config.js          ← Firebase init + exports
│   │   └── services.js        ← All CRUD operations
│   ├── contexts/
│   │   └── AuthContext.js     ← Global auth state
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthPage.js    ← Login + Register
│   │   ├── dashboard/
│   │   │   └── Dashboard.js   ← Stats + Charts
│   │   ├── tasks/
│   │   │   └── TasksPage.js   ← Project + Task CRUD
│   │   ├── reports/
│   │   │   └── ReportsPage.js ← Daily log + photo upload
│   │   ├── issues/
│   │   │   └── IssuesPage.js  ← Issue tracker
│   │   ├── notifications/
│   │   │   └── NotificationsPage.js
│   │   └── shared/
│   │       ├── Sidebar.js     ← Navigation
│   │       ├── Topbar.js      ← Header + notif bell
│   │       ├── AppLayout.js   ← Sidebar wrapper
│   │       └── ProtectedRoute.js
│   ├── App.js                 ← Routes
│   ├── index.js               ← Entry point
│   └── index.css              ← Global styles + CSS variables
├── firestore.rules            ← Security rules
├── firestore.indexes.json     ← Compound query indexes
├── storage.rules              ← Storage security
├── firebase.json              ← Firebase hosting config
└── package.json
```

---

## 🔐 User Roles

| Role | Can Do |
|---|---|
| **Consultant** | Create projects, create & assign tasks, approve/reject reports, view all data |
| **Supervisor** | Submit daily reports, update task status, report issues, view own data |

Both roles are selected at registration time.

---

## 📦 Build for Production

```bash
npm run build
```

This creates a `build/` folder. Deploy to Firebase Hosting:

```bash
firebase deploy --only hosting
```

Your app will be live at `https://sprs-mecs.web.app`

---

## 🗄️ Firestore Collections

| Collection | Key Fields |
|---|---|
| `users` | uid, name, email, role |
| `projects` | name, location, status, progress, startDate, endDate |
| `tasks` | projectId, title, assignedTo, priority, status, dueDate |
| `reports` | projectId, title, date, description, workforce, photoUrls, status |
| `issues` | title, description, priority, status, reportedBy |
| `notifications` | recipientUid, message, type, read |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, React Router 6
- **Backend/DB**: Firebase Firestore (NoSQL, real-time)
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage (photo uploads)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: react-hot-toast
- **Architecture**: MVVM pattern

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| `FirebaseError: Missing or insufficient permissions` | Deploy Firestore rules: `firebase deploy --only firestore:rules` |
| `FirebaseError: The query requires an index` | Deploy indexes: `firebase deploy --only firestore:indexes` |
| Photos not uploading | Enable Firebase Storage and deploy storage rules |
| App shows blank page | Check browser console for Firebase config errors |
| `npm start` fails | Delete `node_modules/` and run `npm install` again |

---

## 📞 Support

Developed as FYP1 project for **Universiti Teknologi Malaysia (UTM)**
Student: Nurdhaniyah Fadlisha binti Hasnorfadli — A22MJ5003
Supervisor: Dr. Zatul Alwani Shaffiei
