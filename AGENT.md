# G-Flow Approval System - Architectural Blueprint

**AGENT.md** | Version 2.0 | React + Google Apps Script

---

## 0. Core Pillars (System Principles)

### Pillar 1: Externalized Configuration
- **NO programmatic database creation** - The system does not create Drive folders or Spreadsheets
- Admin manually provides three IDs stored in GAS PropertiesService:
  - `ROOT_DRIVE_FOLDER_ID`: Drive folder for PDF previews and attached files
  - `LOGS_SPREADSHEET_ID`: Dedicated sheet for Audit Trail (bitácoras)
  - `CONFIG_SPREADSHEET_ID`: Master sheet for workflows, entities, and user roles
- Database is **stateless in code** - strictly reads/writes to provided Spreadsheet IDs

### Pillar 2: Google-Native Authentication
- **NO custom password/JWT system**
- Backend uses `Session.getActiveUser().getEmail()` to identify users
- React frontend has an "Auth Gate" that validates user against CONFIG_SPREADSHEET_ID
- Unregistered users see "Access Denied" screen

### Pillar 3: 4-Tier RBAC
| Role | Permissions |
|------|------------|
| **Admin** | Full access. Manage users, roles, system settings. |
| **Super Approver** | Approve any step in any workflow. Bypass restrictions. Override decisions. |
| **Approver** | Approve/reject only steps explicitly assigned to them. |
| **Operator** | Initiate workflows, upload files, fill forms, select target entities. Cannot approve. |

---

## 1. Project Directory Structure

```
g-flow-approve/
├── src/                          # React frontend source
│   ├── components/
│   │   ├── ui/                   # Base UI components (Button, Input, Modal)
│   │   ├── forms/                # Dynamic form builders
│   │   ├── workflow/             # Workflow builder canvas
│   │   ├── pdf/                  # PDF viewer integration
│   │   └── layout/               # App shell, Sidebar, Header
│   ├── contexts/                 # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── FlowContext.tsx
│   │   └── EntityContext.tsx
│   ├── hooks/                    # Custom hooks (useGAS, useAuth, useWorkflow)
│   ├── services/                # GAS wrapper services
│   │   ├── gasClient.ts          # google.script.run wrapper
│   │   ├── flowService.ts
│   │   ├── entityService.ts
│   │   └── auditService.ts
│   ├── pages/                    # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── FlowBuilder.tsx
│   │   ├── FlowExecution.tsx
│   │   ├── EntityDirectory.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx
│   ├── types/                    # TypeScript definitions
│   │   └── index.ts
│   ├── utils/                    # Utilities
│   │   ├── dateUtils.ts
│   │   └── validators.ts
│   ├── App.tsx                  # Main app with hash-based routing
│   ├── main.tsx                 # Entry point
│   └── index.css                 # Tailwind + dark mode vars
│
├── gas/                         # Google Apps Script backend
│   ├── Code.gs                  # Main entry point (doGet, doPost)
│   ├── lib/
│   │   ├── Auth.gs               # RBAC enforcement
│   │   ├── Database.gs           # Sheet interface layer
│   │   ├── EntityManager.gs       # DLP & entity lookup
│   │   ├── WorkflowEngine.gs     # Flow execution logic
│   │   ├── EmailService.gs        # Gmail API wrapper
│   │   └── AuditLogger.gs       # Immutable audit trail
│   └── templates/
│       └── Index.html            # React mount point
│
├── .clasp.json                  # Clasp configuration (rootDir: "./dist")
├── appsscript.json              # GAS manifest
├── .env                         # Environment variables
├── package.json               # Build & deploy scripts
├── vite.config.ts               # Vite config (single file output)
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## 2. Configuration (External IDs)

All configuration stored in GAS PropertiesService. Admin provides these IDs manually:

### Required IDs
| Property Key | Description | Example |
|--------------|-------------|---------|
| `ROOT_DRIVE_FOLDER_ID` | Drive folder for files | `1ABC123...` |
| `LOGS_SPREADSHEET_ID` | Audit trail spreadsheet | `1XYZ789...` |
| `CONFIG_SPREADSHEET_ID` | Master config spreadsheet | `1DEF456...` |

### Accessing Configuration (GAS)
```javascript
// lib/Config.gs
const CONFIG = {
  get(key) {
    return PropertiesService.getUserProperties().getProperty(key);
  },
  set(key, value) {
    PropertiesService.getUserProperties().setProperty(key, value);
  },
  getAll() {
    const props = PropertiesService.getUserProperties().getProperties();
    return {
      rootDriveFolderId: props.ROOT_DRIVE_FOLDER_ID,
      logsSpreadsheetId: props.LOGS_SPREADSHEET_ID,
      configSpreadsheetId: props.CONFIG_SPREADSHEET_ID,
    };
  },
};
```

---

## 3. Core Data Schema (CONFIG_SPREADSHEET_ID)

The CONFIG spreadsheet contains 4 sheets:

### Sheet: USERS (in CONFIG_SPREADSHEET_ID)
| Email | PasswordHash | Role | DisplayName | Skills | CreatedAt | IsActive | LastLogin | Notes |
|-------|--------------|------|-------------|--------|-----------|----------|-----------|-------|
| user@... | a1b2... | Admin | John Doe | Finance | 2025-01-01 | TRUE | 2025-05-02 | |

- **Role**: `Admin`, `SuperApprover`, `Approver`, `Operator`
- **PK**: Email (lowercase)
- **Skills**: Comma separated string mapping to flow rules
- Only registered and IsActive=TRUE users can access the system

### Sheet: ENTITIES (DLP Directory in CONFIG_SPREADSHEET_ID)
| EntityID | EntityType | DisplayName | VerifiedEmail | IsActive | CreatedAt |
|----------|-----------|-------------|---------------|----------|-----------|
| EMP-001 | Employee | Jane Smith | jane@company.com | TRUE | 2025-01-01 |

- **EntityType**: `Employee`, `Client`, `Vendor`, `Partner`
- **IsActive**: Must be `TRUE` for email dispatch (strict DLP)

### Sheet: FLOWS (in CONFIG_SPREADSHEET_ID)
| FlowID | FlowName | Description | Steps | CreatedBy | CreatedAt | IsActive |
|--------|----------|-------------|-------|-----------|-----------|----------|
| FLOW-001 | Invoice Approval | Approve invoices | JSON | admin@... | 2025-01-01 | TRUE |

- **Steps (JSON)**: `[{ stepId, name, assigneeType, assigneeValue, actionType, actionConfig }]`
- **assigneeType**: `SuperApprover` | `Approver` | `user:email` | `operator`
- **actionType**: `approve` | `email_client` | `email_internal` | `archive` | `custom`

### Sheet: APPROVALS (in CONFIG_SPREADSHEET_ID)
| ApprovalID | FlowID | CurrentStep | Status | SubmittedBy | EntityTag | Files | SubmittedAt | CompletedAt |
|-----------|--------|-------------|--------|-------------|-----------|------|-------------|-------------|
| APP-001 | FLOW-001 | 1 | Pending | user@... | EMP-001 | JSON | 2025-05-02 | |

- **Status**: `Draft`, `Pending`, `RevisionsRequested`, `Approved`, `Dispatched`, `Rejected`
- **EntityTag**: Links to ENTITIES.EntityID (strict DLP enforcement)
- **Files (JSON)**: `[{ name, driveUrl, driveId, mimeType, pdfBlobId }]`. URLs are set to "Anyone with Link View" for seamless access.

### Core Feature Architectures
1. **Dynamic Form Builder**: Form configurations inside flows generate complex structured data, including file uploads tracked via Google Drive folder links. 
2. **Schema Auto-Provisioning**: the `saveToSheet` process dynamically generates target Spreadsheet schemas out of Form payloads using `Object.keys()`.
3. **Email Composer UI**: Complex action module bridging user execution steps to dynamic templates parsed using Handlebars-style literals (`{{entityName}}`, `{{executionId}}`).

### Sheet: AUDIT_LOG (in LOGS_SPREADSHEET_ID - Append-only)
| Timestamp | ApprovalID | ActorEmail | Action | Details | Metadata |
|-----------|------------|-----------|--------|---------|-----------|
| 2025-05-02T10:00:00Z | APP-001 | approver@... | APPROVED | Step 2 approved | JSON |

- **Action**: `CREATED`, `SUBMITTED`, `APPROVED`, `REJECTED`, `REQUESTED_REVISION`, `DISPATCHED`, `EMAILED`
- Stored in separate spreadsheet (LOGS_SPREADSHEET_ID) for security

---

## 3. Step-by-Step Development Phases

### Phase 1: Core Infrastructure (Week 1)
1. Set up Vite + React + Tailwind with single-file output
2. Configure GAS project with appsscript.json (Web App mode)
3. Build Database.gs with CRUD operations for all sheets
4. Implement Auth.gs with google.script.run API layer
5. Create React App shell with hash-based routing
6. Build AuthContext with GAS authentication

### Phase 2: Visual Workflow Builder (Week 2)
1. Design FlowBuilder canvas with drag-drop steps
2. Build step configuration panel (assignee, action types)
3. Implement JSON serialization for flow steps
4. Add flow validation (at least one step, valid assignees)
5. Create Flow list view and detail view
6. Wire Flow CRUD to Database.gs

### Phase 3: Flow Execution & Dynamic Forms (Week 3)
1. Build FlowExecution page with dynamic-rendered form
2. Implement Google Drive file picker (DriveApp)
3. Add PDF previewer using iframe/embed
4. Create approval action buttons (Approve/Reject/Request Revision)
5. Implement step progression logic in WorkflowEngine.gs
6. Wire status transitions to APPROVALS sheet

### Phase 4: Entity Directory & DLP (Week 4)
1. Build EntityDirectory management UI
2. Implement EntityManager.gs with verified email lookup
3. Add DLP enforcement in EmailService.gs (block non-verified)
4. Create entity tagging UI during file upload
5. Add validation: only verified entities can receive emails
6. Test end-to-end DLP blocking

### Phase 5: Email Module (Week 5)
1. Configure Gmail API with sendAs resources
2. Build EmailService.gs with alias support
3. Create email template builder UI
4. Implement custom subject/body with merge fields
5. Add automatic document attachment from Drive
6. Wire email dispatch to workflow completion

### Phase 6: Audit & Polish (Week 6)
1. Implement AuditLogger.gs with immutable append
2. Build AuditLog viewer UI with filtering
3. Add RBAC granular permissions per step
4. Implement Dark Mode theme throughout
5. Performance optimization (batch writes)
6. Security audit and testing

---

## 4. Technical Constraints for GAS + React

### 4.1 Configuration Management
All IDs stored in GAS PropertiesService:

```javascript
// lib/Config.gs
const PROPS = PropertiesService.getUserProperties();

function getConfig(key) {
  return PROPS.getProperty(key);
}

function initConfig(rootDriveFolderId, logsSpreadsheetId, configSpreadsheetId) {
  PROPS.setProperty('ROOT_DRIVE_FOLDER_ID', rootDriveFolderId);
  PROPS.setProperty('LOGS_SPREADSHEET_ID', logsSpreadsheetId);
  PROPS.setProperty('CONFIG_SPREADSHEET_ID', configSpreadsheetId);
}
```

### 4.2 Auth Gate (Google-Native)
React app calls GAS to verify user on load:

```javascript
// GAS: Auth.gs
function authenticate() {
  const email = Session.getActiveUser().getEmail();
  const configSheetId = PROPS.getProperty('CONFIG_SPREADSHEET_ID');
  
  const ss = SpreadsheetApp.openById(configSheetId);
  const usersSheet = ss.getSheetByName('USERS');
  const data = usersSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === email.toLowerCase()) {
      return {
        authenticated: true,
        email: data[i][0],
        role: data[i][1],
        displayName: data[i][2],
      };
    }
  }
  
  return { authenticated: false, email: email };
}
```

### 4.3 RBAC Enforcement
```javascript
// lib/Auth.gs
const ROLES = {
  ADMIN: 'Admin',
  SUPER_APPROVER: 'SuperApprover',
  APPROVER: 'Approver',
  OPERATOR: 'Operator',
};

function canAccess(requiredRoles) {
  const user = authenticate();
  if (!user.authenticated) return false;
  return requiredRoles.includes(user.role);
}

function canApprove(user, stepAssignee, flowId) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.SUPER_APPROVER) return true;
  if (user.role === ROLES.APPROVER) {
    // Check if step is assigned to this user
    return stepAssignee.includes(user.email);
  }
  return false;
}
```

### 4.4 Routing Without History API
Use hash-based routing (no pushState):

```typescript
// src/App.tsx
function App() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/dashboard');

  useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || '/dashboard');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/flows" element={<FlowList />} />
      <Route path="/flows/:id" element={<FlowExecution />} />
      <Route path="/builder" element={<FlowBuilder />} />
      <Route path="/entities" element={<EntityDirectory />} />
      <Route path="/audit" element={<AuditLog />} />
    </Routes>
  );
}
```

### 4.2 GAS Iframe Constraints
- No `window.history.pushState` - use `#/route`
- No localStorage cross-origin - store in GAS PropertiesService
- No cookies - use `google.script.run` with server-side sessions
- Font loading - embed fonts as base64 or use system fonts

### 4.3 Vite Configuration (Single File)
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'index.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

### 4.4 GAS API Wrapper Pattern
```typescript
// src/services/gasClient.ts
const gasClient = {
  call<T>(functionName: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .runAsLibrary(functionName, ...args);
    });
  },
};

export default gasClient;
```

### 4.5 Tailwind Dark Mode Theme
```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        surface: '#1a1a1a',
        surfaceElevated: '#242424',
        border: '#333333',
        textPrimary: '#f5f5f5',
        textSecondary: '#a3a3a3',
        accent: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
};
```

### 4.6 DLP Strict Enforcement Rules
1. **NEVER** allow manual email entry in forms
2. **ALWAYS** resolve recipients from ENTITIES sheet (via EntityID)
3. **BLOCK** dispatch if entity `IsActive !== TRUE`
4. **LOG** all email attempts (success or blocked)
5. **TAG** every file with entity EntityID before attachment
6. **VERIFY** recipient email against ENTITIES.VerifiedEmail before sending

### 4.7 Write Rate Limiting
- Google Sheets: ~18 writes/minute
- Implement queue in GAS with PropertiesService
- Batch updates where possible
- Use `LockService` for critical sections

---

## 5. Security Checklist

- [ ] Configuration IDs stored in PropertiesService (not hardcoded)
- [ ] Auth uses Session.getActiveUser() - no custom credentials
- [ ] Auth Gate validates user against USERS sheet
- [ ] Unregistered users see "Access Denied" screen
- [ ] RBAC enforces 4-tier role system
- [ ] Entity lookup validates IsActive flag
- [ ] Audit log in separate spreadsheet (LOGS_SPREADSHEET_ID)
- [ ] Audit log is append-only (no update/delete)
- [ ] No raw email addresses in client code
- [ ] Drive file access scoped to ROOT_DRIVE_FOLDER_ID
- [ ] Gmail send uses dedicated service account
- [ ] No client-side secrets (all via GAS)

---

## 6. Post-Deployment Checklist

### Admin Setup (Manual)
- [ ] Create ROOT_DRIVE_FOLDER_ID in Google Drive
- [ ] Create LOGS_SPREADSHEET_ID with AUDIT_LOG sheet
- [ ] Create CONFIG_SPREADSHEET_ID with USERS, ENTITIES, FLOWS, APPROVALS sheets
- [ ] Store IDs in GAS PropertiesService via Config.gs

### Web App Deployment
- [ ] Web App deployed with `execute as: USER`
- [ ] Access set to specific domain or users

### Initial Data
- [ ] USERS sheet has at least one Admin user
- [ ] ENTITIES sheet pre-populated with employees/clients
- [ ] Sample FLOWS defined in FLOWS sheet

---

## 9. CRITICAL: JSON Serialization Pattern (GAS ↔ React)

> **NEVER return raw objects from `apiCall()` in Code.gs.** Always return `JSON.stringify(response)`.

### Problem
`google.script.run` uses an internal serialization mechanism that **silently crashes** when the response object contains:
- Native `Date` objects (from Google Sheets cells)
- Complex nested objects with mixed types
- Circular references

This causes an opaque `Unknown error` on the frontend with no stack trace.

### Solution (MANDATORY for all GAS ↔ Frontend communication)

**Backend (`Code.gs`):**
```javascript
function apiCall(jsonString) {
  // ... process request ...
  return JSON.stringify(response); // ← ALWAYS stringify
}
```

**Frontend (`AuthGate.tsx` → `callGAS`):**
```typescript
run.withSuccessHandler((rawResult: any) => {
  let result = rawResult;
  if (typeof rawResult === 'string') {
    result = JSON.parse(rawResult); // ← ALWAYS parse if string
  }
  // ... process result ...
})
```

### Rules
1. **All dates** in GAS responses must be ISO strings (`.toISOString()`) — never raw `Date` objects
2. **All `apiCall` responses** must go through `JSON.stringify()` before returning
3. **Frontend `callGAS`** must handle both string and object responses for backwards compatibility
4. When adding new API endpoints, follow this pattern — do NOT return raw objects

---

*End of AGENT.md*

## 6b. Auth Gate Flow (React Frontend)

### Startup Sequence
1. React app loads
2. Call `authenticate()` GAS endpoint
3. If `authenticated: false` → Show "Access Denied" screen
4. If `authenticated: true` → Store user context, render main app

```typescript
// src/contexts/AuthContext.tsx
interface AuthState {
  authenticated: boolean;
  email: string;
  role: 'Admin' | 'SuperApprover' | 'Approver' | 'Operator';
  displayName: string;
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gasClient.call<AuthState>('authenticate').then(user => {
      setAuth(user);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;
  if (!auth?.authenticated) return <AccessDenied />;

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
```

### Access Denied Screen
```typescript
function AccessDenied() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Access Denied</h1>
        <p className="text-textSecondary">
          Your email is not registered in the system.<br />
          Contact an administrator to request access.
        </p>
      </div>
    </div>
  );
}
```

---

## 6c. Auto-Bootstrapping & Defensive Initialization

Although Admin provides spreadsheet IDs, the system must NOT assume spreadsheets are pre-formatted.

### Bootstrap Routine
The GAS backend includes `bootstrapDatabase()` that runs defensively:

```javascript
// lib/Bootstrap.gs
const SCHEMAS = {
  USERS: ['Email', 'Role', 'DisplayName', 'CreatedAt', 'LastLogin'],
  ENTITIES: ['EntityID', 'EntityType', 'DisplayName', 'VerifiedEmail', 'IsActive', 'CreatedAt'],
  FLOWS: ['FlowID', 'FlowName', 'Description', 'Steps', 'CreatedBy', 'CreatedAt', 'IsActive'],
  APPROVALS: ['ApprovalID', 'FlowID', 'CurrentStep', 'Status', 'SubmittedBy', 'EntityTag', 'Files', 'SubmittedAt'],
  AUDIT_LOG: ['Timestamp', 'ApprovalID', 'ActorEmail', 'Action', 'Details', 'Metadata'],
};

function bootstrapDatabase() {
  const result = { initialized: [], errors: [] };
  
  try {
    const configSheetId = PROPS.getProperty('CONFIG_SPREADSHEET_ID');
    const logsSheetId = PROPS.getProperty('LOGS_SPREADSHEET_ID');
    
    // Bootstrap CONFIG spreadsheet sheets
    if (configSheetId) {
      result.initialized.push(...bootstrapSheet(configSheetId, ['USERS', 'ENTITIES', 'FLOWS', 'APPROVALS']));
    }
    
    // Bootstrap LOGS spreadsheet sheets
    if (logsSheetId) {
      result.initialized.push(...bootstrapSheet(logsSheetId, ['AUDIT_LOG']));
    }
    
  } catch (e) {
    result.errors.push(e.message);
  }
  
  return result;
}

function bootstrapSheet(spreadsheetId, requiredSheets) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const initialized = [];
  
  for (const sheetName of requiredSheets) {
    let sheet = ss.getSheetByName(sheetName);
    
    // Create sheet if missing
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      initialized.push(`Created sheet: ${sheetName}`);
    }
    
    // Verify headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expectedHeaders = SCHEMAS[sheetName];
    
    if (!expectedHeaders) continue;
    
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      // Inject missing headers
      const startCol = headers.filter(h => h).length + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      initialized.push(`Added headers to ${sheetName}: ${missingHeaders.join(', ')}`);
    }
  }
  
  return initialized;
}
```

### Auto-Init Trigger
- Run on first app load via `authenticate()` calling `bootstrapDatabase()` if needed
- Or via dedicated Admin endpoint: `initDatabase()`
- Logs all bootstrap actions to audit log

### Defensive Reads
All database functions also verify schema before reading:

```javascript
function getRecords(sheetName) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // If headers missing, auto-bootstrap and retry
  if (!headers.includes(SCHEMAS[sheetName][0])) {
    bootstrapDatabase();
    return getRecords(sheetName); // Retry
  }
  
  // Proceed with reading...
}
```

---

## 7. Deployment Pipeline

### 7.1 Clasp Configuration
The user must manually handle clasp authentication. Run the following commands once:
```bash
npm install -g @google/clasp
clasp login
```
Enable Google Apps Script API at: https://script.google.com/home/users

### 7.2 .clasp.json Configuration
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./dist"
}
```
- `rootDir` points to Vite's build output folder (where compiled files go)
- `scriptId` is obtained from Google Apps Script editor after first deployment

### 7.3 Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "copy:gasis": "node scripts/copy-gas.js",
    "deploy": "npm run build && npm run copy:gasis && npx clasp push",
    "open": "npx clasp open"
  }
}
```

### 7.4 Deployment Workflow

**Step 1: Build React**
```bash
npm run build
```
- Compiles React app to single `index.html` in `./dist`
- Inlines all CSS and JS (GAS-compatible)

**Step 2: Copy GAS Backend**
```bash
npm run copy:gasis
```
- Copies `.gs` files from `gas/` to `./dist`
- Copies `appsscript.json` to `./dist`
- Uses Node.js script (see below)

**Step 3: Push to Google**
```bash
npx clasp push
```
- Uploads all `./dist` contents to Google Apps Script

**Step 4: Deploy (Combined)**
```bash
npm run deploy
```
- Runs build + copy + push in sequence

### 7.5 Copy Script (scripts/copy-gas.js)
```javascript
import fs from 'fs';
import path from 'path';

const gasDir = path.resolve('gas');
const distDir = path.resolve('dist');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.name.endsWith('.gs') || entry.name === 'appsscript.json') {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${entry.name}`);
    }
  }
}

copyDir(gasDir, distDir);
console.log('GAS files copied to dist/');
```

---

## 8. Development Commands

| Command | Description |
|---------|------------|
| `npm run dev` | Start Vite dev server (http://localhost:5173) |
| `npm run build` | Build React to single HTML file |
| `npm run copy:gasis` | Copy GAS backend to dist |
| `npm run deploy` | Build + copy + push to Google Apps Script |
| `npx clasp open` | Open the web app in browser |