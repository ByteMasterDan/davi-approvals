/**
 * Bootstrap.gs - Auto-Bootstrapping & Initialization
 * Creates required sheets and sets up the system
 */

const SCHEMAS = {
  USERS: ['Name', 'Email', 'Role', 'IsActive', 'CreatedAt'],
  CLIENTS: ['ClientName', 'Email', 'IsActive', 'CreatedAt'],
  AUDIT_LOG: ['Id', 'Timestamp', 'UserEmail', 'Action', 'ClientName', 'FileName', 'FileUrl', 'Status', 'Notes'],
};

/**
 * API: Setup the system with the provided spreadsheet ID
 */
function setupSystem(spreadsheetId) {
  if (!spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID is required' };
  }

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    if (!ss) {
      return { success: false, error: 'Cannot access spreadsheet. Check permissions.' };
    }

    // Store spreadsheet ID in script properties
    const props = PropertiesService.getScriptProperties();
    props.setProperty('CONFIG_SPREADSHEET_ID', spreadsheetId);

    // Create sheets
    const created = [];
    for (const [sheetName, headers] of Object.entries(SCHEMAS)) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.setFrozenRows(1);
        created.push(sheetName);
      } else {
        // Update headers if sheet exists but has different headers
        const lastCol = sheet.getLastColumn();
        if (lastCol === 0 || sheet.getRange(1, 1).getValue() === '') {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
          sheet.setFrozenRows(1);
        }
      }
    }

    return {
      success: true,
      message: 'System configured successfully',
      sheets: created,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Check if system is configured
 */
function isSystemConfigured() {
  try {
    const props = PropertiesService.getScriptProperties();
    const ssId = props.getProperty('SPREADSHEET_ID');
    if (!ssId) return false;

    const ss = SpreadsheetApp.openById(ssId);
    return !!ss;
  } catch (e) {
    return false;
  }
}

/**
 * Get spreadsheet from script properties
 */
function getSpreadsheetFromProps() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) throw new Error('System not configured. Run setupSystem first.');
  return SpreadsheetApp.openById(ssId);
}
