/**
 * Davi-Approvals - Main Entry Point
 * Web App + API Handler
 */

function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Davi-Approvals')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + error.message + '</p>');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return value.toString();
}

function apiCall(jsonString) {
  const response = { success: false, data: null, error: null };
  let action = 'unknown';

  try {
    const request = JSON.parse(jsonString);
    action = request.action;
    const args = request.params || {};

    // Ensure database exists
    if (action !== 'initDatabase') {
      try { initDatabase(); } catch(e) {}
    }

    switch (action) {
      // System
      case 'initDatabase':
        response.data = initDatabase();
        break;
      case 'setupSystem':
        response.data = setupSystem(args.spreadsheetId);
        break;
      case 'isSystemConfigured':
        response.data = { configured: isSystemConfigured() };
        response.success = true;
        break;

      // Auth
      case 'login':
        response.data = login(args.email, args.password);
        break;
      case 'getSession':
        response.data = getSession(args.token);
        break;

      // Users (Advanced)
      case 'getAllUsers':
        response.data = getAllUsers(args.token);
        break;
      case 'createUser':
        response.data = createUser(args.token, args.email, args.password, args.role, args.displayName);
        break;
      case 'updateUser':
        response.data = updateUser(args.token, args.userId, args.updates);
        break;

      // Clients (Advanced)
      case 'getClients':
        response.data = getClients(args.token);
        break;
      case 'createClient':
        response.data = createClient(args.token, args.clientData);
        break;
      case 'updateClient':
        response.data = updateClient(args.token, args.clientName, args.clientData);
        break;

      // Documents
      case 'uploadDocuments':
        response.data = uploadDocuments(args.token, args.files);
        break;

      // Approvals
      case 'getPendingApprovals':
        response.data = getPendingApprovals(args.token);
        break;
      case 'approveDocument':
        response.data = approveDocument(args.token, args.auditId, args.clientEmailOverride);
        break;
      case 'approveAllDocuments':
        response.data = approveAllDocuments(args.token, args.auditIds);
        break;
      case 'rejectDocument':
        response.data = rejectDocument(args.token, args.auditId, args.reason);
        break;
      case 'escalateDocument':
        response.data = escalateDocument(args.token, args.auditId);
        break;

      // Settings
      case 'getSettings':
        response.data = getSettings(args.token);
        break;
      case 'updateSettings':
        response.data = updateSettings(args.token, args.key, args.value);
        break;

      // Dashboard
      case 'getDashboard':
        response.data = getDashboard(args.token);
        break;

      // Audit
      case 'getAuditLog':
        response.data = getAuditLog(args.token);
        break;

      default:
        response.error = 'Unknown action: ' + action;
    }

    response.success = response.data && response.data.success !== undefined ? response.data.success : !response.error;
  } catch (error) {
    Logger.log('API error in ' + action + ': ' + error.message);
    response.error = error.message;
    response.success = false;
  }

  return JSON.stringify(response);
}
