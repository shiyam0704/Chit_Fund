# System Manual: Audit Trail & Backup/Restore Operations

This document provides step-by-step operational instructions for administrators and operators using the **Audit Trail** and **Complete Backup & Restore System** in the Chit Fund Management System.

---

## 1. Audit Trail System (`/audit-trail`)

### Accessing the Page
1. Log in to the application with administrative credentials.
2. In the left sidebar, click **Audit Trail** (positioned between *Reports* and *Settings*).
3. The browser will navigate to `http://localhost:5173/audit-trail`.

### Viewing System Metrics
At the top of the Audit Trail page, review the 5 live summary cards:
- **Total Activities**: Cumulative log count.
- **Today's Activities**: Activities recorded today.
- **Created**: New members, chits, transactions, or users.
- **Updated**: Parameter changes, profile edits, settings updates.
- **Deleted**: Member deactivations or scheme removals.

### Filtering and Searching
- **Search Bar**: Type any actor name (e.g., `Super Admin`, `Ramesh`), member name (e.g., `Suresh Kumar`), record ID (e.g., `MEM-00125`, `CHIT-0008`), or keyword.
- **Date Range**: Select from `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, or choose `Custom Range` to pick specific Start and End dates.
- **Module Filter**: Narrow by `Authentication`, `Members`, `Chits`, `Payments`, `Collections`, `Receipts`, `Expenses`, `Users`, `Staff`, `Reports`, `Settings`, or `System Backup`.
- **Action Filter**: Filter by `CREATE`, `UPDATE`, `DELETE`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `CANCEL`, `REVERSE`, `EXPORT`, or `PRINT`.
- **Status Filter**: View `Success` or `Failed` events.
- **Reset Button**: Clears all active filters and resets to page 1.

### Inspecting Activity Details (View Modal)
Click the **View** button on any table row to inspect:
- **Activity ID & Timestamp**: Exact second the action occurred.
- **User & Role**: Identity of the user who performed the action.
- **Module & Record**: Affected system entity.
- **IP Address & Client Browser**: Network address and device user agent.
- **CHANGE DETAILS Table (for UPDATE)**: Side-by-side comparison showing:
  - `Field`: Property name (e.g., `Monthly Amount`, `Phone Number`)
  - `Previous Value`: Stored value prior to modification (e.g., `₹5,000`)
  - `New Value`: Updated value (e.g., `₹6,000`)
- **Created Record Attributes (for CREATE)**: Full snapshot of the initial entity data.
- **Pre-Deletion Snapshot (for DELETE)**: Preserved record data prior to removal.
- **Failure Reason (for Failed)**: Error description explaining why the operation failed.

### Exporting & Printing Audit Data
- **Export Excel**: Generates a CSV file containing all currently filtered records.
- **Export PDF**: Generates a formatted PDF report with table formatting and metadata.
- **Print**: Opens the browser print preview for the filtered table.

---

## 2. Complete Backup System

### Where to Find the Backup Button
1. In the sidebar, click **Reports**.
2. At the top-right of the Reports page, locate the action buttons:
   ```
   [ Backup ]  [ Export Excel ]  [ Export PDF ]  [ Print Report ]
   ```
3. Click the **Backup** button to open the modal.

### Creating a Full System Backup
1. In the modal, ensure the **Create Backup** tab is selected.
2. Review the checklist of data collections included in the backup:
   - Company Settings
   - Chit Schemes & Schedules
   - Member Directory & Slots
   - Payment Transactions & Receipts
   - Payouts & Collections
   - User Accounts & Roles (Sanitized: Passwords redacted)
   - Role Permission Policies
   - Immutable Audit Trail History
3. Click **Create Secure Backup**.
4. Observe the non-blocking progress indicator:
   - *Preparing backup...*
   - *Collecting company settings and chit schemes...*
   - *Collecting members, transactions, and collections...*
   - *Collecting user roles and access policies...*
   - *Collecting immutable audit trail logs...*
   - *Calculating cryptographic integrity checksum (SHA-256)...*
   - *Finalizing backup package...*
   - *Backup completed successfully!*
5. The browser will automatically download the generated archive:
   ```
   ChitFund_Backup_YYYY-MM-DD_HH-mm-ss.chitbackup
   ```
6. An immutable **`BACKUP_CREATED`** record is automatically created in the Audit Trail.

---

## 3. Restoring System Data

> [!CAUTION]
> Restoring a backup replaces existing system tables. Only the **Super Admin** or authorized users with the `backup.restore` permission can initiate a restore.

### Step-by-Step Restoration Procedure
1. Click **Reports** → **Backup**.
2. Click the **Restore Backup** tab in the modal.
3. Click the upload dropzone and select a valid `.chitbackup` file.
4. **Validation Phase**: The system automatically verifies:
   - Valid archive format
   - Incompatible application rejection
   - SHA-256 cryptographic checksum matching (detects tampering/corruption)
   - Presence of required database tables
5. **Review Preview**:
   Check the summary card displaying:
   - Backup creation timestamp
   - Author name and role
   - Record counts for Members, Chits, Transactions, Payouts, Users, and Audit Logs.
6. **Acknowledge Risk**:
   Check the mandatory confirmation box:
   `☑ I understand that restoring this backup may replace current system data.`
7. Click **Restore Backup**.
8. **Automated Safety Snapshot**:
   The system will automatically generate and download:
   ```
   PreRestore_Backup_YYYY-MM-DD_HH-mm-ss.chitbackup
   ```
   *If this safety snapshot fails, the restore process immediately stops.*
9. **Data Replacement & Audit Sealing**:
   - The database tables are restored.
   - Super Admin credentials and active login session are preserved.
   - Both **`RESTORE_STARTED`** and **`RESTORE_COMPLETED`** events are permanently appended to the restored audit trail.
10. Click **Refresh Application View** to apply all restored records to the screen.

---

## 4. Viewing Backup History

1. In the Backup modal, click the **Backup History** tab or click the **View Backup History →** link.
2. Review the persistent history log showing:
   - **Date & Time**: When the backup was generated.
   - **Created By**: User who requested the snapshot.
   - **Type**: `Full System Backup` or `Pre-Restore Safety Backup`.
   - **File Name**: Timestamped filename.
   - **Size**: Formatted file size (KB / MB).
   - **Status**: `Success`.
