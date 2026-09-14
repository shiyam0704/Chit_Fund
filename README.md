# Chit Fund Management System

A modern, high-performance financial management web application built for chit fund operators, administrators, and collection staff. Featuring granular role-based access control, real-time transaction ledgers, a dedicated **Audit Trail** investigation page, and an enterprise-grade **Complete Backup & Restore System** with cryptographic SHA-256 integrity verification.

---

## 📋 Table of Contents
1. [Key Features](#-key-features)
2. [Sidebar Navigation Structure](#-sidebar-navigation-structure)
3. [Audit Trail Module (`/audit-trail`)](#-audit-trail-module-audit-trail)
4. [Complete Backup & Restore System](#-complete-backup--restore-system)
   - [Backup Architecture & `.chitbackup` Format](#backup-architecture---chitbackup-format)
   - [Security & Zero-Secrets Guarantee](#security--zero-secrets-guarantee)
   - [Mandatory Safety Backup Before Restore](#mandatory-safety-backup-before-restore)
   - [Restore Validation & Preview](#restore-validation--preview)
   - [Backup History](#backup-history)
5. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
6. [Tech Stack & Architecture](#-tech-stack--architecture)
7. [Installation & Setup](#-installation--setup)
8. [Production Build & Verification](#-production-build--verification)

---

## 🚀 Key Features

- **Dashboard**: Real-time analytics, monthly collection metrics, active scheme counts, and financial summaries.
- **Chit Scheme Management**: Flexible configurations (Daily, Weekly, Monthly, Fixed, Step-Up), auction tracking, dividend computations, and slot assignments.
- **Member Directory**: Full member profiles, scheme enrollments, pending dues tracking, payment history, and contact books.
- **Financial Reports**: 7 financial and collection reports (`Daily Collection`, `Monthly Collection`, `Chit-wise Collection`, `Member Payment Report`, `Pending Report`, `Overdue Report`, `Staff Collection Report`) with Excel CSV, PDF, and Print export capabilities.
- **Dedicated Audit Trail Page**: Completely independent investigation module logging every administrative, operational, and authentication event with before/after diffs.
- **Enterprise Backup & Restore**: One-click full system snapshotting into tamper-evident `.chitbackup` archives with automated pre-restore safety snapshots.

---

## 🧭 Sidebar Navigation Structure

The navigation adheres to a strict menu hierarchy:

```
MAIN MENU
├── Dashboard     (/dashboard)
├── Chits         (/chits)
├── Members       (/members)
├── Reports       (/reports)
├── Audit Trail   (/audit-trail)
└── Settings      (/settings)
```

> [!NOTE]
> **Strict Separation Rule**: The Audit Trail is a completely independent page (`/audit-trail`). It is never nested inside the Reports page or mixed with financial/collection tables.

---

## 🛡️ Audit Trail Module (`/audit-trail`)

A standalone security and compliance module that captures an immutable log of every action performed in the system.

### Summary Metric Cards
- **Total Activities**: Total count of all recorded system operations.
- **Today's Activities**: Activities recorded since 00:00 local time today.
- **Created**: Total creation events (members, schemes, payments, users).
- **Updated**: Total modification events with captured field-level diffs.
- **Deleted**: Deletion and deactivation operations.

*All values are dynamically computed from live audit data.*

### Advanced Filter Bar
- **Search**: Multi-target query matching actor name, member, record ID, module, action, or description.
- **Date Options**: `All Dates`, `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, `Custom Range`.
- **Module Filter**: `All Modules`, `Authentication`, `Members`, `Chits`, `Payments`, `Collections`, `Receipts`, `Expenses`, `Users`, `Staff`, `Reports`, `Settings`, `System Backup`.
- **Action Filter**: `All Actions`, `CREATE`, `UPDATE`, `DELETE`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `CANCEL`, `REVERSE`, `EXPORT`, `PRINT`.
- **Status Filter**: `All Statuses`, `Success`, `Failed`.
- **User & Role Filters**: Dynamic dropdown of actors who have performed actions.

### Audit Log Table
| DATE & TIME | USER | ROLE | ACTION | MODULE | RECORD | DESCRIPTION | STATUS | VIEW |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| 14 Sep 2026<br>`10:42 AM` | Ramesh | Staff | `CREATE` | Members | `MEM-00125` | Added new member "Suresh Kumar" | `Success` | [View] |
| 14 Sep 2026<br>`10:45 AM` | Super Admin | Super Admin | `UPDATE` | Chits | `CHIT-0008` | Updated monthly installment from ₹5,000 to ₹6,000 | `Success` | [View] |

### Activity Details Inspection Modal
Clicking **View** opens an in-depth modal displaying:
- **Core Metadata**: Activity ID, Date & Time, User, Role, Module, Record ID, Record Name, IP Address, and Device / Browser user agent.
- **For `UPDATE` actions**: Displays the **CHANGE DETAILS** diff table (`Field | Previous Value | New Value`) highlighting changed attributes.
- **For `CREATE` actions**: Displays all initial attributes of the created record.
- **For `DELETE` actions**: Displays the pre-deletion snapshot for historical auditability.
- **For Authentication**: Displays IP, user agent, attempted username, and session outcome.
- **For `Failed` actions**: Prominently highlights the failure reason.

---

## 💾 Complete Backup & Restore System

The Backup & Restore System is accessible via the **Backup** button at the top-right of the Reports page:

```
[ Backup ]  [ Export Excel ]  [ Export PDF ]  [ Print Report ]
```

### Backup Architecture & `.chitbackup` Format
- **Extension**: `.chitbackup`
- **File Naming**: `ChitFund_Backup_YYYY-MM-DD_HH-mm-ss.chitbackup` (e.g., `ChitFund_Backup_2026-09-14_11-30-45.chitbackup`).
- **Cryptographic Checksum**: Calculates a standard **SHA-256 hash** over the serialized data payload using the Web Crypto API (`crypto.subtle`). Any modification or corruption in transit is immediately flagged.
- **Data Payload Snapshot**:
  - ✓ **Company Profile & Settings** (names, addresses, GST, commission rates, grace periods, receipt headers/footers)
  - ✓ **Chit Schemes & Active Chits** (schemes, durations, auction configurations, month payouts, overrides)
  - ✓ **Member Directory & Slots** (profiles, phone numbers, addresses, scheme assignments)
  - ✓ **Financial Transactions** (collection payments, receipts, prize payouts)
  - ✓ **User Accounts & Roles** (staff, manager, and administrator account configurations)
  - ✓ **Role Permission Policies**
  - ✓ **Immutable Audit Trail Logs**

### Security & Zero-Secrets Guarantee
> [!IMPORTANT]
> **Zero-Secrets Policy**: Passwords, password hashes, JWT tokens, session keys, private keys, and API secrets are **never** included in backups. User profile data is safely exported while credential material remains protected.

### Mandatory Safety Backup Before Restore
Restoring a backup replaces existing system tables. To guarantee absolute business data safety:
1. When **Restore Backup** is triggered, the system automatically creates and downloads a fresh safety backup of the current state:
   ```
   PreRestore_Backup_YYYY-MM-DD_HH-mm-ss.chitbackup
   ```
2. **Atomic Safety Gate**: Only after the safety backup file is successfully created and secured does the restoration procedure begin. If the safety backup fails, the restore is instantly aborted.

### Restore Validation & Preview
Before applying any backup archive, the system performs a multi-phase validation:
1. **JSON & Schema Check**: Verifies file syntax and mandatory top-level sections (`metadata`, `data`, `checksum`).
2. **Application Identification**: Verifies `application_name === "Chit Fund Management System"`.
3. **Cryptographic Checksum Validation**: Recomputes SHA-256 hash over `data` and ensures it matches `checksum`.
4. **Data Integrity Inspection**: Confirms required database collections (`members`, `chits`, `transactions`) are present and properly formed.
5. **Interactive Restore Preview**:
   - Created At date & time
   - Creator name and role
   - Package version
   - Quantified counts of records found: Members, Chits, Transactions, Payouts, Users, Audit Logs.
6. **Risk Acknowledgment**:
   - `☐ I understand that restoring this backup may replace current system data.`
   - Restore button remains strictly disabled until the checkbox is checked.
7. **Session Preservation**: Current Super Admin credentials and active authentication session are preserved so the administrator is never locked out.

### Backup Audit Logging
- **`BACKUP_CREATED`**: Logged whenever a full backup or pre-restore safety snapshot completes.
- **`BACKUP_FAILED`**: Logged if data serialization or storage fails.
- **`RESTORE_STARTED`**: Logged at the start of any restore operation.
- **`RESTORE_COMPLETED`**: Permanently written into the newly restored audit logs alongside the restored history.
- **`RESTORE_FAILED`**: Logged if validation or write operations fail.

### Backup History
Maintains a persistent record of all backups generated on the machine:
- **Date & Time**
- **Created By**
- **Type** (`Full System Backup` / `Pre-Restore Safety Backup`)
- **File Name**
- **Size** (formatted in KB / MB)
- **Status** (`Success` / `Failed`)

---

## 🔒 Role-Based Access Control (RBAC)

The system includes fine-grained permission enforcement:

| Permission Key | Description | Super Admin | Admin / Manager | Staff |
| :--- | :--- | :---: | :---: | :---: |
| `dashboard.view` | View Dashboard analytics & KPIs | ✅ | ✅ | ✅ |
| `chits.view` | View chit schemes | ✅ | ✅ | ❌ |
| `chits.create` | Create new chit schemes | ✅ | ✅ | ❌ |
| `chits.edit` | Modify chit parameters & auctions | ✅ | ✅ | ❌ |
| `chits.delete` | Delete chit schemes | ✅ | ❌ | ❌ |
| `members.view` | View member directory | ✅ | ✅ | ✅ |
| `members.create` | Register new members | ✅ | ✅ | ❌ |
| `members.edit` | Update member profiles | ✅ | ✅ | ❌ |
| `members.delete` | Deactivate/remove members | ✅ | ❌ | ❌ |
| `payments.view` | View payments & collections | ✅ | ✅ | ✅ |
| `payments.create` | Record collections & receipts | ✅ | ✅ | ✅ |
| `reports.view` | View collection reports | ✅ | ✅ | ✅ |
| `reports.export` | Export reports to Excel & PDF | ✅ | ✅ | ❌ |
| `audit_trail.view` | Access Audit Trail page & logs | ✅ | Optional | Optional |
| `audit_trail.export` | Export filtered audit logs | ✅ | Optional | ❌ |
| `audit_trail.print` | Print audit trail records | ✅ | Optional | ❌ |
| `backup.view` | View backup modal & history | ✅ | ✅ | ❌ |
| `backup.create` | Create `.chitbackup` archives | ✅ | ✅ | ❌ |
| `backup.download` | Download backup archives | ✅ | ✅ | ❌ |
| `backup.restore` | Restore `.chitbackup` archives | ✅ | ❌ | ❌ |

Permissions can be configured per role or assigned to custom roles via **Settings → User Management → Role Permissions**.

---

## 🛠️ Tech Stack & Architecture

- **Runtime & UI**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vite.dev/)
- **Styling**: Vanilla CSS tokens & [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- **Cryptography**: Native Web Crypto API (`crypto.subtle`) SHA-256
- **Persistence**: High-reliability LocalStorage schema with cross-tab custom event dispatchers (`chitfund_app_data_updated`, `chitfund_audit_updated`).

---

## 💻 Installation & Setup

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### Quick Start
```bash
# 1. Install project dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open application in browser
# Local URL: http://localhost:5173
```

### Default Credentials
- **Username / Email**: `chitfundadmin@gmail.com`
- **Password**: `adminchit@123`
- **Role**: Super Admin (Full Access)

---

## 🧪 Production Build & Verification

```bash
# Run TypeScript type check and compile production bundle
npm run build
```

Bundle output verification:
- `dist/index.html`: Optimized HTML entry
- `dist/assets/`: Code-split vendor chunks (`vendor-react`, `vendor-icons`, `vendor-pdf`) and CSS bundle.
- **Build Status**: `✓ built with 0 errors`

---

## 📄 License
Internal proprietary software for Chit Fund Management & Operations.
