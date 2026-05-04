/**
 * Bootstrap.gs - Auto-Bootstrapping & Initialization
 * Creates required sheets and default admin user
 */

const SCHEMAS = {
  USERS: ['UserID', 'Email', 'PasswordHash', 'Role', 'DisplayName', 'Skills', 'CreatedAt', 'IsActive', 'LastLogin', 'Notes'],
  FLOWS: ['FlowID', 'FlowName', 'Description', 'Steps', 'FormData', 'FormLink', 'CreatedBy', 'CreatedAt', 'IsActive'],
  APPROVALS: ['ApprovalID', 'FlowID', 'CurrentStep', 'Status', 'SubmittedBy', 'EntityTag', 'Files', 'SubmittedAt', 'CompletedAt'],
  CLIENTS: ['ClientID', 'ClientType', 'DisplayName', 'VerifiedEmail', 'IsActive', 'CreatedAt'],
  EMPLOYEES: ['EmployeeID', 'EmployeeNumber', 'DisplayName', 'Email', 'Department', 'IsActive', 'CreatedAt'],
  SKILLS: ['SkillID', 'SkillName', 'Description', 'IsActive'],
  AUDIT_LOG: ['Timestamp', 'ApprovalID', 'ActorEmail', 'Action', 'Details', 'Metadata'],
};

/**
 * API: Setup the system with the provided spreadsheet ID
 */
function setupSystem(spreadsheetId) {
  if (!spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID is required' };
  }

  try {
    // Validate spreadsheet access
    const ss = SpreadsheetApp.openById(spreadsheetId);
    if (!ss) {
      return { success: false, error: 'Cannot access spreadsheet. Check permissions.' };
    }

    // Save configuration
    CONFIG.setSpreadsheetId(spreadsheetId);

    // Bootstrap database
    const bootstrapResult = bootstrapDatabase();

    return {
      success: true,
      message: 'System configured successfully!',
      spreadsheetId: spreadsheetId,
      bootstrapResult: bootstrapResult,
    };
  } catch (e) {
    return { success: false, error: 'Setup failed: ' + e.message };
  }
}

/**
 * Auto-heal missing sheets quickly if they are deleted manually.
 */
function ensureDatabase() {
  try {
    const ss = CONFIG.getSpreadsheet();
    const required = Object.keys(SCHEMAS);
    const existing = ss.getSheets().map(s => s.getName());
    const missing = required.filter(name => !existing.includes(name));
    
    if (missing.length > 0) {
      Logger.log('Auto-healing missing sheets: ' + missing.join(', '));
      bootstrapDatabase();
    }
  } catch (e) {
    Logger.log('Auto-heal check failed: ' + e.message);
  }
}

/**
 * Bootstrap database - create required sheets and headers
 */
function bootstrapDatabase() {
  const result = { sheets: [], admin: null, errors: [] };

  try {
    const ss = CONFIG.getSpreadsheet();

    // Run structural migrations first
    try {
      runMigrations(ss, result);
    } catch (e) {
      result.errors.push('Migration Error: ' + e.message);
    }

    // Create required sheets
    for (const sheetName of Object.keys(SCHEMAS)) {
      try {
        let sheet = ss.getSheetByName(sheetName);

        // Create sheet if missing
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
          result.sheets.push('Created: ' + sheetName);
        }

        // Inject headers if missing or mismatched
        const headers = getHeaders(sheet);
        const expected = SCHEMAS[sheetName];

        if (!expected) continue;

        const headersMatch = headers && headers.length === expected.length && 
          expected.every((h, idx) => headers[idx] === h);

        if (!headersMatch) {
          sheet.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
          result.sheets.push('Headers synced: ' + sheetName);
        }
      } catch (e) {
        result.errors.push(sheetName + ': ' + e.message);
      }
    }

    // Create default admin user if not exists
    try {
      const adminResult = createDefaultAdmin(ss);
      result.admin = adminResult;
    } catch (e) {
      result.errors.push('Admin creation: ' + e.message);
    }

    // Delete default "Sheet1" if exists
    try {
      const defaultSheet = ss.getSheetByName('Sheet1');
      if (defaultSheet && ss.getSheets().length > 1) {
        ss.deleteSheet(defaultSheet);
      }
    } catch (e) {
      // Ignore - might not exist
    }

    result.success = result.errors.length === 0;
  } catch (e) {
    result.errors.push('Bootstrap failed: ' + e.message);
    result.success = false;
  }

  return result;
}

/**
 * Create default admin user
 */
function createDefaultAdmin(ss) {
  const sheet = ss.getSheetByName('USERS');
  if (!sheet) return 'USERS sheet not found';

  const data = sheet.getDataRange().getValues();
  const adminEmail = 'admin@davivienda.com';

  // Check if admin already exists
  for (let i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().toLowerCase() === adminEmail) {
      return 'Admin already exists';
    }
  }

  // Create admin user
  const passwordHash = hashPassword('admin123');
  const adminId = Utilities.getUuid();
  sheet.appendRow([
    adminId,           // UserID
    adminEmail,        // Email
    passwordHash,      // PasswordHash
    'Admin',           // Role
    'Admin Davivienda',// DisplayName
    'all',             // Skills
    new Date().toISOString(), // CreatedAt
    true,              // IsActive
    '',                // LastLogin
    'Default admin - change password!', // Notes
  ]);

  return 'Admin created: ' + adminEmail + ' / admin123';
}

/**
 * Get headers from a sheet (Row 1)
 */
function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
}

/**
 * Automate tricky schema migrations before header syncs
 */
function runMigrations(ss, result) {
  const usersSheet = ss.getSheetByName('USERS');
  if (usersSheet) {
    const data = usersSheet.getDataRange().getValues();
    if (data.length > 1) {
      const firstDataCol = String(data[1][0] || '').trim();
      // If the first data column is an email, it means data is shifted from the old schema
      if (firstDataCol.includes('@')) {
        let updated = false;
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0] || '').includes('@')) {
            // Shift data right by inserting a UUID at the beginning
            data[i].unshift(Utilities.getUuid());
            updated = true;
          }
        }
        
        if (updated) {
          // Normalize lengths
          const maxCols = Math.max(...data.map(r => r.length));
          const balancedData = data.map(r => {
             while(r.length < maxCols) r.push('');
             return r;
          });
          
          // Rewrite the sheet with repaired data
          usersSheet.clearContents();
          usersSheet.getRange(1, 1, balancedData.length, maxCols).setValues(balancedData);
          result.sheets.push('Migrated USERS dataset to UserID schema offset');
        }
      }
    }
  }

  // Migrate ENTITIES to CLIENT_DIRECTORY if it exists
  const entitiesSheet = ss.getSheetByName('ENTITIES');
  if (entitiesSheet) {
    entitiesSheet.setName('CLIENTS');
    result.sheets.push('Renamed ENTITIES to CLIENTS');
    const expected = SCHEMAS.CLIENTS;
    entitiesSheet.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
    result.sheets.push('Synced CLIENTS headers');
  }
}

/**
 * API: Force re-bootstrap (Admin only)
 */
function forceBootstrap(token) {
  if (!hasRole(token, 'Admin')) {
    return { success: false, error: 'Access denied' };
  }
  return bootstrapDatabase();
}

/**
 * UTILITY: Reset database and seed default admin.
 * Destructive action! Must be run directly from Apps Script Editor.
 */
function resetAndSeed() {
  const ss = CONFIG.getSpreadsheet();
  if (!ss) throw new Error('System not configured. Setup spreadsheet first.');
  
  // Clear all data rows (keep headers)
  for (const sheetName of Object.keys(SCHEMAS)) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
  }
  
  // Re-bootstrap to ensure schemas and admin are created
  const result = bootstrapDatabase();
  Logger.log('Reset complete: ' + JSON.stringify(result));
  return result;
}